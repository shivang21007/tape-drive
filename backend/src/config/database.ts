import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// MySQL Configuration
export const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connections
export const testConnections = async () => {
  try {
    // Test MySQL connection
    const connection = await mysqlPool.getConnection();
    console.log('MySQL connection successful');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}; 