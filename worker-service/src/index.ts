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
          logger.info('Job data:', job.data);

          // Check job type from data
          if (job.data.type === 'download') {
            // Handle file download processing
            return await processDownload(job.data as DownloadProcessingJob);
          } else {
            // Handle file upload processing
            return await processFile(job.data as FileProcessingJob);
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
        concurrency: 1, // Process one job at a time
        lockDuration: 30000, // 30 seconds
        removeOnComplete: {
          age: 3600 // Remove completed jobs after 1 hour
        },
        removeOnFail: {
          age: 24 * 3600 * 5 //// Remove failed jobs after 5 days
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