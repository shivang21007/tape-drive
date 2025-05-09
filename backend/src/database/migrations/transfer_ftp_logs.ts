// Required packages
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Format file size
const formatFileSize = (bytes: number | string | undefined): string => {
  if (bytes === undefined || bytes === null) return '0 B';
  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (isNaN(numBytes) || numBytes < 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = numBytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

// Group mapping function
const mapUsernameToGroupAndTape = (username: string): { group: string; tape: string } | null => {
  if (username === 'install_track') return { group: 'install_track', tape: '000011' };
  if (username === 'dgn') return { group: 'dgn_lts', tape: '000009' }; // Special case
  if (username === 'dgn_apr_may_jun') return { group: 'dgn_lts', tape: '000011' };
  if (username === 'dgn_lts') return { group: 'dgn_lts', tape: '000011' };
  if (username === 'dgn_ovs') return { group: 'dgn_ovs', tape: '000011' };
  if (username.startsWith('nfsdata')) return { group: 'nfsdata', tape: '000010' };
  if (username.startsWith('teenpatti')) return { group: 'teenpatti', tape: '000011' };
  return null;
};

const migrateData = async () => {
  // Use environment variables for DB connection
  const sourceConnection = await mysql.createConnection({
    host: process.env.FTP_LOGS_DB_HOST || 'localhost',
    user: process.env.FTP_LOGS_DB_USER || 'your_user',
    password: process.env.FTP_LOGS_DB_PASSWORD || 'your_password',
    database: process.env.FTP_LOGS_DB_NAME || 'ftp_commands',
    port: process.env.FTP_LOGS_DB_PORT ? Number(process.env.FTP_LOGS_DB_PORT) : 3306
  });

  const targetConnection = await mysql.createConnection({
    host: process.env.USER_MGMT_DB_HOST || 'localhost',
    user: process.env.USER_MGMT_DB_USER || 'your_user',
    password: process.env.USER_MGMT_DB_PASSWORD || 'your_password',
    database: process.env.USER_MGMT_DB_NAME || 'user_management_system',
    port: process.env.USER_MGMT_DB_PORT ? Number(process.env.USER_MGMT_DB_PORT) : 3306
  });

  const [rows] = await sourceConnection.execute(
    `SELECT * FROM ftp_logs WHERE File_in_or_out = 'into server'`
  ) as [Array<any>, any];

  for (const row of rows) {
    const username = row.username;
    if (!username || username === 'dgntest') continue;

    const mapping = mapUsernameToGroupAndTape(username);
    if (!mapping) continue;

    const fileSizeFormatted = formatFileSize(row.Filesize_in_bytes);

    await targetConnection.execute(
      `INSERT INTO upload_details 
        (user_name, group_name, file_name, file_size, status, method, tape_location, tape_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'ShivangGupta',
        mapping.group,
        row.Filename || 'unknown',
        fileSizeFormatted,
        'completed',
        'server',
        row.file_destination || 'pending',
        mapping.tape,
        row.timestamp
      ]
    );
  }

  console.log('✅ Data migration completed.');

  await sourceConnection.end();
  await targetConnection.end();
};

migrateData().catch(console.error);
