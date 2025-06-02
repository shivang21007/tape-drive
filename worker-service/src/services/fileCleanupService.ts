import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { FileCleanupLogger } from '../utils/fileCleanupLogger';
import { DatabaseService } from './databaseService';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_DURATION_DAYS = 7;
const CLEANUP_INTERVAL_HOURS = 24;

export class FileCleanupService {
  private uploadDir: string;
  private db: DatabaseService;
  private cleanupLogger: FileCleanupLogger;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles';
    this.db = DatabaseService.getInstance();
    this.cleanupLogger = FileCleanupLogger.getInstance();
  }

  public async startCleanupService() {
    logger.info('Starting file cleanup service');
    await this.cleanupOldFiles();
    setInterval(() => this.cleanupOldFiles(), CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
  }

  private async cleanupOldFiles() {
    try {
      await this.cleanupLogger.startOperation('file-cleanup');
      logger.info('Starting cleanup of old files');

      const now = Date.now();
      const cutoffTime = now - (CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // Recursively walk through the upload directory
      await this.cleanupDirectory(this.uploadDir, cutoffTime);

      logger.info('File cleanup completed successfully');
      await this.cleanupLogger.endOperation('file-cleanup');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during file cleanup:', error);
      await this.cleanupLogger.logError('file_cleanup', new Error(errorMessage));
    }
  }

  private async cleanupDirectory(dirPath: string, cutoffTime: number) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
  
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
  
        if (entry.isDirectory()) {
          // Check if we're at group/user/<folder> level (i.e. 3 levels deep)
          const relative = path.relative(this.uploadDir, fullPath);
          const pathParts = relative.split(path.sep);
        
          if (pathParts.length === 3) {
            const [groupName, userName, fileName] = pathParts;
        
            try {
              const stats = await fs.stat(fullPath);
              if (stats.mtimeMs < cutoffTime) {
                const exists = await this.db.checkFileExists(groupName, userName, fileName);
                if (exists) {
                  await this.db.markFileAsNotCached(groupName, userName, fileName);
                  await this.cleanupLogger.logOperation('folder-cleanup', {
                    path: `${groupName}/${userName}/${fileName}`,
                    action: 'marked-not-cached'
                  });
                  
                  // Recursively delete the folder
                  await fs.rm(fullPath, { recursive: true, force: true });
                  await this.cleanupLogger.logOperation('folder-cleanup', {
                    path: `${groupName}/${userName}/${fileName}`,
                    action: 'deleted'
                  });
                } else {
                  await this.cleanupLogger.logOperation('folder-cleanup', {
                    path: `${groupName}/${userName}/${fileName}`,
                    action: 'skipped',
                    reason: 'no-db-record'
                  });
                }
              }
            } catch (err) {
              logger.error(`Error handling folder ${fullPath}:`, err);
              await this.cleanupLogger.logError('folder-cleanup', err instanceof Error ? err : new Error(String(err)));
            }
        
          } else {
            // Recurse deeper to reach group/user level
            await this.cleanupDirectory(fullPath, cutoffTime);
          }
        }
        else if (entry.isFile()) {
          const relativePath = path.relative(this.uploadDir, fullPath);
          const pathParts = relativePath.split(path.sep);
          if (pathParts.length === 3) {
            // Only delete files directly under group/user/
            const [groupName, userName, fileName] = pathParts;
        
            try {
              const stats = await fs.stat(fullPath);
              if (stats.mtimeMs < cutoffTime) {
                const exists = await this.db.checkFileExists(groupName, userName, fileName);
        
                if (exists) {
                  await this.db.markFileAsNotCached(groupName, userName, fileName);
                  await this.cleanupLogger.logOperation('file-cleanup', {
                    path: `${groupName}/${userName}/${fileName}`,
                    action: 'marked-not-cached'
                  });
          
                  await fs.unlink(fullPath);
                  await this.cleanupLogger.logOperation('file-cleanup', {
                    path: `${groupName}/${userName}/${fileName}`,
                    action: 'deleted'
                  });
                } else {
                  await this.cleanupLogger.logOperation('file-cleanup', {
                    path: `${groupName}/${userName}/${fileName}`,
                    action: 'skipped',
                    reason: 'no-db-record'
                  });
                }
              }
            } catch (err) {
              logger.error(`Error handling file ${fullPath}:`, err);
              await this.cleanupLogger.logError('file-cleanup', err instanceof Error ? err : new Error(String(err)));
            }
          } else {
            logger.debug(`Skipping file ${fullPath} - not a direct group/user/file level`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error cleaning up directory ${dirPath}:`, error);
      await this.cleanupLogger.logError('directory-cleanup', error instanceof Error ? error : new Error(String(error)));
    }
  }  
} 
