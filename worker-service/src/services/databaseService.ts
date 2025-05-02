import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: mysql.Pool;

  private constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'tape_storage',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Handle pool errors
    this.pool.on('connection', (connection) => {
      connection.on('error', (err) => {
        logger.error('Database connection error:', err);
      });
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async updateUploadStatus(fileId: number, status: 'queueing' | 'processing' | 'completed' | 'failed', localFilePath?: string, fileSize?: string, tapeLocation?: string, tapeNumber?: string): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      
      try {
        if (status === 'completed' && tapeLocation && tapeNumber) {
          await connection.query(
            'UPDATE upload_details SET status = ?, tape_location = ?, tape_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, tapeLocation, tapeNumber, fileId]
          );
        } else if (status === 'queueing') {
          await connection.query(
            'UPDATE upload_details SET status = ?, local_file_location = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, localFilePath, fileSize, fileId]
          );
        } else {
          await connection.query(
            'UPDATE upload_details SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, fileId]
          );
        }
        
        logger.info(`Updated upload status for file ${fileId} to ${status}`);
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error(`Failed to update upload status for file ${fileId}:`, error);
      throw error;
    }
  }

  async getUserEmail(fileId: number): Promise<string> {
    try {
      const connection = await this.pool.getConnection();
      
      try {
        const [rows] = await connection.query(
          'SELECT u.email FROM upload_details ud JOIN users u ON ud.user_name = u.name WHERE ud.id = ?',
          [fileId]
        );

        if (!rows || (rows as any[]).length === 0) {
          throw new Error(`User not found for file ${fileId}`);
        }

        return (rows as any[])[0].email;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error(`Failed to get user email for file ${fileId}:`, error);
      throw error;
    }
  }

  async updateDownloadRequestStatus(
    requestId: number,
    status: 'none' | 'requested' | 'processing' | 'completed' | 'failed',
    localPath?: string
  ): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      if (status === 'completed' && localPath) {
        await connection.query(
          'UPDATE download_requests SET status = ?, local_file_location = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, localPath, requestId]
        );
      } else {
        await connection.query(
          'UPDATE download_requests SET status = ? WHERE id = ?',
          [status, requestId]
        );
      }
      logger.info(`Updated download request ${requestId} status to ${status}`);
    } finally {
      connection.release();
    }
  }

  public async updateDownloadStatus(
    requestId: number, 
    status: 'none' | 'requested' | 'processing' | 'completed' | 'failed', 
    servedFrom?: 'cache' | 'tape'
  ) {
    const connection = await this.pool.getConnection();
    try {
      let result;
      if (status === 'completed') {
        [result] = await connection.query(
          'UPDATE download_requests SET status = ?, served_from = ?, completed_at = ? WHERE id = ?',
          [status, servedFrom, new Date(), requestId]
        );
      } else {
        [result] = await connection.query(
          'UPDATE download_requests SET status = ? WHERE id = ?',
          [status, requestId]
        );
      }
      return result;
    } finally {
      connection.release();
    }
  }

  public async updateUploadLocalFileLocation(fileId: number, localFilePath: string) {
    const connection = await this.pool.getConnection();
    try {
      await connection.query(
        'UPDATE upload_details SET local_file_location = ? WHERE id = ?',
        [localFilePath, fileId]
      );
    } finally {
      connection.release();
    }
  }

  public async getUploadDetails(fileId: number) {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT * FROM upload_details WHERE id = ?',
        [fileId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  public async getDownloadRequest(requestId: number) {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT * FROM download_requests WHERE id = ?',
        [requestId]
      );
      return rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    } finally {
      connection.release();
    }
  }

  async updateTapeInfo(
    tapeNumber: string,
    totalSize: string,
    usedSize: string,
    availableSize: string,
    usagePercentage: number,
    filesystem: string
  ): Promise<void> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.query(
        `UPDATE tape_info 
         SET total_size = ?,
             used_size = ?,
             available_size = ?,
             usage_percentage = ?,
             filesystem = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE tape_no = ?`,
        [totalSize, usedSize, availableSize, usagePercentage, filesystem, tapeNumber]
      );
    } catch (error) {
      logger.error('Error updating tape info:', error);
      // Don't throw the error as it shouldn't stop the process
    } finally {
      connection.release();
    }
  }

  public async getTapeInfo(tapeNumber: string) {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT * FROM tape_info WHERE tape_no = ?',
        [tapeNumber]
      );
      return rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    } finally {
      connection.release();
    }
  }

  public async getGroupTapes(groupName: string): Promise<string[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT tape_no FROM tape_info WHERE group_name = ? ORDER BY usage_percentage ASC',
        [groupName]
      );
      return (rows as any[]).map(row => row.tape_no);
    } finally {
      connection.release();
    }
  }
} 