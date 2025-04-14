import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create MySQL connection pool
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

// Create upload_details table if it doesn't exist
const createUploadDetailsTable = `
  CREATE TABLE IF NOT EXISTS upload_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`;

// Test database connection and create tables
export async function testConnections() {
  try {
    const connection = await mysqlPool.getConnection();
    console.log('MySQL connection successful');
    
    // Create upload_details table
    await connection.query(createUploadDetailsTable);
    console.log('Upload details table verified/created');
    
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
} 