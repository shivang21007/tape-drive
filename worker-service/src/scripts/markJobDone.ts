import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

async function markJobDone(jobId: string) {
  const queue = new Queue('file-processing', {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || 'admin@123'
    }
  });

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      logger.error(`Job with ID ${jobId} not found`);
      return;
    }

    await job.moveToCompleted('Manually marked as done', '', true);
    logger.info(`Successfully marked job ${jobId} as completed`);
  } catch (error) {
    logger.error(`Error marking job ${jobId} as done:`, error);
  } finally {
    await queue.close();
  }
}

// Get job ID from command line argument
const jobId = process.argv[2];
if (!jobId) {
  logger.error('Please provide a job ID as an argument');
  process.exit(1);
}

markJobDone(jobId).then(() => {
  process.exit(0);
}).catch((error) => {
  logger.error('Script failed:', error);
  process.exit(1);
}); 