import winston from 'winston';
import path from 'path';

// Create a dedicated logger for tape operations
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'tape-operations.log'),
      level: 'info'
    }),
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'tape-errors.log'),
      level: 'error'
    })
  ]
});

// Track operation timing
const operationTimers = new Map<string, number>();

class TapeLogger {
  private failureCounts = new Map<string, number>();
  private readonly MAX_FAILURES = 3;

  startOperation(operation: string): void {
    operationTimers.set(operation, Date.now());
    winstonLogger.info(`Starting operation: ${operation}`);
  }

  endOperation(operation: string): void {
    const startTime = operationTimers.get(operation);
    if (startTime) {
      const duration = Date.now() - startTime;
      winstonLogger.info(`Completed operation: ${operation}`, { duration });
      operationTimers.delete(operation);
    }
  }

  logError(operation: string, error: Error): void {
    winstonLogger.error(`Tape operation failed: ${operation}`, {
      error: error.message,
      stack: error.stack
    });
  }

  trackFailure(operation: string): boolean {
    const count = (this.failureCounts.get(operation) || 0) + 1;
    this.failureCounts.set(operation, count);
    
    if (count >= this.MAX_FAILURES) {
      winstonLogger.error(`Repeated failures detected for operation: ${operation}`, {
        failureCount: count
      });
      return true; // Indicates alert needed
    }
    return false;
  }

  resetFailureCount(operation: string): void {
    this.failureCounts.delete(operation);
  }
}

export const tapeLogger = new TapeLogger(); 