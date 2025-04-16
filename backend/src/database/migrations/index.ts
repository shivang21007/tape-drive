import { mysqlPool } from '../index';

const createTables = async () => {
  const connection = await mysqlPool.getConnection();
  
  try {
    // Set timezone to IST
    await connection.query(`SET time_zone = '+05:30'`);

    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        picture VARCHAR(255),
        role ENUM('admin', 'data_team', 'art_team', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create user_groups table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_groups_table (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
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

    // Create processes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS processes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive', 'completed') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
        status ENUM('queueing', 'processing', 'completed', 'failed') DEFAULT 'queueing',
        local_file_location VARCHAR(255) NOT NULL,
        tape_location VARCHAR(255) DEFAULT 'pending',
        tape_number VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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