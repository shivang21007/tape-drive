import { Worker, Job } from 'bullmq';
import { DatabaseService } from './services/databaseService';
import { SecureCopyUploadJob, SecureCopyDownloadJob } from './types/fileProcessing';
import dotenv from 'dotenv';
import secureCopyLogger, { logSecureCopyOperation, logVerification } from './utils/secureCopyLogger';
import { processSecureUpload } from './scpProcessorsWorker/secureUpload';
import { processSecureDownload } from './scpProcessorsWorker/secureDownload';
dotenv.config();

const worker = new Worker<SecureCopyUploadJob | SecureCopyDownloadJob>(
    'SecureCopy', async (job: Job<SecureCopyUploadJob | SecureCopyDownloadJob>, helpers) => {
        const jobData = job.data;
        try {
            logSecureCopyOperation(`Processing job: ${job.id} (${jobData.type})`);
            switch (jobData.type) {
                case 'upload':
                    return await processSecureUpload(jobData, helpers);
                case 'download':
                    return await processSecureDownload(jobData, helpers);
                default:
                    throw new Error(`Unknown job type: ${(jobData as any).type}`);
            }
        } catch (error) {
            secureCopyLogger.error(`Failed to process job ${job.id} (${jobData.type}):`, error);
            throw error;
        }
    },
    {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD
        },
        concurrency: 1,
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
    }
);

worker.on('completed', (job) => {
    logSecureCopyOperation('job-complete', {
        sourcePath: job.data.filePath,
        destPath: 'completed',
        groupName: job.data.groupName,
        userName: job.data.userName,
        status: 'completed'
    });
});

worker.on('failed', (job, error) => {
    logSecureCopyOperation('job-failed', {
        sourcePath: job?.data.filePath || 'unknown',
        destPath: 'failed',
        groupName: job?.data.groupName,
        userName: job?.data.userName,
        status: 'failed',
        error: error as Error
    });
});

worker.on('error', (error) => {
    logSecureCopyOperation('worker-error', {
        sourcePath: 'unknown',
        destPath: 'failed',
        status: 'failed',
        error: error as Error
    });
});

worker.on('stalled', (jobId) => {
    logSecureCopyOperation('job-stalled', {
        sourcePath: 'unknown',
        destPath: 'stalled',
        status: 'failed',
        error: new Error(`Job ${jobId} stalled`)
    });
});

worker.on('active', (job) => {
    logSecureCopyOperation('job-start', {
        sourcePath: job.data.filePath,
        destPath: 'processing',
        groupName: job.data.groupName,
        userName: job.data.userName,
        status: 'started'
    });
});

worker.on('progress', (job, progress) => {
    logSecureCopyOperation('job-progress', {
        sourcePath: job.data.filePath,
        destPath: 'processing',
        groupName: job.data.groupName,
        userName: job.data.userName,
        status: 'started'
    });
});

logSecureCopyOperation('worker-start', {
    sourcePath: 'none',
    destPath: 'ready',
    status: 'completed'
});
