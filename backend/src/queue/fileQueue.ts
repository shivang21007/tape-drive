import { Queue } from 'bullmq';

export interface FileProcessingJob {
  fileId: number;
  fileName: string;
  fileSize: string;
  userName: string;
  groupName: string;
  isAdmin: boolean;
  filePath: string;
  requestedAt: number;
}

export const fileQueue = new Queue('file-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    priority: 1, // Default priority
  },
}); 



export const secureCopyQueue = new Queue('SecureCopy', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});