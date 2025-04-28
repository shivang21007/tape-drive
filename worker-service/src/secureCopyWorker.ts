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
import { FileProcessingJob, SecureCopyJob } from './types/fileProcessing';
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


const worker = new Worker<SecureCopyJob>(
    'SecureCopy',
    async (job: Job<SecureCopyJob>) => {
        const { fileId, fileName, userName, userEmail, groupName, filePath, server, isAdmin } = job.data;

        try {
            logger.info(`Starting secure copy for file: ${fileName} from server: ${server}`);
            tapeLogger.startOperation('secure-copy');

            // Get private IP for the server
            const privateIp = await getPrivateIp(groupName, server);
            logger.info(`Resolved private IP ${privateIp} for server ${server}`);

            // Create the target directory
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

            // Execute SCP command with private IP
            const scpCommand = `scp octro@${privateIp}:${filePath} ${targetPath}`;
            logger.info(`Executing SCP command: ${scpCommand}`);

            tapeLogger.startOperation('scp-transfer');
            try {
                const { stdout, stderr } = await execAsync(scpCommand);
                logger.info('SCP output:', stdout);
                if (stderr) logger.warn('SCP warnings:', stderr);
            } catch (error) {
                logger.error('SCP command failed:', error);
                throw new Error(`SCP command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                console.log("New job added to file processing queue: ", jobData.id);

                logger.info(`Added file to file-processing queue: ${fileName}`);

                // Send success email
                await emailService.sendSecureCopyEmail(userEmail, 'success', {
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

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Secure copy operation failed:', error);
            tapeLogger.logError('secure-copy', new Error(errorMessage));

            // Notify admin of critical error
            await adminNotificationService.sendCriticalError('secure-copy', new Error(errorMessage), {
                fileId,
                filePath,
                server,
                userEmail
            });

            // Update database status
            await databaseService.updateUploadStatus(fileId, 'failed');

            // Send failure email to user
            try {
                await emailService.sendSecureCopyEmail(userEmail, 'failed', {
                    server: server,
                    localPath: filePath,
                    jobId: job.id || 'unknown',
                    requestedAt: Date.now(),
                    errorMessage: errorMessage
                });
            } catch (emailError) {
                logger.error('Failed to send failure email:', emailError);
            }

            throw error;
        }
    },
    {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD
        },
        concurrency: 1, // Process one job at a time
        limiter: {
            max: 1,
            duration: 1000
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