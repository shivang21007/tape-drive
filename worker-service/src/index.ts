import { Worker } from 'bullmq';
import { fileQueue } from './queue/fileQueue';
import { processFile } from './processors/fileProcessor';
import { logger } from './utils/logger';
import { EmailService } from './services/emailService';
import { FileProcessingJob } from './types/fileProcessing';

const emailService = new EmailService();

async function startWorker() {
  try {
    logger.info('Starting file processing worker...');

    const worker = new Worker<FileProcessingJob>(
      'file-processing',
      async (job) => {
        try {
          logger.info(`Processing job ${job.id}: ${job.data.fileName}`);
          
          // Process the file
          const result = await processFile(job.data);
          
          // Send success email
          await emailService.sendFileProcessedEmail(
            job.data.userEmail || 'admin@example.com',
            job.data.fileName,
            'success',
            {
              tapeLocation: result.tapePath,
              tapeNumber: result.tapeNumber,
              requestedAt: job.data.requestedAt
            }
          );
          
          return result;
        } catch (error) {
          // Send failure email
          await emailService.sendFileProcessedEmail(
            job.data.userEmail || 'admin@example.com',
            job.data.fileName,
            'failed',
            {
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              requestedAt: job.data.requestedAt
            }
          );
          
          throw error;
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD
        }
      }
    );

    // Handle worker events
    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed:`, error);
    });

    worker.on('error', (error) => {
      logger.error('Worker error:', error);
    });

    logger.info('Worker started successfully');
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker(); 