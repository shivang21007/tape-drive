import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logsDir);

// Create a format for all logs
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'worker-service' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Error logs with rotation
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '30d',
      level: 'error',
      format: logFormat
    }),
    // Combined logs with rotation
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '30d',
      format: logFormat
    })
  ]
});

// Enhanced logging methods
const enhancedLogger = {
  ...logger,
  
  // Enhanced info logging with context
  info: (message: string, meta?: any) => {
    logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  },

  // Enhanced error logging with context
  error: (message: string, error?: Error | any, meta?: any) => {
    const errorInfo = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : { error };
    logger.error(message, { ...errorInfo, ...meta, timestamp: new Date().toISOString() });
  },

  // Enhanced warning logging with context
  warn: (message: string, meta?: any) => {
    logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  },

  // Enhanced debug logging with context
  debug: (message: string, meta?: any) => {
    logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
  },

  // Operation tracking
  startOperation: (operation: string, meta?: any) => {
    logger.info(`Starting operation: ${operation}`, { 
      operation,
      status: 'started',
      ...meta,
      timestamp: new Date().toISOString()
    });
  },

  endOperation: (operation: string, meta?: any) => {
    logger.info(`Completed operation: ${operation}`, {
      operation,
      status: 'completed',
      ...meta,
      timestamp: new Date().toISOString()
    });
  },

  // Error tracking with context
  logError: (operation: string, error: Error, meta?: any) => {
    logger.error(`Operation failed: ${operation}`, {
      operation,
      status: 'failed',
      error: error.message,
      stack: error.stack,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }
};

export { enhancedLogger as logger }; 