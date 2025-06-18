import { SecureCopyDownloadJob } from '../types/fileProcessing';
import { logSecureCopyOperation, logVerification } from '../utils/secureCopyLogger';
import { DatabaseService } from '../services/databaseService';
import { EmailService } from '../services/emailService';
import { AdminNotificationService } from '../services/adminNotificationService';
import fs from 'fs-extra';
import shellEscape from 'shell-escape';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export async function processSecureDownload(jobData: SecureCopyDownloadJob, helpers: any) {
    const { downloadRequestId, fileId, fileName, userName, userEmail, groupName, filePath, server, sshUser, isAdmin } = jobData;
    const databaseService = DatabaseService.getInstance();
    const emailService = new EmailService();
    const adminNotificationService = new AdminNotificationService();
    let privateIp: string | undefined;
    try {
        logSecureCopyOperation('download-start', {
            sourcePath: 'pending',
            destPath: filePath,
            groupName,
            userName,
            status: 'started'
        });
        privateIp = await databaseService.getPrivateIp(server);
        logSecureCopyOperation('ip-resolve', {
            sourcePath: server,
            destPath: privateIp,
            groupName,
            userName,
            status: 'completed'
        });
        const downloadRequest = await databaseService.getDownloadRequest(downloadRequestId);
        if (!downloadRequest) {
            logSecureCopyOperation('download-failed', {
                sourcePath: 'pending',
                destPath: filePath,
                groupName,
                userName,
                status: 'failed',
                error: new Error(`Download request not found for ID: ${downloadRequestId}`)
            });
            throw new Error(`Download request not found for ID: ${downloadRequestId}`);
        }
        const files = await databaseService.getUploadDetails(downloadRequest.file_id);
        if (!files || (files as any[]).length === 0) {
            logSecureCopyOperation('download-failed', {
                sourcePath: 'pending',
                destPath: filePath,
                groupName,
                userName,
                status: 'failed',
                error: new Error(`File not found in upload_details for ID: ${downloadRequest.file_id}`)
            });
            await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');
            throw new Error(`File not found in upload_details for ID: ${downloadRequest.file_id}`);
        }
        const localFilePath = (files as any[])[0].local_file_location;
        if (!localFilePath || !fs.existsSync(localFilePath)) {
            logSecureCopyOperation('download-failed', {
                sourcePath: 'pending',
                destPath: filePath,
                groupName,
                userName,
                status: 'failed',
                error: new Error(`Local file not found at path: ${localFilePath}`)
            });
            await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');
            throw new Error(`Local file not found at path: ${localFilePath}`);
        }
        await databaseService.updateDownloadStatus(downloadRequestId, 'processing', 'cache');
        // Fix path construction for remote path and sanitize
        const escapedRemotePath = shellEscape([filePath]); // Sanitize Server Path
        const escapedLocalPath = shellEscape([localFilePath]); // Sanitize Local Path

        const serverName = process.env.SERVER_NAME || 'serv19.octro.net';
        const serverIp = process.env.SERVER_IP || '192.168.111.19';

        // if self host is serv19.octro.net or the resolved IP matches our local server IP, then use cp command to copy the file locally
        if (server === serverName || privateIp === serverIp) {
            const cpCommand = `cp -r ${escapedLocalPath} ${escapedRemotePath}`;
            logSecureCopyOperation('cp-start', {
                sourcePath: escapedLocalPath,
                destPath: escapedRemotePath,
                groupName,
                userName,
                status: 'started'
            });
            try {
                const { stdout, stderr } = await execAsync(cpCommand);
                if (stderr) {
                    logSecureCopyOperation('cp-warning', {
                        sourcePath: escapedLocalPath,
                        destPath: escapedRemotePath,
                        groupName,
                        userName,
                        status: 'completed',
                        error: new Error(stderr)
                    });
                }
                logSecureCopyOperation('cp-complete', {
                    sourcePath: escapedLocalPath,
                    destPath: escapedRemotePath,
                    groupName,
                    userName,
                    status: 'completed'
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logSecureCopyOperation('cp-failed', {
                    sourcePath: escapedLocalPath,
                    destPath: escapedRemotePath,
                    groupName,
                    userName,
                    status: 'failed',
                    error: error as Error
                });
                await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');
                await emailService.sendSecureCopyDownloadEmail(userEmail, 'failed', {
                    server,
                    fileName,
                    remotePath: filePath,
                    jobId: helpers.job?.id || 'unknown',
                    requestedAt: helpers.job?.timestamp,
                    errorMessage
                });
                return {
                    success: false,
                    message: 'Failed to copy file locally',
                    error: errorMessage
                };
            }
        } else {
            // Execute SCP command with private IP (download: local -> remote)
            const scpCommand = `scp -r ${escapedLocalPath} ${sshUser}@${privateIp}:${escapedRemotePath}`;
            logSecureCopyOperation('scp-start', {
                sourcePath: escapedLocalPath,
                destPath: `${privateIp}:${escapedRemotePath}`,
                groupName,
                userName,
                status: 'started'
            });
            try {
                const { stdout, stderr } = await execAsync(scpCommand);
                if (stderr) {
                    logSecureCopyOperation('scp-warning', {
                        sourcePath: escapedLocalPath,
                        destPath: `${privateIp}:${escapedRemotePath}`,
                        groupName,
                        userName,
                        status: 'completed',
                        error: new Error(stderr)
                    });
                }
                const verifyCommand = `ssh ${sshUser}@${privateIp} "ls -l ${escapedRemotePath}"`;
                const { stdout: verifyOutput } = await execAsync(verifyCommand);
                logVerification('remote-file', {
                    filePath: escapedRemotePath,
                    expectedSize: 0,
                    actualSize: 0,
                    status: 'completed'
                });
                await databaseService.updateDownloadStatus(downloadRequestId, 'completed', 'cache');
                await emailService.sendSecureCopyDownloadEmail(userEmail, 'success', {
                    server,
                    fileName,
                    remotePath: filePath,
                    jobId: helpers.job?.id || 'unknown',
                    requestedAt: helpers.job?.timestamp
                });
                logSecureCopyOperation('download-complete', {
                    sourcePath: localFilePath,
                    destPath: `${privateIp}:${escapedRemotePath}`,
                    groupName,
                    userName,
                    status: 'completed'
                });
                return {
                    success: true,
                    message: 'File successfully copied to remote server',
                    remotePath: filePath
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logSecureCopyOperation('scp-failed', {
                    sourcePath: escapedLocalPath,
                    destPath: `${privateIp}:${escapedRemotePath}`,
                    groupName,
                    userName,
                    status: 'failed',
                    error: error as Error
                });
                await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');
                await emailService.sendSecureCopyDownloadEmail(userEmail, 'failed', {
                    server,
                    fileName,
                    remotePath: filePath,
                    jobId: helpers.job?.id || 'unknown',
                    requestedAt: helpers.job?.timestamp,
                    errorMessage
                });
                return {
                    success: false,
                    message: 'Failed to copy file to remote server',
                    error: errorMessage
                };
            }
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
        await adminNotificationService.sendSecureCopyDownloadCriticalError('secure-copy', error as Error, {
            type: 'download',
            downloadRequestId: downloadRequestId,
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
