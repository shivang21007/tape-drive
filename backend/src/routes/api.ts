import express from 'express';
import { isAdmin } from '../middleware/auth';
import { mysqlPool } from '../database';
import { User } from '../types/user';
import { ResultSetHeader } from 'mysql2';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileQueue } from '../queue/fileQueue';
import { FileProcessingJob } from '../types/fileProcessing';

const router = express.Router();

// Function to format file size with appropriate unit
export const formatFileSize = (bytes: number | string | undefined): string => {
  if (bytes === undefined || bytes === null) {
    return '0 B';
  }

  // Convert to number if it's a string
  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  
  if (isNaN(numBytes) || numBytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = numBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get user info from session
    const user = (req as any).user as User;
    if (!user) {
      return cb(new Error('User not authenticated'), '');
    }

    const uploadDir = path.join(__dirname, '../../uploadfiles', user.role, user.name);
    
    // Create directory structure if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 * 1024 // 100GB limit
  }
});

// Get all users (admin only)
router.get('/users', isAdmin, async (req, res) => {
  try {
    const [users] = await mysqlPool.query('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all groups (admin only)
router.get('/groups', isAdmin, async (req, res) => {
  try {
    const [groups] = await mysqlPool.query('SELECT * FROM user_groups_table');
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get all processes (admin only)
router.get('/processes', isAdmin, async (req, res) => {
  try {
    const [processes] = await mysqlPool.query('SELECT * FROM processes');
    res.json(processes);
  } catch (error) {
    console.error('Error fetching processes:', error);
    res.status(500).json({ error: 'Failed to fetch processes' });
  }
});

// Get user's groups
router.get('/user/groups', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = req.user as User;
    const [groups] = await mysqlPool.query(
      `SELECT g.* FROM user_groups_table g
       INNER JOIN user_group_memberships m ON g.id = m.group_id
       WHERE m.user_id = ?`,
      [user.id]
    );
    res.json(groups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'data_team', 'art_team', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Check if user exists
    const [users] = await mysqlPool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if ((users as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await mysqlPool.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Create new group (admin only)
router.post('/groups', isAdmin, async (req, res) => {
  const { name, description } = req.body;

  try {
    const [result] = await mysqlPool.query<ResultSetHeader>(
      'INSERT INTO user_groups_table (name, description) VALUES (?, ?)',
      [name, description]
    );
    res.status(201).json({ id: result.insertId, name, description });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Create new process (admin only)
router.post('/processes', isAdmin, async (req, res) => {
  const { name, description } = req.body;

  try {
    const [result] = await mysqlPool.query<ResultSetHeader>(
      'INSERT INTO processes (name, description) VALUES (?, ?)',
      [name, description]
    );
    res.status(201).json({ id: result.insertId, name, description });
  } catch (error) {
    console.error('Error creating process:', error);
    res.status(500).json({ error: 'Failed to create process' });
  }
});

// File upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const user = (req as any).user as User;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const formattedSize = formatFileSize(req.file.size);

  try {
    // Verify file exists and is complete
    const filePath = req.file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: 'File upload failed - file not found' });
    }

    // Verify file size matches expected size
    const stats = fs.statSync(filePath);
    if (stats.size !== req.file.size) {
      // Clean up incomplete file
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: 'File upload incomplete' });
    }

    const connection = await mysqlPool.getConnection();
    
    try {
      // Insert into database with 'queueing' status
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO upload_details (user_name, group_name, file_name, file_size, status, local_file_location) VALUES (?, ?, ?, ?, ?, ?)',
        [user.name, user.role, req.file.originalname, formattedSize, 'queueing', req.file.path]
      );

      // Push event to BullMQ queue
      const jobData: FileProcessingJob = {
        fileId: result.insertId,
        fileName: req.file.originalname,
        fileSize: formattedSize,
        userName: user.name,
        userEmail: user.email,
        groupName: user.role,
        isAdmin: user.role === 'admin',
        filePath: req.file.path,
        requestedAt: Date.now()
      };

      await fileQueue.add('file-processing', jobData, {
        priority: user.role === 'admin' ? 1 : 2 // Higher priority for admin files
      });

      res.json({ 
        message: 'File uploaded successfully and queued for processing',
        file: {
          name: req.file.originalname,
          size: formattedSize,
          path: req.file.path
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    // If there's an error, clean up the file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

// Cancel upload endpoint
router.post('/cancel-upload', async (req, res) => {
  const { fileName, userName, groupName } = req.body;
  
  if (!fileName || !userName || !groupName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Construct the path to the partial upload
    const filePath = path.join(__dirname, '../../uploadfiles', groupName, userName, fileName);
    
    // Check if file exists and delete it
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Upload cancelled and cleaned up successfully' });
  } catch (error) {
    console.error('Error cleaning up cancelled upload:', error);
    res.status(500).json({ error: 'Failed to clean up cancelled upload' });
  }
});

// Get files endpoint
router.get('/files', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as User;
  try {
    let query = 'SELECT * FROM upload_details';
    let params: any[] = [];

    // If not admin, filter by user's role
    if (user.role !== 'admin') {
      query += ' WHERE group_name = ?';
      params.push(user.role);
      query += ' ORDER BY created_at DESC';
    }

    const [files] = await mysqlPool.query(query, params);
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// File download endpoint
router.get('/files/:id/download', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as User;
  const { id } = req.params;

  try {
    const [files] = await mysqlPool.query(
      'SELECT * FROM upload_details WHERE id = ?',
      [id]
    );

    if ((files as any[]).length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = (files as any[])[0];

    // Check if user has access to this file
    if (user.role !== 'admin' && file.group_name !== user.role) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(__dirname, '../../uploadfiles', file.group_name, file.user_name, file.file_name);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, file.file_name);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router; 