import { Job } from 'bullmq';
import { logger } from '../utils/logger';
import { tapeLogger } from '../utils/tapeLogger';
import { DownloadProcessingJob } from '../types/downloadProcessing';
import { TapeManager } from '../services/tapeManager';
import { DatabaseService } from '../services/databaseService';
import { EmailService } from '../services/emailService';
import { AdminNotificationService } from '../services/adminNotificationService';
import fs from 'fs/promises';
import path from 'path';

const tapeManager = new TapeManager();
const databaseService = new DatabaseService();
const emailService = new EmailService();
const adminNotificationService = new AdminNotificationService();

export async function processDownload(job: DownloadProcessingJob) {
  const { requestId, fileId, fileName, userName, userEmail, groupName, tapeLocation, tapeNumber, requestedAt } = job;
  let currentTape: string | null = null;

  try {
    logger.info(`Processing download request: ${requestId} for file: ${fileName}`);
    tapeLogger.startOperation('download-processing');

    // Update request status to processing
    await databaseService.updateDownloadStatus(requestId, 'processing');

    // Verify tape location exists
    try {
      await fs.access(tapeLocation);
      logger.info(`Tape location verified: ${tapeLocation}`);
    } catch (error) {
      logger.error(`Tape location not found: ${tapeLocation}`);
      throw new Error(`Tape location not found: ${tapeLocation}`);
    }

    // Ensure correct tape is loaded and mounted
    tapeLogger.startOperation('tape-mounting');
    currentTape = await tapeManager.ensureCorrectTape(groupName);
    if (!currentTape) {
      throw new Error('Failed to get current tape number');
    }

    // If current tape is not the required tape, switch tapes
    if (currentTape !== tapeNumber) {
      logger.info(`Switching from tape ${currentTape} to tape ${tapeNumber}`);
      
      try {
        // Unmount current tape if mounted
        if (await tapeManager.isTapeMounted()) {
          await tapeManager.unmountTape();
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unmount
        }

        // Unload current tape
        await tapeManager.unloadTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unload

        // Load and mount new tape
        await tapeManager.loadTape(tapeNumber);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for load
        await tapeManager.mountTape();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for mount

        // Verify new tape is mounted
        if (!await tapeManager.isTapeMounted()) {
          throw new Error('Failed to mount new tape after switching');
        }
      } catch (error) {
        logger.error('Failed to switch tapes:', error);
        throw new Error(`Failed to switch tapes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    tapeLogger.endOperation('tape-mounting');

    // Create local file path
    const localFilePath = path.join(
      process.env.UPLOAD_DIR || '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles',
      groupName,
      userName,
      fileName
    );

    // Ensure directory exists
    try {
      await fs.mkdir(path.dirname(localFilePath), { recursive: true });
      logger.info(`Created directory: ${path.dirname(localFilePath)}`);
    } catch (error) {
      logger.error(`Failed to create directory: ${path.dirname(localFilePath)}`, error);
      throw new Error(`Failed to create directory for download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Copy file with verification
    tapeLogger.startOperation('file-copy');
    try {
      await fs.copyFile(tapeLocation, localFilePath);
      logger.info(`File copied to local storage: ${localFilePath}`);
    } catch (error) {
      logger.error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to copy file from tape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    tapeLogger.endOperation('file-copy');

    // Verify the copy
    tapeLogger.startOperation('file-verification');
    try {
      const sourceStats = await fs.stat(tapeLocation);
      const destStats = await fs.stat(localFilePath);
      
      logger.info(`Source file size: ${sourceStats.size}, Destination file size: ${destStats.size}`);
      
      if (sourceStats.size !== destStats.size) {
        logger.error('File verification failed: size mismatch');
        await fs.unlink(localFilePath);
        throw new Error('File verification failed: size mismatch');
      }
      logger.info('File verification successful');
    } catch (error) {
      logger.error('File verification failed:', error);
      await fs.unlink(localFilePath).catch(() => {});
      throw new Error(`File verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    tapeLogger.endOperation('file-verification');

    // Update database with local file location
    await databaseService.updateUploadLocalFileLocation(fileId, localFilePath);

    // Update download request status
    await databaseService.updateDownloadStatus(requestId, 'completed', 'tape');

    // Send success email
    await emailService.sendDownloadReadyEmail(userEmail, fileName, {
      status: 'success',
      localFilePath,
      tapeNumber,
      requestedAt
    });

    tapeLogger.endOperation('download-processing');
    return { 
      success: true, 
      message: 'File downloaded and cached successfully',
      localFilePath: localFilePath,
      tapeNumber: tapeNumber
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    tapeLogger.logError('download_processing', new Error(errorMessage));
    await adminNotificationService.sendCriticalError('download_processing', new Error(errorMessage), { requestId, fileName });
    
    // Update request status to failed
    await databaseService.updateDownloadStatus(requestId, 'failed');
    
    // Try to send failure email
    try {
      await emailService.sendDownloadReadyEmail(userEmail, fileName, {
        status: 'failed',
        error: errorMessage
      });
    } catch (emailError) {
      const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
      tapeLogger.logError('email_notification', new Error(emailErrorMessage));
    }

    throw error;
  }
} 