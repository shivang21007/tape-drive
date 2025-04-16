import { Queue } from 'bullmq';
import { FileProcessingJob } from '../types/fileProcessing';

const fileQueue = new Queue<FileProcessingJob>('file-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

export { fileQueue }; 