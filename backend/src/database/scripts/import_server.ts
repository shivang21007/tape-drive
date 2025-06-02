import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
dotenv.config();
interface ServerRecord {
  group: string;
  server_name: string;
  private_ip: string;
}

const CSV_FILE = process.env.SERVER_LIST_CSV || path.join(__dirname, '../../IP-Address-Allocation.csv');

async function loadCSV(filePath: string): Promise<ServerRecord[]> {
  return new Promise((resolve, reject) => {
    const results: ServerRecord[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row: ServerRecord) => {
        // Only include records that have all required fields and group is not '_'
        if (row.group && row.group !== '_' && row.server_name && row.private_ip) {
          results.push({
            group: row.group,
            server_name: row.server_name,
            private_ip: row.private_ip
          });
        }
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function insertServers(data: ServerRecord[]) {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'tape_drive'
  });

  try {
    // First, clear existing data
    await connection.execute('DELETE FROM server_info');

    // Prepare the insert query
    const insertQuery = `
      INSERT INTO server_info (server_name, server_ip, group_name)
      VALUES (?, ?, ?)
    `;

    // Insert each server record
    for (const server of data) {
      try {
        await connection.execute(insertQuery, [
          server.server_name,
          server.private_ip,
          server.group
        ]);
        console.log(`Inserted: ${server.server_name} (${server.group})`);
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error inserting ${server.server_name}:`, err.message);
        } else {
          console.error(`Error inserting ${server.server_name}: Unknown error`);
        }
      }
    }

    console.log('Server import completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Database error:', error.message);
    } else {
      console.error('Unknown database error');
    }
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    console.log('Starting server import process...');
    const servers = await loadCSV(CSV_FILE);
    console.log(`Found ${servers.length} valid server records`);
    await insertServers(servers);
    console.log('Server import completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to import servers:', error.message);
    } else {
      console.error('Failed to import servers: Unknown error');
    }
    process.exit(1);
  }
}

main();
