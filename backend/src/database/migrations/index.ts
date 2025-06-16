import { mysqlPool } from '../config';

const createTables = async () => {
  const connection = await mysqlPool.getConnection();

  try {
    // Set timezone to IST
    await connection.query(`SET time_zone = '+05:30'`);

    // 1. Create user_groups_table FIRST
    await connection.query(`
  CREATE TABLE IF NOT EXISTS user_groups_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) AUTO_INCREMENT = 100
`);
    //create admin and user groups by default in user_groups_table
    await connection.query(`
      INSERT INTO user_groups_table (name, description)
      SELECT 'user', 'User group with limited privileges'
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM user_groups_table WHERE name = 'user'
      )
    `);
    await connection.query(`
    INSERT INTO user_groups_table (name, description)
    SELECT 'admin', 'Administrator group with full privileges'
    FROM DUAL
    WHERE NOT EXISTS (
    SELECT 1 FROM user_groups_table WHERE name = 'admin'
  )
`);

    // 2. Then create users table (now role FK will succeed)
    await connection.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);



    // Create user_group_memberships table (many-to-many relationship)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_group_memberships (
        user_id INT NOT NULL,
        group_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, group_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES user_groups_table(id) ON DELETE CASCADE
      )
    `);

    // Create upload_details table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS upload_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_name VARCHAR(255) NOT NULL,
        group_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(20) NOT NULL,
        status ENUM('pending', 'queueing', 'processing', 'completed', 'failed') DEFAULT 'pending',
        method VARCHAR(255) DEFAULT 'Browser',
        local_file_location VARCHAR(255),
        tape_location VARCHAR(255) DEFAULT 'pending',
        tape_number VARCHAR(50) DEFAULT 'pending',
        iscached BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create download_requests table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS download_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        file_id INT NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        group_name VARCHAR(255) NOT NULL,
        status ENUM('none', 'requested', 'processing', 'completed', 'failed') DEFAULT 'none',
        served_from ENUM('cache', 'tape') DEFAULT NULL,
        served_to VARCHAR(255) DEFAULT 'Browser',
        served_to_location VARCHAR(255) DEFAULT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (file_id) REFERENCES upload_details(id) ON DELETE CASCADE
      )
    `);

    // Create tape_info table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tape_info (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tape_no VARCHAR(50) NOT NULL UNIQUE,
        group_name VARCHAR(255) NOT NULL,
        total_size VARCHAR(20) NOT NULL,  -- e.g., "11T"
        used_size VARCHAR(20) DEFAULT "0B",  -- e.g., "7.2G"
        available_size VARCHAR(20) NOT NULL,  -- e.g., "11T"
        usage_percentage DECIMAL(5,2) DEFAULT 0.00,  -- e.g., 1.00
        status VARCHAR(255) DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (group_name) REFERENCES user_groups_table(name) ON DELETE CASCADE
      )
    `);

    // Create server_info table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS server_info (
        id INT PRIMARY KEY AUTO_INCREMENT,
        server_name VARCHAR(255) NOT NULL,
        server_ip VARCHAR(255) NOT NULL,
        group_name VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (group_name) REFERENCES user_groups_table(name) ON DELETE CASCADE
      )
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating database tables:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Run migrations
createTables()
  .then(() => {
    console.log('Migrations completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 