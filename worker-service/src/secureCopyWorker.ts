import { Worker, Job } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './utils/logger';
import { tapeLogger } from './utils/tapeLogger';
import { DatabaseService } from './services/databaseService';
import { EmailService } from './services/emailService';
import { AdminNotificationService } from './services/adminNotificationService';
import { fileQueue } from './queue/fileQueue';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { FileProcessingJob, SecureCopyUploadJob, SecureCopyDownloadJob } from './types/fileProcessing';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const databaseService = new DatabaseService();
const emailService = new EmailService();
const adminNotificationService = new AdminNotificationService();

interface ServerRecord {
    group: string;
    server_name: string;
    private_ip: string;
}

// // simple 2-minute cache for the server list
// let cachedSheetData: ServerRecord[] | null = null;
// let cacheTimestamp: number = 0;
// const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes



// Function to get private IP from Google Sheet
const getPrivateIp = async (group: string, serverName: string): Promise<string> => {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!sheetId || !apiKey) {
            throw new Error('GOOGLE_SHEET_ID or GOOGLE_API_KEY environment variables not set');
        }

        const sheets = google.sheets({ version: 'v4' });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'A:C',
            key: apiKey, // ✅ Correct place to pass API key
        });
        logger.info("successfully fetched the sheet data");

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error('No data found in the sheet');
        }


        const records = rows.slice(1).map(row => ({
            group: row[0],
            server_name: row[1],
            private_ip: row[2]
        })) as ServerRecord[];

        const server = records.find(
            (record) => record.group === group && record.server_name === serverName
        );

        if (!server) {
            throw new Error(`Mismatch in server name: ${serverName}, and group name: ${group}`);
        }

        return server.private_ip;

    } catch (error) {
        logger.error('Error reading Google Sheet:', error);
        throw error;
    }
};


