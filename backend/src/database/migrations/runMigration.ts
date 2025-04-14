import { mysqlPool } from '../index';

async function runMigration() {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.query(`
      ALTER TABLE upload_details 
      MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'
    `);
    console.log('Alter table completed successfully');
    connection.release();
  } catch (error) {
    console.error('Alter table failed:', error);
  }
}

runMigration(); 