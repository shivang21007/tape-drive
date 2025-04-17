import { Worker } from 'bullmq';
import { fileQueue } from './queue/fileQueue';
import { processFile } from './processors/fileProcessor';
import { processDownload } from './processors/downloadProcessor';
import { logger } from './utils/logger';
import { FileProcessingJob } from './types/fileProcessing';
import { DownloadProcessingJob } from './types/downloadProcessing';
import dotenv from 'dotenv';

dotenv.config();

async function startWorker() {
  try {
    logger.info('Starting file processing worker...');

    const worker = new Worker(
      'file-processing',
      async (job) => {
        try {
          logger.info(`Processing job ${job.id}: ${job.name}`);
          // logger.info('Job data:', job.data);

          if (job.name === 'file-processing') {
            return await processFile(job.data as FileProcessingJob);
          } else if (job.name === 'download') {
            return await processDownload(job.data as DownloadProcessingJob);
          } else {
            throw new Error(`Unknown job type: ${job.name}`);
          }
        } catch (error) {
          logger.error(`Job ${job.id} failed:`, error);
          throw error;
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD
        },
        limiter: {
          max: 1,
          duration: 1000
        },
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            return Math.min(attemptsMade * 1000, 10000);
          }
        },
        maxStalledCount: 3 // Maximum number of times a job can be retried
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

    worker.on('stalled', (jobId) => {
      logger.warn(`Job ${jobId} stalled`);
    });

    logger.info('Worker started successfully');
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker(); 