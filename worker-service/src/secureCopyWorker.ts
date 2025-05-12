import { Worker, Job } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseService } from './services/databaseService';
import { EmailService } from './services/emailService';
import { AdminNotificationService } from './services/adminNotificationService';
import { fileQueue } from './queue/fileQueue';
import path from 'path';
import fs from 'fs-extra';
import { FileProcessingJob, SecureCopyUploadJob, SecureCopyDownloadJob } from './types/fileProcessing';
import dotenv from 'dotenv';
import { logSecureCopyOperation, logVerification } from './utils/secureCopyLogger';

dotenv.config();

const execAsync = promisify(exec);

const databaseService = DatabaseService.getInstance();
const emailService = new EmailService();
const adminNotificationService = new AdminNotificationService();

// Function to get private IP from Google Sheet
const getPrivateIp = async (group: string, serverName: string): Promise<string> => {
    try {
        const dbService = DatabaseService.getInstance();
        return await dbService.getPrivateIp(group, serverName);
    } catch (error) {
        logSecureCopyOperation('server-fetch', {
            sourcePath: 'database',
            destPath: 'memory',
            status: 'failed',
            error: error as Error
        });
        throw error;
    }
};

const worker = new Worker<SecureCopyUploadJob | SecureCopyDownloadJob>(
    'SecureCopy',
    async (job: Job<SecureCopyUploadJob | SecureCopyDownloadJob>) => {
        const { type, fileId, fileName, userName, userEmail, groupName, filePath, server, isAdmin, requestedAt } = job.data;
        
        try {
            logSecureCopyOperation('start', {
                sourcePath: filePath,
                destPath: 'pending',
                groupName,
                userName,
                status: 'started'
            });

            // Get private IP for the server
            const privateIp: string = await getPrivateIp(groupName, server);
            logSecureCopyOperation('ip-resolve', {
                sourcePath: server,
                destPath: privateIp,
                groupName,
                userName,
                status: 'completed'
            });

            if (type === 'upload') {
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

                // Execute SCP command with private IP (upload: remote -> local)
                const scpCommand = `scp -r octro@${privateIp}:${filePath} ${targetPath}`;
                logSecureCopyOperation('scp-start', {
                    sourcePath: `${privateIp}:${filePath}`,
                    destPath: targetPath,
                    groupName,
                    userName,
                    status: 'started'
                });

                try {
                    const { stdout, stderr } = await execAsync(scpCommand);
                    if (stderr) {
                        logSecureCopyOperation('scp-warning', {
                            sourcePath: `${privateIp}:${filePath}`,
                            destPath: targetPath,
                            groupName,
                            userName,
                            status: 'completed',
                            error: new Error(stderr)
                        });
                    }
                    logSecureCopyOperation('scp-complete', {
                        sourcePath: `${privateIp}:${filePath}`,
                        destPath: targetPath,
                        groupName,
                        userName,
                        status: 'completed'
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    logSecureCopyOperation('scp-failed', {
                        sourcePath: `${privateIp}:${filePath}`,
                        destPath: targetPath,
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
                            jobId: job.id || 'unknown',
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
                            jobId: job.id || 'unknown',
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
                        jobId: job.id || 'unknown',
                        requestedAt: Date.now(),
                        errorMessage: errorMessage
                    });
                    
                    return {
                        success: false,
                        message: 'SCP failed to transfer the file',
                        error: errorMessage
                    };
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

                    await databaseService.updateUploadStatus(fileId, 'queueing', targetPath, formattedSize);

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

                    const jobData = await fileQueue.add('file-processing', fileProcessingJob, {
                        priority: isAdmin ? 1 : 2,
                        jobId: `upload-${fileId}`
                    });

                    await emailService.sendSecureCopyUploadEmail(userEmail, 'success', {
                        server: server,
                        localPath: targetPath,
                        jobId: jobData.id || 'unknown',
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

            } else if (type === 'download') {
                const { downloadRequestId } = job.data;

                logSecureCopyOperation('download-start', {
                    sourcePath: 'pending',
                    destPath: filePath,
                    groupName,
                    userName,
                    status: 'started'
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

                const remotePath = filePath.startsWith('~') ? filePath : `~/${filePath}`;
                const scpCommand = `scp -r ${localFilePath} octro@${privateIp}:${remotePath}`;

                logSecureCopyOperation('scp-start', {
                    sourcePath: localFilePath,
                    destPath: `${privateIp}:${remotePath}`,
                    groupName,
                    userName,
                    status: 'started'
                });

                try {
                    const { stdout, stderr } = await execAsync(scpCommand);
                    if (stderr) {
                        logSecureCopyOperation('scp-warning', {
                            sourcePath: localFilePath,
                            destPath: `${privateIp}:${remotePath}`,
                            groupName,
                            userName,
                            status: 'completed',
                            error: new Error(stderr)
                        });
                    }

                    const verifyCommand = `ssh octro@${privateIp} "ls -l ${remotePath}"`;
                    const { stdout: verifyOutput } = await execAsync(verifyCommand);

                    logVerification('remote-file', {
                        filePath: remotePath,
                        expectedSize: 0,
                        actualSize: 0,
                        status: 'completed'
                    });

                    await databaseService.updateDownloadStatus(downloadRequestId, 'completed', 'cache');

                    await emailService.sendSecureCopyDownloadEmail(userEmail, 'success', {
                        server,
                        fileName,
                        remotePath: filePath,
                        jobId: job.id || 'unknown',
                        requestedAt: job.timestamp
                    });

                    logSecureCopyOperation('download-complete', {
                        sourcePath: localFilePath,
                        destPath: `${privateIp}:${remotePath}`,
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
                        sourcePath: localFilePath,
                        destPath: `${privateIp}:${remotePath}`,
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
                        jobId: job.id || 'unknown',
                        requestedAt: job.timestamp,
                        errorMessage
                    });

                    return {
                        success: false,
                        message: 'Failed to copy file to remote server',
                        error: errorMessage
                    };
                }
            } else {
                throw new Error(`Invalid job type: ${type}`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logSecureCopyOperation('operation-failed', {
                sourcePath: filePath,
                destPath: 'failed',
                groupName,
                userName,
                status: 'failed',
                error: error as Error
            });

            if (type === 'upload') {
                await adminNotificationService.sendSecureCopyUploadCriticalError('secure-copy', error as Error, {
                    type: type,
                    fileId: fileId,
                    fileName: fileName,
                    server: server,
                    filePath: filePath,
                    userName: userName,
                    userEmail: userEmail,
                    requestedAt: job.timestamp
                });
            } else if (type === 'download') {
                const { downloadRequestId } = job.data;
                await adminNotificationService.sendSecureCopyDownloadCriticalError('secure-copy', error as Error, {
                    type: type,
                    downloadRequestId: downloadRequestId,
                    fileName: fileName,
                    server: server,
                    filePath: filePath,
                    userName: userName,
                    userEmail: userEmail,
                    requestedAt: job.timestamp
                });
            } else {
                await adminNotificationService.sendCriticalError('secure-copy', error as Error, {
                    type: type,
                    fileId: fileId,
                    fileName: fileName,
                    server: server,
                    userEmail: userEmail
                });
            }
        }
    },
    {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD
        },
        concurrency: 1,
        limiter: {
            max: 1,
            duration: 1000
        },
        settings: {
            backoffStrategy: (attemptsMade: number) => {
                return Math.min(attemptsMade * 1000, 10000);
            }
        },
        maxStalledCount: 1
    }
);

worker.on('completed', (job) => {
    logSecureCopyOperation('job-complete', {
        sourcePath: job.data.filePath,
        destPath: 'completed',
        groupName: job.data.groupName,
        userName: job.data.userName,
        status: 'completed'
    });
});

worker.on('failed', (job, error) => {
    logSecureCopyOperation('job-failed', {
        sourcePath: job?.data.filePath || 'unknown',
        destPath: 'failed',
        groupName: job?.data.groupName,
        userName: job?.data.userName,
        status: 'failed',
        error: error as Error
    });
});

worker.on('error', (error) => {
    logSecureCopyOperation('worker-error', {
        sourcePath: 'unknown',
        destPath: 'failed',
        status: 'failed',
        error: error as Error
    });
});

worker.on('stalled', (jobId) => {
    logSecureCopyOperation('job-stalled', {
        sourcePath: 'unknown',
        destPath: 'stalled',
        status: 'failed',
        error: new Error(`Job ${jobId} stalled`)
    });
});

worker.on('active', (job) => {
    logSecureCopyOperation('job-start', {
        sourcePath: job.data.filePath,
        destPath: 'processing',
        groupName: job.data.groupName,
        userName: job.data.userName,
        status: 'started'
    });
});

worker.on('progress', (job, progress) => {
    logSecureCopyOperation('job-progress', {
        sourcePath: job.data.filePath,
        destPath: 'processing',
        groupName: job.data.groupName,
        userName: job.data.userName,
        status: 'started'
    });
});

logSecureCopyOperation('worker-start', {
    sourcePath: 'none',
    destPath: 'ready',
    status: 'completed'
});
