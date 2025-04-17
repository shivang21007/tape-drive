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
    console.log('✅ Connected to Redis');

    const queueName = 'file-processing';
    console.log('\n🔍 Checking queue:', queueName);

    // Get all BullMQ queue keys
    const keys = await client.keys(`bull:${queueName}:*`);
    console.log(`\n📊 Found ${keys.length} keys in queue`);

    // Get job IDs from the wait list
    const waitList = await client.lRange(`bull:${queueName}:wait`, 0, -1);
    const activeList = await client.lRange(`bull:${queueName}:active`, 0, -1);
    const completedList = await client.lRange(`bull:${queueName}:completed`, 0, -1);
    const failedList = await client.lRange(`bull:${queueName}:failed`, 0, -1);

    const allJobIds = [...waitList, ...activeList, ...completedList, ...failedList];
    
    if (allJobIds.length > 0) {
      console.log('\n📋 Job Details:');
      console.log('----------------');
      
      for (const jobId of allJobIds) {
        const jobKey = `bull:${queueName}:${jobId}`;
        const jobData = await client.hGetAll(jobKey);
        
        if (jobData && Object.keys(jobData).length > 0) {
          try {
            console.log(`\n🆔 Job ID: ${jobId}`);
            
            // Parse the data field
            const data = JSON.parse(jobData.data || '{}');
            console.log('\n📄 File Data:');
            console.log('  📝 Name:', data.fileName);
            console.log('  📦 Size:', data.fileSize);
            console.log('  👤 User:', data.userName);
            console.log('  👥 Group:', data.groupName);
            console.log('  📍 Path:', data.filePath);
            
            // Parse the opts field
            const opts = JSON.parse(jobData.opts || '{}');
            console.log('\n⚙️ Job Options:');
            console.log('  ⚡ Priority:', opts.priority || 'normal');
            console.log('  🔄 Attempts:', opts.attempts || '1');
            
            console.log('\n📊 Status:');
            const status = getJobStatus(jobData);
            console.log('  📍 Status:', status);
            console.log('  🕒 Created:', new Date(parseInt(jobData.timestamp)).toLocaleString());
            
            if (jobData.processedOn) {
              console.log('  ⏳ Processed:', new Date(parseInt(jobData.processedOn)).toLocaleString());
            }
            if (jobData.finishedOn) {
              console.log('  ✅ Finished:', new Date(parseInt(jobData.finishedOn)).toLocaleString());
            }
            if (jobData.failedReason) {
              console.log('  ❌ Failed Reason:', jobData.failedReason);
            }
            if (jobData.stacktrace) {
              const stacktrace = JSON.parse(jobData.stacktrace);
              if (stacktrace.length > 0) {
                console.log('  🔍 Error Stack:', stacktrace[0]);
              }
            }

            console.log('--------------------------------');
          } catch (error) {
            console.error('❌ Error parsing job data:', error);
            console.log('Raw job data:', jobData);
          }
        }
      }
    } else {
      console.log('\nℹ️ No jobs found in the queue');
    }

    // Check queue stats
    console.log('\n📈 Queue Statistics:');
    console.log('----------------');
    console.log(`⏳ Waiting: ${waitList.length}`);
    console.log(`🔄 Active: ${activeList.length}`);
    console.log(`✅ Completed: ${completedList.length}`);
    console.log(`❌ Failed: ${failedList.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
    console.log('\n👋 Disconnected from Redis');
  }
}

function getJobStatus(job: any) {
  if (job.finishedOn) return '✅ completed';
  if (job.failedReason) return '❌ failed';
  if (job.processedOn) return '🔄 active';
  return '⏳ waiting';
}

checkRedisJobs(); 