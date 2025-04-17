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
      
      // Create group directory if it doesn't exist
      const groupDir = path.join(tapeManager.mountPoint, groupName);
      try {
        await fs.mkdir(groupDir, { recursive: true });
        logger.info(`Created/verified group directory: ${groupDir}`);
      } catch (error) {
        logger.error(`Failed to create group directory: ${groupDir}`, error);
        throw new Error(`Failed to create group directory for tape ${currentTape}`);
      }
      
      // Add delay to ensure tape is stable
      await new Promise(resolve => setTimeout(resolve, 5000));
      tapeLogger.endOperation('tape-mounting');

      // Create tape path and copy file
      tapeLogger.startOperation('file-copy');
      const tapePath = await tapeManager.createTapePath(job);
      logger.info(`Copying file to tape path: ${tapePath}`);
      await fs.copyFile(filePath, tapePath);
      logger.info('File copied successfully');
      tapeLogger.endOperation('file-copy');

      // Add delay before verification
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the copy
      tapeLogger.startOperation('file-verification');
      const sourceStats = await fs.stat(filePath);
      const destStats = await fs.stat(tapePath);
      
      logger.info(`Source file size: ${sourceStats.size}, Destination file size: ${destStats.size}`);
      
      if (sourceStats.size !== destStats.size) {
        logger.error('File verification failed: size mismatch');
        await fs.unlink(tapePath);
        throw new Error('File verification failed: size mismatch');
      }
      logger.info('File verification successful');
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      tapeLogger.logError('file_processing', new Error(errorMessage));
      await adminNotificationService.sendCriticalError('file_processing', new Error(errorMessage), { fileId, fileName });
      
      // Update status to failed
      await databaseService.updateUploadStatus(fileId, 'failed');
      
      // Try to send failure email
      try {
        const userEmail = await databaseService.getUserEmail(fileId);
        await emailService.sendFileProcessedEmail(userEmail, fileName, 'failed');
      } catch (emailError) {
        const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
        tapeLogger.logError('email_notification', new Error(emailErrorMessage));
      }

      throw error;
    } finally {
      // Clean up local file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        const unlinkErrorMessage = unlinkError instanceof Error ? unlinkError.message : 'Unknown error';
        tapeLogger.logError('file_cleanup', new Error(unlinkErrorMessage));
      }
    }
  } catch (error) {
    logger.error(`Failed to process file ${fileName}:`, error);
    throw error;
  }
} 