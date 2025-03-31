import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// MySQL Configuration
export const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

// Create MySQL connection pool
export const mysqlPool = mysql.createPool(mysqlConfig);

// Redis Configuration
export const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Test database connections
export const testConnections = async () => {
  try {
    // Test MySQL connection
    const connection = await mysqlPool.getConnection();
    console.log('MySQL connection successful');
    connection.release();

    // Test Redis connection
    await redisClient.ping();
    console.log('Redis connection successful');

    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}; 