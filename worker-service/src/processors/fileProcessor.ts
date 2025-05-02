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
  let currentTape: string | null = null;
  let tapePath: string | null = null;

  try {
    logger.info(`Processing file: ${fileName} (ID: ${fileId})`);
    tapeLogger.startOperation('file-processing');

    // Update status to processing
    await databaseService.updateUploadStatus(fileId, 'processing');

    // Verify source file
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      logger.info(`Source file verified: ${filePath} (${stats.size} bytes)`);
    } catch (error) {
      logger.error(`Source file not found: ${filePath}`, error);
      throw new Error(`Source file not found: ${filePath}`);
    }

    // Parse file size from string (e.g., "37.76 KB")
    const sizeMatch = fileSize.match(/^(\d+\.?\d*)\s*(KB|MB|GB)$/i);
    if (!sizeMatch) {
      throw new Error(`Invalid file size format: ${fileSize}`);
    }

    const sizeValue = parseFloat(sizeMatch[1]);
    const sizeUnit = sizeMatch[2].toUpperCase();
    
    // Convert to bytes
    let expectedSizeInBytes: number;
    switch (sizeUnit) {
      case 'KB':
        expectedSizeInBytes = sizeValue * 1024;
        break;
      case 'MB':
        expectedSizeInBytes = sizeValue * 1024 * 1024;
        break;
      case 'GB':
        expectedSizeInBytes = sizeValue * 1024 * 1024 * 1024;
        break;
      default:
        throw new Error(`Unsupported file size unit: ${sizeUnit}`);
    }

    const stats = await fs.stat(filePath);
    const actualSize = stats.size;
    
    // Allow 1% difference in file size
    const tolerance = expectedSizeInBytes * 0.01;
    if (Math.abs(actualSize - expectedSizeInBytes) > tolerance) {
      throw new Error(`Source file verification failed: File size mismatch: expected ${expectedSizeInBytes} bytes (${fileSize}), got ${actualSize} bytes`);
    }

    // Ensure correct tape is loaded and mounted
    tapeLogger.startOperation('tape-mounting');
    try {
      currentTape = await tapeManager.ensureCorrectTape(groupName);
      if (!currentTape) {
        throw new Error('Failed to get current tape number');
      }

      // Create group directory after tape is mounted
      const groupDir = path.join(tapeManager.mountPoint, groupName);
      try {
        await fs.mkdir(groupDir, { recursive: true });
        logger.info(`Created/verified group directory: ${groupDir}`);
      } catch (error) {
        logger.error(`Failed to create group directory: ${groupDir}`, error);
        throw new Error(`Failed to create group directory for tape ${currentTape}`);
      }

      // Add delay to ensure tape is stable
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      logger.error('Failed to mount tape:', error);
      throw new Error(`Failed to mount tape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    tapeLogger.endOperation('tape-mounting');

    // Create tape path and copy file
    tapeLogger.startOperation('file-copy');
    try {
      tapePath = await tapeManager.createTapePath(job);
      logger.info(`Copying file to tape path: ${tapePath}`);
      
      // Ensure parent directories exist
      await fs.mkdir(path.dirname(tapePath), { recursive: true });
      
      // Copy file to tape
      await fs.copyFile(filePath, tapePath);
      logger.info(`File copied to tape: ${tapePath}`);
    } catch (error) {
      logger.error('Failed to copy file to tape:', error);
      throw new Error(`Failed to copy file to tape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

    // After successful upload to tape, update tape info
    if (currentTape) {
      await tapeManager.updateTapeInfo(currentTape, databaseService);
    }
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
    
    // Clean up tape file if it exists
    if (tapePath) {
      try {
        await fs.unlink(tapePath);
      } catch (unlinkError) {
        logger.error(`Failed to clean up tape file: ${tapePath}`, unlinkError);
      }
    }
    
    // Try to send failure email
    try {
      const userEmail = await databaseService.getUserEmail(fileId);
      await emailService.sendFileProcessedEmail(userEmail, fileName, 'failed');
    } catch (emailError) {
      const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
      tapeLogger.logError('email_notification', new Error(emailErrorMessage));
    }

    throw error;
  }
} 