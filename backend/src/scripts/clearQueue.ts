import { Queue } from 'bullmq';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function clearQueue() {
  try {
    console.log('Starting queue cleanup...');

    // Initialize the queue
    const queue = new Queue('file-processing', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    });

    // Get all job counts
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    console.log('Current queue state:', counts);

    // Remove all jobs from different states
    await queue.clean(0, 0, 'completed');
    await queue.clean(0, 0, 'failed');
    await queue.clean(0, 0, 'wait');
    await queue.clean(0, 0, 'active');
    await queue.clean(0, 0, 'delayed');
    await queue.clean(0, 0, 'paused');

    // Get final counts
    const finalCounts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    console.log('Queue state after cleanup:', finalCounts);
    console.log('Queue cleanup completed successfully');

    await queue.close();
  } catch (error) {
    console.log('Failed to clear queue:', error);
    process.exit(1);
  }
}

// Run the cleanup
clearQueue().catch(error => {
  console.log('Script failed:', error);
  process.exit(1);
}); 