const worker = new Worker<SecureCopyUploadJob | SecureCopyDownloadJob>(
    'SecureCopy',
    async (job: Job<SecureCopyUploadJob | SecureCopyDownloadJob>) => {
        const { type,fileId, fileName, userName, userEmail, groupName, filePath, server, isAdmin, requestedAt} = job.data;
        
        try {
            logger.info(`Starting secure copy for file: ${fileName} from server: ${server}`);
            tapeLogger.startOperation('secure-copy');

            // Get private IP for the server
            const privateIp: string = await getPrivateIp(groupName, server);
            logger.info(`Resolved private IP ${privateIp} for server ${server}`);

            if (type === 'upload') {
                console.log("Processing upload job:", { type, fileId, fileName, server, filePath });
                // Existing upload logic
                const uploadDir = process.env.UPLOAD_DIR || '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles';
                const targetDir = path.join(uploadDir, groupName, userName);

                try {
                    await fs.mkdir(targetDir, { recursive: true });
                    logger.info(`Created target directory: ${targetDir}`);
                } catch (error) {
                    logger.error(`Failed to create target directory: ${targetDir}`, error);
                    throw new Error(`Failed to create target directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }

                const targetPath = path.join(targetDir, fileName);

                // Execute SCP command with private IP (upload: remote -> local)
                const scpCommand = `scp -r octro@${privateIp}:${filePath} ${targetPath}`;
                logger.info(`Executing SCP command: ${scpCommand}`);

                tapeLogger.startOperation('scp-transfer');
                try {
                    const { stdout, stderr } = await execAsync(scpCommand);
                    logger.info('SCP output:', stdout? stdout : "No output");
                    if (stderr) logger.warn('SCP warnings:', stderr);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    logger.error('SCP command failed:', error);
                    
                    // Check if it's an authentication error
                    if (errorMessage.includes('Permission denied')) {
                        // Update database status to failed
                        await databaseService.updateUploadStatus(fileId, 'failed');
                        // Send authentication failure email
                        await emailService.sendSecureCopyUploadEmail(userEmail, 'failed', {
                            server: server,
                            localPath: filePath,
                            jobId: job.id || 'unknown',
                            requestedAt: Date.now(),
                            errorMessage: 'Authentication failed. Please ensure SSH keys are properly configured and have access to the server or file location.'
                        });
                        
                        // Log and discard the job
                        logger.error('Authentication failed for SCP transfer. Discarding job.');
                        return { 
                            success: false, 
                            message: 'Authentication failed for SCP transfer',
                            error: errorMessage
                        };
                    }
                    
                    // Check for file-related errors
                    if (errorMessage.includes('not a regular file') || errorMessage.includes('No such file or directory')) {
                        // Update database status to failed
                        await databaseService.updateUploadStatus(fileId, 'failed');
                        // Send file error email
                        await emailService.sendSecureCopyUploadEmail(userEmail, 'failed', {
                            server: server,
                            localPath: filePath,
                            jobId: job.id || 'unknown',
                            requestedAt: Date.now(),
                            errorMessage: 'File not found or not accessible. Please verify the file exists and has correct permissions.'
                        });
                        
                        // Log and discard the job
                        logger.error('File not found or not accessible. Discarding job.');
                        return { 
                            success: false, 
                            message: 'File not found or not accessible',
                            error: errorMessage
                        };
                    }
                    // Update database status to failed
                    await databaseService.updateUploadStatus(fileId, 'failed');
                    // Send failure email to user
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
                tapeLogger.endOperation('scp-transfer');

                // Get file size
                tapeLogger.startOperation('file-verification');
                try {
                    const stats = await fs.stat(targetPath);
                    const fileSize = stats.size;
                    logger.info(`File copied successfully. Size: ${fileSize} bytes`);

                    // Format file size with appropriate unit
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

                    // Update database with file size and local path
                    await databaseService.updateUploadStatus(fileId, 'queueing', targetPath, formattedSize);
                    logger.info(`Updated database with file details for ID: ${fileId}`);

                    // Create a new job in the file processing queue
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

                    // Add to file processing queue
                    const jobData = await fileQueue.add('file-processing', fileProcessingJob, {
                        priority: isAdmin ? 1 : 2,
                        jobId: `upload-${fileId}`
                    });

                    logger.info(`Added file to file-processing queue: ${fileName}`);

                    // Send success email
                    await emailService.sendSecureCopyUploadEmail(userEmail, 'success', {
                        server: server,
                        localPath: targetPath,
                        jobId: jobData.id || 'unknown',
                        requestedAt: Date.now()
                    });

                    tapeLogger.endOperation('file-verification');
                    tapeLogger.endOperation('secure-copy');
                    return {
                        success: true,
                        message: 'File securely copied and queued for processing',
                        localPath: targetPath
                    };

                } catch (error) {
                    logger.error('File verification failed:', error);
                    throw new Error(`File verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }

            } else if (type === 'download') {
                // downloadRequestId is the id of the download request in the download_requests table
                const { downloadRequestId } = job.data;

                console.log("Processing download job:", { fileId, fileName, server, filePath });
                
                // Get file details from download_requests table
                const downloadRequest = await databaseService.getDownloadRequest(downloadRequestId);
                if (!downloadRequest) {
                    console.error("Download request not found:", downloadRequestId);
                    throw new Error(`Download request not found for ID: ${downloadRequestId}`);
                }

                // Get local file location from upload_details using the file_id from download request
                const files = await databaseService.getUploadDetails(downloadRequest.file_id);


                if (!files || (files as any[]).length === 0) {
                    console.error("No files found in upload_details");
                    // Update download request status to failed
                    await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');
                    throw new Error(`File not found in upload_details for ID: ${downloadRequest.file_id}`);
                }

                const localFilePath = (files as any[])[0].local_file_location;
                if (!localFilePath || !fsSync.existsSync(localFilePath)) {
                    console.error("Local file not found:", localFilePath);
                    // Update download request status to failed
                    await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');
                    throw new Error(`Local file not found at path: ${localFilePath}`);
                }

                // Update download request status to processing
               const updatedStatus =  await databaseService.updateDownloadStatus(downloadRequestId, 'processing', 'cache');

                // Form SCP command for download (download: local -> remote)
                const remotePath = filePath.startsWith('~') ? filePath : `~/${filePath}`;
                const scpCommand = `scp -r ${localFilePath} octro@${privateIp}:${remotePath}`;
                logger.info(`Executing SCP command for download: ${scpCommand}`);

                tapeLogger.startOperation('scp-transfer');
                try {
                    const { stdout, stderr } = await execAsync(scpCommand);
                    logger.info('SCP output:', stdout? stdout : "No output");
                    if (stderr) logger.warn('SCP warnings:', stderr);

                    // Verify file on remote server
                    const verifyCommand = `ssh octro@${privateIp} "ls -l ${remotePath}"`;
                    const { stdout: verifyOutput } = await execAsync(verifyCommand);
                    logger.info('File verification output:', verifyOutput? verifyOutput : "No output");

                    // Update download_requests table to completed
                    const updatedStatus = await databaseService.updateDownloadStatus(downloadRequestId, 'completed', 'cache');

                    // Send success email
                    await emailService.sendSecureCopyDownloadEmail(userEmail, 'success', {
                        server,
                        fileName,
                        remotePath: filePath,
                        jobId: job.id || 'unknown',
                        requestedAt: job.timestamp
                    });

                    tapeLogger.endOperation('scp-transfer');
                    tapeLogger.endOperation('secure-copy');

                    return {
                        success: true,
                        message: 'File successfully copied to remote server',
                        remotePath: filePath
                    };

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    logger.error('SCP command failed:', error);

                    // Update download_requests table with failure
                    const updatedStatus = await databaseService.updateDownloadStatus(downloadRequestId, 'failed', 'cache');

                    // Send failure email to user for SCP errors
                    await emailService.sendSecureCopyDownloadEmail(userEmail, 'failed', {
                        server,
                        fileName,
                        remotePath: filePath,
                        jobId: job.id || 'unknown',
                        requestedAt: job.timestamp,
                        errorMessage
                    });

                    // Don't throw error to prevent retry
                    return {
                        success: false,
                        message: 'Failed to copy file: "${fileName}" to remote server',
                        error: errorMessage
                    };
                }
            } else {
                throw new Error(`Invalid job type: ${type}`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Secure copy operation failed:', error);
            tapeLogger.logError('secure-copy', new Error(errorMessage));

            // Notify admin of critical error
            if (type === 'upload') {
                await adminNotificationService.sendSecureCopyUploadCriticalError('secure-copy', new Error(errorMessage), {
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
                await adminNotificationService.sendSecureCopyDownloadCriticalError('secure-copy', new Error(errorMessage), {
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
                await adminNotificationService.sendCriticalError('secure-copy', new Error(errorMessage), {
                    type: type,
                    fileId: fileId,
                    fileName: fileName,
                    server: server,
                    userEmail: userEmail
                });
            }

            // Don't throw error to prevent retry
            return {
                success: false,
                message: 'Secure copy operation failed',
                error: errorMessage
            };
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
        // Disable retries
        settings: {
            backoffStrategy: undefined
        }
    }
);

worker.on('completed', (job) => {
    logger.info(`Secure copy job ${job.id} completed successfully`);
});

worker.on('failed', (job, error) => {
    logger.error(`Secure copy job ${job?.id} failed:`, error);
});

logger.info('Secure copy worker started and ready to process jobs'); 