import { Worker } from 'bullmq';
import { fileQueue } from './queue/fileQueue';
import { processFile } from './processors/fileProcessor';
import { logger } from './utils/logger';
import { FileProcessingJob } from './types/fileProcessing';

async function startWorker() {
  try {
    logger.info('Starting file processing worker...');

    const worker = new Worker<FileProcessingJob>(
      'file-processing',
      async (job) => {
        try {
          logger.info(`Processing job ${job.id}: ${job.data.fileName}`);
          
          // Process the file - email sending is handled inside processFile
          const result = await processFile(job.data);
          
          return result;
        } catch (error) {
          // Error handling and email sending is handled inside processFile
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