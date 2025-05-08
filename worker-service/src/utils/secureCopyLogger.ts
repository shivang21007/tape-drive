import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs', 'secure-copy');
fs.ensureDirSync(logsDir);

// Create a format for secure copy logs
const secureCopyFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const secureCopyLogger = winston.createLogger({
  level: 'info',
  format: secureCopyFormat,
  defaultMeta: { service: 'secure-copy-worker' },
  transports: [
    // Write all logs to secure-copy.log with rotation
    new DailyRotateFile({
      filename: path.join(logsDir, 'secure-copy-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '30d',
      format: secureCopyFormat
    }),
    // Write error logs to secure-copy-error.log with rotation
    new DailyRotateFile({
      filename: path.join(logsDir, 'secure-copy-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '30d',
      level: 'error',
      format: secureCopyFormat
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  secureCopyLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper methods for secure copy operations
export const logSecureCopyOperation = (
  operation: string,
  details: {
    sourcePath: string;
    destPath: string;
    fileSize?: number;
    tapeNumber?: string;
    groupName?: string;
    userName?: string;
    status: 'started' | 'completed' | 'failed';
    error?: Error;
  }
) => {
  const logData = {
    operation,
    ...details,
    timestamp: new Date().toISOString()
  };

  if (details.status === 'failed' && details.error) {
    secureCopyLogger.error('Secure copy operation failed', logData);
  } else if (details.status === 'completed') {
    secureCopyLogger.info('Secure copy operation completed', logData);
  } else {
    secureCopyLogger.info('Secure copy operation started', logData);
  }
};

// Helper for logging tape operations
export const logTapeOperation = (
  operation: string,
  details: {
    tapeNumber: string;
    action: 'mount' | 'unmount' | 'load' | 'unload';
    status: 'started' | 'completed' | 'failed';
    error?: Error;
  }
) => {
  const logData = {
    operation: `tape-${operation}`,
    ...details,
    timestamp: new Date().toISOString()
  };

  if (details.status === 'failed' && details.error) {
    secureCopyLogger.error('Tape operation failed', logData);
  } else if (details.status === 'completed') {
    secureCopyLogger.info('Tape operation completed', logData);
  } else {
    secureCopyLogger.info('Tape operation started', logData);
  }
};

// Helper for logging verification operations
export const logVerification = (
  operation: string,
  details: {
    filePath: string;
    expectedSize: number;
    actualSize: number;
    status: 'started' | 'completed' | 'failed';
    error?: Error;
  }
) => {
  const logData = {
    operation: `verification-${operation}`,
    ...details,
    timestamp: new Date().toISOString()
  };

  if (details.status === 'failed' && details.error) {
    secureCopyLogger.error('Verification failed', logData);
  } else if (details.status === 'completed') {
    secureCopyLogger.info('Verification completed', logData);
  } else {
    secureCopyLogger.info('Verification started', logData);
  }
};

export default secureCopyLogger; 