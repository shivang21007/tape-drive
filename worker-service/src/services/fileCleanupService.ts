import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { tapeLogger } from '../utils/tapeLogger';

const CACHE_DURATION_DAYS = 7;
const CLEANUP_INTERVAL_HOURS = 24;

export class FileCleanupService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles';
  }

  public async startCleanupService() {
    logger.info('Starting file cleanup service');
    await this.cleanupOldFiles();
    setInterval(() => this.cleanupOldFiles(), CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
  }

  private async cleanupOldFiles() {
    try {
      tapeLogger.startOperation('file-cleanup');
      logger.info('Starting cleanup of old files');

      const now = Date.now();
      const cutoffTime = now - (CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // Recursively walk through the upload directory
      await this.cleanupDirectory(this.uploadDir, cutoffTime);

      logger.info('File cleanup completed successfully');
      tapeLogger.endOperation('file-cleanup');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during file cleanup:', error);
      tapeLogger.logError('file_cleanup', new Error(errorMessage));
    }
  }

  private async cleanupDirectory(dirPath: string, cutoffTime: number) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively clean up subdirectories
          await this.cleanupDirectory(fullPath, cutoffTime);
          
          // Check if directory is empty after cleanup
          const remainingEntries = await fs.readdir(fullPath);
          if (remainingEntries.length === 0) {
            await fs.rmdir(fullPath);
          }
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          if (stats.mtimeMs < cutoffTime) {
            await fs.unlink(fullPath);
            logger.info(`Deleted old file: ${fullPath}`);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error cleaning up directory ${dirPath}:`, error);
      tapeLogger.logError('file_cleanup', new Error(errorMessage));
    }
  }
} 