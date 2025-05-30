import { Worker } from 'bullmq';
import { processTapeUpload } from './tapeProcessorsWorker/uploadProcessor';
import { processTapeDownload } from './tapeProcessorsWorker/downloadProcessor';
import { logger } from './utils/logger';
import { ProcessingJob } from './types/jobs';
import dotenv from 'dotenv';
import { FileCleanupService } from './services/fileCleanupService';

dotenv.config();

const worker = new Worker('file-processing', async (job) => {
  const jobData = job.data as ProcessingJob;
  
  try {
    logger.info(`Processing job: ${job.id} (${jobData.type})`);
    
    switch (jobData.type) {
      case 'upload':
        await processTapeUpload(jobData);
        break;
      case 'download':
        await processTapeDownload(jobData);
        break;
      default:
        throw new Error(`Unknown job type: ${(jobData as any).type}`);
    }
    
    logger.info(`Completed job: ${job.id} (${jobData.type})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to process job ${job.id} (${jobData.type}):`, errorMessage);
    
    // Log additional context for debugging
    logger.error('Job data:', {
      type: jobData.type,
      fileName: jobData.fileName,
      userName: jobData.userName,
      groupName: jobData.groupName
    });
    
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  concurrency: 1, // Ensure only one job is processed at a time
  limiter: {
    max: 1,
    duration: 1000
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      return Math.min(attemptsMade * 1000, 10000);
    }
  },
  maxStalledCount: 1
});

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

// Initialize cleanup service
const cleanupService = new FileCleanupService();
cleanupService.startCleanupService().catch(error => {
  logger.error('Failed to start cleanup service:', error);
});

logger.info('Worker service started');