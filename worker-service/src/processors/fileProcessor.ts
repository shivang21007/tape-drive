import { Job } from 'bullmq';
import { logger } from '../utils/logger';
import { tapeLogger } from '../utils/tapeLogger';
import { FileProcessingJob } from '../types/fileProcessing';
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

export async function processFile(job: FileProcessingJob) {
  const { fileId, fileName, fileSize, userName, groupName, isAdmin, filePath, requestedAt } = job;

  try {
    logger.info(`Processing file: ${fileName} (ID: ${fileId})`);
    tapeLogger.startOperation('file-processing');

    // Update status to processing
    await databaseService.updateUploadStatus(fileId, 'processing');

    try {
      // Ensure correct tape is loaded and mounted
      tapeLogger.startOperation('tape-mounting');
      const currentTape = await tapeManager.ensureCorrectTape(groupName);
      if (!currentTape) {
        throw new Error('Failed to get current tape number');
      }
      tapeLogger.endOperation('tape-mounting');

      // Create tape path and copy file
      tapeLogger.startOperation('file-copy');
      const tapePath = await tapeManager.createTapePath(job);
      await fs.copyFile(filePath, tapePath);
      tapeLogger.endOperation('file-copy');

      // Verify the copy
      tapeLogger.startOperation('file-verification');
      const sourceStats = await fs.stat(filePath);
      const destStats = await fs.stat(tapePath);
      
      if (sourceStats.size !== destStats.size) {
        await fs.unlink(tapePath);
        throw new Error('File verification failed: size mismatch');
      }
      tapeLogger.endOperation('file-verification');

      // Update database with tape location and tape number
      await databaseService.updateUploadStatus(
        fileId,
        'completed',
        tapePath,
        currentTape
      );

      // Get user email and send success notification
      const userEmail = await databaseService.getUserEmail(fileId);
      await emailService.sendFileProcessedEmail(userEmail, fileName, 'success', {
        tapeLocation: tapePath,
        tapeNumber: currentTape,
        requestedAt
      });

      tapeLogger.endOperation('file-processing');
      return { 
        success: true, 
        message: 'File processed and archived successfully',
        tapePath: tapePath,
        tapeNumber: currentTape
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

      // Update status to failed
      await databaseService.updateUploadStatus(fileId, 'failed');

      // Try to send failure email to user
      try {
        const userEmail = await databaseService.getUserEmail(fileId);
        await emailService.sendFileProcessedEmail(
          userEmail,
          fileName,
          'failed',
          { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
        );
      } catch (emailError) {
        logger.error('Failed to send failure email:', emailError);
      }

      // Notify admin of critical error
      await adminNotificationService.sendCriticalError(
        'file-processing',
        error as Error,
        job
      );

      // Re-throw the error to stop the worker
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to process file ${fileName}:`, error);
    throw error;
  }
} 