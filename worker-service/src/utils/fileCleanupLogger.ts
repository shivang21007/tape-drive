import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

const LOG_DIR = path.join(process.cwd(), 'logs', 'fileCleanupLogs');

export class FileCleanupLogger {
  private static instance: FileCleanupLogger;
  private logFile: string;

  private constructor() {
    this.logFile = path.join(LOG_DIR, `cleanup_${new Date().toISOString().split('T')[0]}.log`);
    this.initializeLogDirectory();
  }

  public static getInstance(): FileCleanupLogger {
    if (!FileCleanupLogger.instance) {
      FileCleanupLogger.instance = new FileCleanupLogger();
    }
    return FileCleanupLogger.instance;
  }

  private async initializeLogDirectory() {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create file cleanup log directory:', error);
    }
  }

  public async logOperation(operation: string, details: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      details
    };

    try {
      await fs.appendFile(
        this.logFile,
        JSON.stringify(logEntry) + '\n',
        'utf8'
      );
    } catch (error) {
      logger.error('Failed to write to file cleanup log:', error);
    }
  }

  public async logError(operation: string, error: Error) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      error: {
        message: error.message,
        stack: error.stack
      }
    };

    try {
      await fs.appendFile(
        this.logFile,
        JSON.stringify(logEntry) + '\n',
        'utf8'
      );
    } catch (err) {
      logger.error('Failed to write error to file cleanup log:', err);
    }
  }

  public async startOperation(operation: string) {
    await this.logOperation(operation, { status: 'started' });
  }

  public async endOperation(operation: string) {
    await this.logOperation(operation, { status: 'completed' });
  }
} 