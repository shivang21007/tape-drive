import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const client = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
});

client.on('error', (err) => console.log('Redis Client Error', err));

async function testRedisConnection() {
  try {
    await client.connect();
    console.log('Successfully connected to Redis');
    
    // Test basic operations
    await client.set('test', 'value');
    const value = await client.get('test');
    console.log('Test value:', value);
    
    await client.disconnect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
}

testRedisConnection(); 