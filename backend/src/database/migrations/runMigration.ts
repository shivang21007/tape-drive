import { mysqlPool } from '../index';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const connection = await mysqlPool.getConnection();
  try {
    const migrationPath = path.join(__dirname, 'alter_download_requests.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await connection.query(migrationSQL);
    console.log('Alter table completed successfully');
    connection.release();
  } catch (error) {
    console.error('Alter table failed:', error);
  }
}

runMigration(); 