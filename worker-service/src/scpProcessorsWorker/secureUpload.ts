import { SecureCopyUploadJob, FileProcessingJob } from '../types/fileProcessing';
import { logSecureCopyOperation, logVerification } from '../utils/secureCopyLogger';
import { DatabaseService } from '../services/databaseService';
import { EmailService } from '../services/emailService';
import { AdminNotificationService } from '../services/adminNotificationService';
import { fileQueue } from '../queue/fileQueue';
import path from 'path';
import fs from 'fs-extra';
import shellEscape from 'shell-escape';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export async function processSecureUpload(jobData: SecureCopyUploadJob, helpers: any) {
    const { fileId, fileName, userName, userEmail, groupName, filePath, server, sshUser, isAdmin } = jobData;
    const databaseService = DatabaseService.getInstance();
    const emailService = new EmailService();
    const adminNotificationService = new AdminNotificationService();
    let privateIp: string | undefined;
    try {
        logSecureCopyOperation('start', {
            sourcePath: filePath,
            destPath: 'pending',
            groupName,
            userName,
            status: 'started'
        });

        // Get private IP for the server
        privateIp = await databaseService.getPrivateIp(server);
        logSecureCopyOperation('ip-resolve', {
            sourcePath: server,
            destPath: privateIp,
            groupName,
            userName,
            status: 'completed'
        });

        logSecureCopyOperation('upload-start', {
            sourcePath: filePath,
            destPath: 'pending',
            groupName,
            userName,
            status: 'started'
        });

        const uploadDir = process.env.UPLOAD_DIR || '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles';
        const targetDir = path.join(uploadDir, groupName, userName);

        try {
            await fs.ensureDir(targetDir);
            logSecureCopyOperation('dir-create', {
                sourcePath: 'none',
                destPath: targetDir,
                groupName,
                userName,
                status: 'completed'
            });
        } catch (error) {
            logSecureCopyOperation('dir-create', {
                sourcePath: 'none',
                destPath: targetDir,
                groupName,
                userName,
                status: 'failed',
                error: error as Error
            });
            throw error;
        }

        const targetPath = path.join(targetDir, fileName);
        const escapedRemotePath = shellEscape([filePath]); // Sanitize Server Path
        const escapedLocalPath = shellEscape([targetPath]); // Sanitize Local Path

        const serverName = process.env.SERVER_NAME || 'serv19.octro.net';
        const serverIp = process.env.SERVER_IP || '192.168.111.19';
        // if self host is serv19.octro.net, then use mv command to move the file to the target path
        if (server === serverName || privateIp === serverIp) {
            const mvCommand = `mv ${escapedRemotePath} ${escapedLocalPath}`;
            logSecureCopyOperation('mv-start', {
                sourcePath: escapedRemotePath,
                destPath: escapedLocalPath,
                groupName,
                userName,
                status: 'started'
            });
            try {
                const { stdout, stderr } = await execAsync(mvCommand);
                if (stderr) {
                    logSecureCopyOperation('mv-warning', {
                        sourcePath: escapedRemotePath,
                        destPath: escapedLocalPath,
                        groupName,
                        userName,
                        status: 'completed',
                        error: new Error(stderr)
                    });
                }
                logSecureCopyOperation('mv-complete', {
                    sourcePath: escapedRemotePath,
                    destPath: escapedLocalPath,
                    groupName,
                    userName,
                    status: 'completed'
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logSecureCopyOperation('mv-failed', {
                    sourcePath: escapedRemotePath,
                    destPath: escapedLocalPath,
                    groupName,
                    userName,
                    status: 'failed',
                    error: error as Error
                });
                await databaseService.updateUploadStatus(fileId, 'failed');
                await emailService.sendSecureCopyUploadEmail(userEmail, 'failed', {
                    server: server,
                    localPath: filePath,
                    jobId: helpers.job?.id || 'unknown',
                    requestedAt: Date.now(),
                    errorMessage: errorMessage
                });
                return {
                    success: false,
                    message: 'Failed to move file',
                    error: errorMessage
                };
            }
        } else {
            // Execute SCP command with private IP (upload: remote -> local)
            const scpCommand = `scp -r ${sshUser}@${privateIp}:${escapedRemotePath} ${escapedLocalPath}`;
            logSecureCopyOperation('scp-start', {
                sourcePath: `${privateIp}:${escapedRemotePath}`,
                destPath: escapedLocalPath,
                groupName,
                userName,
                status: 'started'
            });
            try {
                const { stdout, stderr } = await execAsync(scpCommand);
                if (stderr) {
                    logSecureCopyOperation('scp-warning', {
                        sourcePath: `${privateIp}:${escapedRemotePath}`,
                        destPath: escapedLocalPath,
                        groupName,
                        userName,
                        status: 'completed',
                        error: new Error(stderr)
                    });
                }
                logSecureCopyOperation('scp-complete', {
                    sourcePath: `${privateIp}:${escapedRemotePath}`,
                    destPath: escapedLocalPath,
                    groupName,
                    userName,
                    status: 'completed'
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logSecureCopyOperation('scp-failed', {
                    sourcePath: `${privateIp}:${escapedRemotePath}`,
                    destPath: escapedLocalPath,
                    groupName,
                    userName,
                    status: 'failed',
                    error: error as Error
                });
                if (errorMessage.includes('Permission denied')) {
                    await databaseService.updateUploadStatus(fileId, 'failed');
                    await emailService.sendSecureCopyUploadEmail(userEmail, 'failed', {
                        server: server,
                        localPath: filePath,
                        jobId: helpers.job?.id || 'unknown',
                        requestedAt: Date.now(),
                        errorMessage: 'Authentication failed. Please ensure SSH keys are properly configured.'
                    });
                    return { 
                        success: false, 
                        message: 'Authentication failed for SCP transfer',
                        error: errorMessage
                    };
                }
                if (errorMessage.includes('not a regular file') || errorMessage.includes('No such file or directory')) {
                    await databaseService.updateUploadStatus(fileId, 'failed');
                    await emailService.sendSecureCopyUploadEmail(userEmail, 'failed', {
                        server: server,
                        localPath: filePath,
                        jobId: helpers.job?.id || 'unknown',
                        requestedAt: Date.now(),
                        errorMessage: 'File not found or not accessible.'
                    });
                    return { 
                        success: false, 
                        message: 'File not found or not accessible',
                        error: errorMessage
                    };
                }
                await databaseService.updateUploadStatus(fileId, 'failed');
                await emailService.sendSecureCopyUploadEmail(userEmail, 'failed', {
                    server: server,
                    localPath: filePath,
                    jobId: helpers.job?.id || 'unknown',
                    requestedAt: Date.now(),
                    errorMessage: errorMessage
                });
                return {
                    success: false,
                    message: 'SCP failed to transfer the file',
                    error: errorMessage
                };
            }
        }
        // Verify the file
        try {
            const stats = await fs.stat(targetPath);
            const fileSize = stats.size;
            let formattedSize: string;
            if (fileSize < 1024) {
                formattedSize = `${fileSize} B`;
            } else if (fileSize < 1024 * 1024) {
                formattedSize = `${(fileSize / 1024).toFixed(2)} KB`;
            } else if (fileSize < 1024 * 1024 * 1024) {
                formattedSize = `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;
            } else {
                formattedSize = `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            }
            logVerification('file-size', {
                filePath: targetPath,
                expectedSize: fileSize,
                actualSize: fileSize,
                status: 'completed'
            });
            // Update DB status as queuing 
            await databaseService.updateUploadStatus(fileId, 'queueing', targetPath, formattedSize);
            //Update DB status iscached=true for that file.
            await databaseService.markFileAsCachedByid(fileId);
            const fileProcessingJob: FileProcessingJob = {
                type: 'upload',
                fileId,
                fileName,
                fileSize: formattedSize,
                userName,
                userEmail,
                groupName,
                isAdmin,
                filePath: targetPath,
                requestedAt: Date.now()
            };
            const fileJob = await fileQueue.add('file-processing', fileProcessingJob, {
                priority: isAdmin ? 1 : 2,
                jobId: `upload-${fileId}`
            });
            await emailService.sendSecureCopyUploadEmail(userEmail, 'success', {
                server: server,
                localPath: targetPath,
                jobId: fileJob.id || 'unknown',
                requestedAt: Date.now()
            });
            logSecureCopyOperation('upload-complete', {
                sourcePath: filePath,
                destPath: targetPath,
                groupName,
                userName,
                status: 'completed'
            });
            return {
                success: true,
                message: 'File securely copied and queued for processing',
                localPath: targetPath
            };
        } catch (error) {
            logVerification('file-size', {
                filePath: targetPath,
                expectedSize: 0,
                actualSize: 0,
                status: 'failed',
                error: error as Error
            });
            throw error;
        }
    } catch (error) {
        logSecureCopyOperation('operation-failed', {
            sourcePath: filePath,
            destPath: 'failed',
            groupName,
            userName,
            status: 'failed',
            error: error as Error
        });
        await adminNotificationService.sendSecureCopyUploadCriticalError('secure-copy', error as Error, {
            type: 'upload',
            fileId: fileId,
            fileName: fileName,
            server: server,
            filePath: filePath,
            userName: userName,
            userEmail: userEmail,
            requestedAt: helpers.job?.timestamp
        });
        throw error;
    }
}
