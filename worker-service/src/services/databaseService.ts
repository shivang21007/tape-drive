import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: mysql.Pool;

  private constructor() {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'ftp',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'user_management_storage',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

    logger.info('Initializing database connection with config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    });

    this.pool = mysql.createPool(dbConfig);

    // Test connection on startup
    this.testConnection();

    // Handle pool events
    this.pool.on('acquire', () => {
      logger.debug('Connection acquired from pool');
    });

    this.pool.on('release', () => {
      logger.debug('Connection released back to pool');
    });

    this.pool.on('enqueue', () => {
      logger.debug('Waiting for available connection slot');
    });
  }

  private async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      logger.info('Successfully connected to database');
      connection.release();
    } catch (error) {
      logger.error('Failed to connect to database:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Error ? (error as any).code : 'UNKNOWN'
      });
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async updateUploadStatus(fileId: number, status: 'queueing' | 'processing' | 'completed' | 'failed', localFilePath?: string, fileSize?: string, tapeLocation?: string, tapeNumber?: string, iscached?: boolean): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      
      try {
        if (status === 'completed' && tapeLocation && tapeNumber) {
          await connection.query(
            'UPDATE upload_details SET status = ?, tape_location = ?, tape_number = ?, iscached = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, tapeLocation, tapeNumber, iscached, fileId]
          );
        } else if (status === 'queueing') {
          await connection.query(
            'UPDATE upload_details SET status = ?, local_file_location = ?, file_size = ?, iscached = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, localFilePath, fileSize, iscached, fileId]
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

  public async updateUploadLocalFileLocation(fileId: number, localFilePath: string, iscached: boolean) {
    const connection = await this.pool.getConnection();
    try {
      await connection.query(
        'UPDATE upload_details SET local_file_location = ?, iscached = ? WHERE id = ?',
        [localFilePath, iscached, fileId]
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

  // Get private IP for a server based on group and server name
  public async getPrivateIp(group: string, serverName: string): Promise<string> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT server_ip FROM server_info WHERE group_name = ? AND server_name = ?',
        [group, serverName]
      );

      if (!rows || (rows as any[]).length === 0) {
        throw new Error(`Server not found: ${serverName} for group: ${group}`);
      }

      return (rows as any[])[0].server_ip;
    } catch (error) {
      logger.error(`Failed to get private IP for server ${serverName}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Add new methods for file cleanup
  public async checkFileExists(groupName: string, userName: string, fileName: string): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT id FROM upload_details WHERE group_name = ? AND user_name = ? AND file_name = ?',
        [groupName, userName, fileName]
      );
      return Array.isArray(rows) && rows.length > 0;
    } finally {
      connection.release();
    }
  }

  public async markFileAsNotCached(groupName: string, userName: string, fileName: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      const [result] = await connection.query(
        'UPDATE upload_details SET iscached = FALSE WHERE group_name = ? AND user_name = ? AND file_name = ?',
        [groupName, userName, fileName]
      );
      logger.debug(`Updated rows for ${groupName}/${userName}/${fileName}: ${(result as any).affectedRows}`);
    } finally {
      connection.release();
    }
  }
} 