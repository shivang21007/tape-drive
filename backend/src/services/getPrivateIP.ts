import {mysqlPool} from '../database/config';

export async function getPrivateIp(serverName: string): Promise<string> {
    const connection = await mysqlPool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT server_ip FROM server_info WHERE server_name = ?',
        [serverName]
      );

      if (!rows || (rows as any[]).length === 0) {
        throw new Error(`Server not found: ${serverName}}`);
      }

      return (rows as any[])[0].server_ip;
    } catch (error) {
        console.error(`Failed to get private IP for server ${serverName}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }