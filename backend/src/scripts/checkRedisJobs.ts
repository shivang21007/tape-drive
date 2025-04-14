import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkRedisJobs() {
  const client = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD,
  });

  try {
    await client.connect();
    console.log('Connected to Redis');

    const queueName = 'file-processing';

    // Get all keys for the queue
    const keys = await client.keys(`bull:${queueName}:*`);
    console.log('\nQueue Keys:');
    console.log('----------------');
    for (const key of keys) {
      const type = await client.type(key);
      const value = await getValueByType(client, key, type);
      console.log(`\nKey: ${key}`);
      console.log(`Type: ${type}`);
      console.log('Value:', value);
    }

    // Get job details
    const jobKeys = keys.filter(key => key.match(/bull:file-processing:\d+$/));
    
    if (jobKeys.length > 0) {
      console.log('\nDetailed Job Information:');
      console.log('------------------------');
      
      for (const jobKey of jobKeys) {
        const jobData = await client.hGetAll(jobKey);
        if (jobData && Object.keys(jobData).length > 0) {
          try {
            console.log(`\nJob ID: ${jobKey.split(':').pop()}`);
            
            // Parse the data field
            const data = JSON.parse(jobData.data || '{}');
            console.log('File Data:');
            console.log('  File ID:', data.fileId);
            console.log('  File Name:', data.fileName);
            console.log('  File Size:', data.fileSize);
            console.log('  User:', data.userName);
            console.log('  Group:', data.groupName);
            console.log('  Is Admin:', data.isAdmin);
            console.log('  File Path:', data.filePath);
            
            // Parse the opts field
            const opts = JSON.parse(jobData.opts || '{}');
            console.log('\nJob Options:');
            console.log('  Priority:', opts.priority || 'normal');
            console.log('  Attempts:', opts.attempts);
            if (opts.backoff) {
              console.log('  Backoff:', opts.backoff);
            }
            
            console.log('\nJob Status:');
            console.log('  Name:', jobData.name);
            console.log('  Created:', new Date(parseInt(jobData.timestamp)).toLocaleString());
            console.log('  Status:', getJobStatus(jobData));
            
            if (jobData.processedOn) {
              console.log('  Processed:', new Date(parseInt(jobData.processedOn)).toLocaleString());
            }
            if (jobData.finishedOn) {
              console.log('  Finished:', new Date(parseInt(jobData.finishedOn)).toLocaleString());
            }
            if (jobData.failedReason) {
              console.log('  Failed Reason:', jobData.failedReason);
            }
            if (jobData.stacktrace) {
              const stacktrace = JSON.parse(jobData.stacktrace);
              if (stacktrace.length > 0) {
                console.log('  Error Stack:', stacktrace[0]);
              }
            }
          } catch (error) {
            console.log('Raw job data:', jobData);
          }
        }
      }
    } else {
      console.log('\nNo jobs found in the queue');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function getValueByType(client: any, key: string, type: string) {
  switch (type) {
    case 'string':
      return await client.get(key);
    case 'list':
      return await client.lRange(key, 0, -1);
    case 'set':
      return await client.sMembers(key);
    case 'zset':
      return await client.zRange(key, 0, -1);
    case 'hash':
      return await client.hGetAll(key);
    default:
      return `[Type ${type} not handled]`;
  }
}

function getJobStatus(job: any) {
  if (job.finishedOn) return 'completed';
  if (job.failedReason) return 'failed';
  if (job.processedOn) return 'active';
  return 'waiting';
}

checkRedisJobs(); 