import { DownloadProcessingJob } from '../types/downloadProcessing';
import { TapeManager } from '../services/tapeManager';
import { DatabaseService } from '../services/databaseService';
import { EmailService } from '../services/emailService';
import { AdminNotificationService } from '../services/adminNotificationService';
import { tapeLogger } from '../utils/tapeLogger';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const tapeManager = new TapeManager();
const databaseService = new DatabaseService();
const emailService = new EmailService();
const adminNotificationService = new AdminNotificationService();

export async function processDownload(job: DownloadProcessingJob) {
  const { requestId, fileId, fileName, userName, userEmail, groupName, tapeLocation, tapeNumber } = job;

  try {
    tapeLogger.startOperation('download-processing');
    logger.info(`Processing download request ${requestId} for file: ${fileName}`);

    // Update request status to processing
    await databaseService.updateDownloadRequestStatus(requestId, 'processing');

    try {
      // Check if we need to switch tapes
      const currentTape = await tapeManager.getCurrentTape();
      if (currentTape !== tapeNumber) {
        tapeLogger.startOperation('tape_switch');
        try {
          // Unmount current tape if mounted
          if (currentTape) {
            await tapeManager.unmountTape();
          }
          
          // Load and mount new tape
          await tapeManager.loadTape(tapeNumber);
          await tapeManager.mountTape();
          tapeLogger.endOperation('tape_switch');
        } catch (error) {
          tapeLogger.logError('tape_switch', error as Error);
          throw error;
        }
      }

      // Create local file path
      const localPath = path.join(process.env.UPLOAD_DIR || 
        '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles', groupName, userName, fileName);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      // Copy file from tape to local storage
      tapeLogger.startOperation('file-copy');
      await fs.copyFile(tapeLocation, localPath);
      tapeLogger.endOperation('file-copy');

      // Verify the copy
      tapeLogger.startOperation('file-verification');
      const sourceStats = await fs.stat(tapeLocation);
      const destStats = await fs.stat(localPath);
      
      if (sourceStats.size !== destStats.size) {
        await fs.unlink(localPath);
        throw new Error('File verification failed: size mismatch');
      }
      tapeLogger.endOperation('file-verification');

      // Update download request with local path and completed status
      await databaseService.updateDownloadRequestStatus(
        requestId,
        'completed',
        localPath
      );

      // Send email notification
      await emailService.sendDownloadAvailableEmail(
        userEmail,
        userName,
        fileName
      );

      tapeLogger.endOperation('download-processing');
      return { 
        success: true, 
        message: 'File downloaded successfully',
        localPath
      };
    } catch (error) {
      // Log the error and notify admin
      const operation = error instanceof Error ? error.message : 'Unknown operation';
      tapeLogger.logError(operation, error as Error);
      
      if (tapeLogger.trackFailure(operation)) {
        await adminNotificationService.sendRepeatedFailureAlert(
          operation,
          tapeLogger.trackFailure(operation) ? 3 : 1,
          error as Error
        );
      }

      // Update request status to failed
      await databaseService.updateDownloadRequestStatus(requestId, 'failed');

      // Try to send failure email to user
      try {
        await emailService.sendDownloadAvailableEmail(
          userEmail,
          userName,
          fileName
        );
      } catch (emailError) {
        logger.error('Failed to send failure email:', emailError);
      }

      // Notify admin of critical error
      await adminNotificationService.sendCriticalError(
        'download-processing',
        error as Error,
        job
      );

      // Re-throw the error to stop the worker
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to process download request ${requestId}:`, error);
    throw error;
  }
} 