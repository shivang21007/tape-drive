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

// Middleware to check if user has access to features
const hasFeatureAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user as User;
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check if user has a valid role (not the default 'user' role)
  if (user.role === 'user') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Please contact the administrator to get assigned to a team or role'
    });
  }

  next();
};

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

    const uploadDir = path.join(process.env.UPLOAD_DIR || 
      '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles', user.role, user.name);
    
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
router.post('/upload', hasFeatureAccess, upload.single('file'), async (req, res) => {
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

      // Push event to BullMQ queue with upload label
      const jobData: FileProcessingJob = {
        type: 'upload',
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

      console.log('Adding job to queue with data:', jobData);
      
      try {
        const job = await fileQueue.add('file-processing', jobData, {
          priority: user.role === 'admin' ? 1 : 2, // Higher priority for admin files
          // jobId: `upload-${result.insertId}`
        });
        
        console.log('Job added successfully with ID:', job.id);
      } catch (error) {
        console.error('Failed to add job to queue:', error);
        throw error;
      }

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
router.get('/files', hasFeatureAccess, async (req, res) => {
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

// File download request endpoint
router.get('/files/:id/download', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as User;
  const { id } = req.params;
  const { download } = req.query;

  try {
    // Get file details
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

    // Check if file exists in local cache
    if (file.local_file_location && fs.existsSync(file.local_file_location)) {
      // If download=true, serve the file
      if (download === 'true') {
        return res.download(file.local_file_location, file.file_name);
      }

      // File is in cache, create download request with cache source
      const connection = await mysqlPool.getConnection();
      
      try {
        const [result] = await connection.query<ResultSetHeader>(
          'INSERT INTO download_requests (file_id, user_name, group_name, status, served_from, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
          [file.id, user.name, user.role, 'completed', 'cache', new Date()]
        );

        res.json({ 
          status: 'completed',
          servedFrom: 'cache',
          local_file_location: file.local_file_location,
          requestId: result.insertId
        });
      } finally {
        connection.release();
      }
      return;
    }

    // File not in cache, create download request and queue job
    const connection = await mysqlPool.getConnection();
    
    try {
      // Insert download request
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO download_requests (file_id, user_name, group_name, status) VALUES (?, ?, ?, ?)',
        [file.id, user.name, user.role, 'pending']
      );

      // Push download job to queue
      const jobData = {
        type: 'download',
        requestId: result.insertId,
        fileId: file.id,
        fileName: file.file_name,
        userName: user.name,
        userEmail: user.email,
        groupName: user.role,
        tapeLocation: file.tape_location,
        tapeNumber: file.tape_number,
        requestedAt: Date.now()
      };

      await fileQueue.add('file-processing', jobData, {
        priority: user.role === 'admin' ? 1 : 2, // Higher priority for admin files
        jobId: `download-${result.insertId}`
      });

      res.json({ 
        status: 'pending',
        message: 'Download request has been queued. You will be notified when the file is available.',
        requestId: result.insertId
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error processing download request:', error);
    res.status(500).json({ error: 'Failed to process download request' });
  }
});

// Check download request status
router.get('/download-requests/:id/status', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const user = req.user as User;

  try {
    const [requests] = await mysqlPool.query(
      'SELECT * FROM download_requests WHERE id = ? AND user_name = ?',
      [id, user.name]
    );

    if ((requests as any[]).length === 0) {
      return res.status(404).json({ error: 'Download request not found' });
    }

    const request = (requests as any[])[0];

    // If request is completed, get the file path from upload_details
    if (request.status === 'completed') {
      const [files] = await mysqlPool.query(
        'SELECT local_file_location FROM upload_details WHERE id = ?',
        [request.file_id]
      );
      
      if ((files as any[]).length > 0) {
        const file = (files as any[])[0];
        if (file.local_file_location && fs.existsSync(file.local_file_location)) {
          res.json({ 
            status: 'completed',
            servedFrom: request.served_from,
            filePath: file.local_file_location
          });
          return;
        }
      }
    }

    res.json({ 
      status: request.status,
      message: request.status === 'failed' ? 'Failed to process download request' : 'Request is being processed'
    });
  } catch (error) {
    console.error('Error checking download status:', error);
    res.status(500).json({ error: 'Failed to check download status' });
  }
});

export default router; 