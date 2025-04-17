import { Queue } from 'bullmq';
import { FileProcessingJob } from '../types/fileProcessing';
import dotenv from 'dotenv';

dotenv.config();

const fileQueue = new Queue<FileProcessingJob>('file-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    priority: 1
  }
});

export { fileQueue }; 