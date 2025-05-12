import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// MySQL Configuration
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// Test database connection and create tables
export async function testConnections() {
  try {
    const connection = await mysqlPool.getConnection();
    console.log('MySQL connection successful');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
} 
// Redis Configuration
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('Redis connection error:', err));
redisClient.on('connect', () => console.log('Redis connection successful'));

export { mysqlPool, redisClient }; 