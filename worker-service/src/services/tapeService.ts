import { logger } from '../utils/logger';
import { verifyFileCopy } from '../utils/fileUtils';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

export class TapeService {
  private tapeMountPath: string;

  constructor() {
    this.tapeMountPath = process.env.TAPE_MOUNT_PATH || '/home/octro/tapedata1';
  }

  async initialize(): Promise<void> {
    try {
      // Check if tape is mounted
      await fs.access(this.tapeMountPath);
      logger.info('Tape storage is mounted and accessible');
    } catch (error) {
      logger.error('Tape storage is not accessible:', error);
      throw new Error('Tape storage is not mounted or accessible');
    }
  }

  async copyToTape(localFilePath: string): Promise<string> {
    try {
      const fileName = path.basename(localFilePath);
      const tapeFilePath = path.join(this.tapeMountPath, fileName);

      // Check if file already exists on tape
      try {
        await fs.access(tapeFilePath);
        throw new Error(`File already exists on tape: ${fileName}`);
      } catch (error) {
        // File doesn't exist, which is what we want
      }

      // Copy file to tape
      logger.info(`Copying file to tape: ${fileName}`);
      await fs.copyFile(localFilePath, tapeFilePath);

      // Verify the copy
      const isVerified = await verifyFileCopy(localFilePath, tapeFilePath);
      if (!isVerified) {
        // Clean up the failed copy
        await fs.unlink(tapeFilePath).catch(() => {});
        throw new Error(`File verification failed for: ${fileName}`);
      }

      logger.info(`File successfully copied and verified: ${fileName}`);
      return tapeFilePath;
    } catch (error) {
      logger.error(`Error copying file to tape: ${path.basename(localFilePath)}`, error);
      throw error;
    }
  }

  async getFileFromTape(tapeFilePath: string, localDestinationPath: string): Promise<void> {
    try {
      const fileName = path.basename(tapeFilePath);

      // Verify file exists on tape
      await fs.access(tapeFilePath);

      // Copy file from tape
      logger.info(`Retrieving file from tape: ${fileName}`);
      await fs.copyFile(tapeFilePath, localDestinationPath);

      // Verify the copy
      const isVerified = await verifyFileCopy(tapeFilePath, localDestinationPath);
      if (!isVerified) {
        // Clean up the failed copy
        await fs.unlink(localDestinationPath).catch(() => {});
        throw new Error(`File verification failed for: ${fileName}`);
      }

      logger.info(`File successfully retrieved and verified: ${fileName}`);
    } catch (error) {
      logger.error(`Error retrieving file from tape: ${path.basename(tapeFilePath)}`, error);
      throw error;
    }
  }

  async checkTapeSpace(): Promise<{ total: number; free: number }> {
    try {
      const stats = await fs.statfs(this.tapeMountPath);
      return {
        total: stats.blocks * stats.bsize,
        free: stats.bfree * stats.bsize
      };
    } catch (error) {
      logger.error('Error checking tape space:', error);
      throw error;
    }
  }
} 