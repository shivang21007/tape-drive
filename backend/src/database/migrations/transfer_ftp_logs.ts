import { mysqlPool } from '../index';

const transferFtpLogs = async () => {
  const connection = await mysqlPool.getConnection();

  try {
    // Set timezone to IST
    await connection.query(`SET time_zone = '+05:30'`);

    // First add description column to upload_details if it doesn't exist
    await connection.query(`
      ALTER TABLE upload_details 
      ADD COLUMN IF NOT EXISTS description VARCHAR(255) DEFAULT NULL
    `);

    // First, transfer upload records (where File_in_or_out is 'into server')
    await connection.query(`
      INSERT INTO upload_details (
        user_name,
        group_name,
        file_name,
        file_size,
        status,
        method,
        local_file_location,
        description,
        created_at
      )
      SELECT 
        CASE 
          WHEN client_ip = '::ffff:192.168.111.163' THEN 'server1'
          WHEN client_ip = '192.168.111.163' THEN 'server1'
          ELSE client_ip
        END,
        'default',
        Filename,
        CAST(Filesize_in_bytes AS CHAR),
        'completed',
        CASE 
          WHEN client_ip = '::ffff:192.168.111.163' THEN 'server1'
          WHEN client_ip = '192.168.111.163' THEN 'server1'
          ELSE client_ip
        END,
        file_destination,
        username,
        timestamp
      FROM ftp_logs
      WHERE File_in_or_out = 'into server'
    `);

    // Then, transfer download records (where File_in_or_out is 'out from server')
    await connection.query(`
      INSERT INTO download_requests (
        file_id,
        user_name,
        group_name,
        status,
        served_from,
        served_to,
        served_to_location,
        requested_at,
        completed_at
      )
      SELECT 
        ud.id,
        CASE 
          WHEN fl.client_ip = '::ffff:192.168.111.163' THEN 'server1'
          WHEN fl.client_ip = '192.168.111.163' THEN 'server1'
          ELSE fl.client_ip
        END,
        'default',
        'completed',
        'tape',
        CASE 
          WHEN fl.client_ip = '::ffff:192.168.111.163' THEN 'server1'
          WHEN fl.client_ip = '192.168.111.163' THEN 'server1'
          ELSE fl.client_ip
        END,
        fl.file_destination,
        fl.timestamp,
        fl.timestamp
      FROM ftp_logs fl
      JOIN upload_details ud ON ud.file_name = fl.Filename
      WHERE fl.File_in_or_out = 'out from server'
    `);

    console.log('Data transfer completed successfully');
  } catch (error) {
    console.error('Error transferring data:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Run the transfer
transferFtpLogs()
  .then(() => {
    console.log('Data transfer completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Data transfer failed:', error);
    process.exit(1);
  }); 