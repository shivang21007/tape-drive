import express from 'express';
import { isAdmin } from '../middleware/auth';
import { mysqlPool } from '../database/config';
import { User } from '../types/user';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileQueue, secureCopyQueue } from '../queue/fileQueue';
import { FileProcessingJob, SecureCopyDownloadJob, SecureCopyUploadJob } from '../types/fileProcessing';
import { isValidRole, getAvailableRoles } from '../models/auth';
import { checkSSHReadAccess } from '../utils/testSSHConnection';
const router = express.Router();

// Helper functions for role validation
const isAdminRole = (role: string): boolean => {
  return isValidRole(role) && role === 'admin';
};

const isUserRole = (role: string): boolean => {
  return role === 'user';
};

const getPriority = (role: string): number => {
  return isAdminRole(role) ? 1 : 2;
};
// Middleware to check if user has access to features
const hasFeatureAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user as User;

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check if user has a valid role (not the default 'user' role)
  if (isUserRole(user.role)) {
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
    // Replace spaces with underscores in filename
    const sanitizedFileName = file.originalname.replace(/\s+/g, '_');
    cb(null, sanitizedFileName);
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
    // Only return necessary fields for frontend display
    const [groups] = await mysqlPool.query(
      'SELECT name, description FROM user_groups_table'
    );
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get user's groups
router.get('/user/groups', isAdmin, async (req, res) => {
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

// Validate role (admin only)
router.get('/validate-role/:role', isAdmin, async (req, res) => {
  const { role } = req.params;
  try {
    const [groups] = await mysqlPool.query(
      'SELECT name FROM user_groups_table WHERE name = ?',
      [role]
    );
    res.json({ isValid: (groups as any[]).length > 0 });
  } catch (error) {
    console.error('Error validating role:', error);
    res.status(500).json({ error: 'Failed to validate role' });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    // Validate role exists
    const [groups] = await mysqlPool.query(
      'SELECT name FROM user_groups_table WHERE name = ?',
      [role]
    );

    if ((groups as any[]).length === 0) {
      return res.status(400).json({ 
        error: 'Invalid role',
        message: `Role "${role}" does not exist. Please create it first.`
      });
    }

    // Check if user exists
    const [users] = await mysqlPool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if ((users as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the user's role
    await mysqlPool.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ 
      error: 'Failed to update user role',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
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

// Delete group (admin only)
router.delete('/groups/:groupName', isAdmin, async (req, res) => {
  const { groupName } = req.params;
  try {
    // Check if any users are assigned to this group
    const [users] = await mysqlPool.query('SELECT id FROM users WHERE role = ?', [groupName]);
    if ((users as any[]).length > 0) {
      return res.status(400).json({ error: 'group has users, reassign them to new group' });
    }
    // Delete the group
    const [result] = await mysqlPool.query('DELETE FROM user_groups_table WHERE name = ?', [groupName]);
    if ((result as ResultSetHeader).affectedRows === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
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

  if (!isValidRole(user.role)) {
    return res.status(403).json({ error: 'Invalid role' });
  }

  // File name is already sanitized by multer storage configuration
  const originalFileName = req.file.originalname.replace(/\s+/g, '_');

  // check if same name file already exist in upload_details table
  const [existingFile] = await mysqlPool.query('SELECT * FROM upload_details WHERE file_name = ?', [originalFileName]);
  if ((existingFile as any[]).length > 0) {
    return res.status(400).json({ error: 'File already exists Please use different File Name' });
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
        'INSERT INTO upload_details (user_name, group_name, file_name, file_size, status, local_file_location, method, iscached) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user.name, user.role, originalFileName, formattedSize, 'queueing', req.file.path, 'Browser', true]
      );

      // Push event to BullMQ queue with upload label
      const jobData: FileProcessingJob = {
        type: 'upload',
        fileId: result.insertId,
        fileName: originalFileName,
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
          priority: getPriority(user.role), // 1 for admin, 2 for user
          jobId: `upload-${result.insertId}`
        });

        console.log('Job added successfully with ID:', job.id);
      } catch (error) {
        console.error('Failed to add job to queue:', error);
        throw error;
      }

      res.json({
        message: 'File uploaded successfully and queued for processing',
        file: {
          name: originalFileName,
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
router.post('/cancel-upload', hasFeatureAccess, async (req, res) => {
  const { fileName, userName, groupName } = req.body;

  if (!fileName || !userName || !groupName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sanitizedFileName = fileName.replace(/\s+/g, '_');
    const uploadDir = String(process.env.UPLOAD_DIR || '/home/octro/google-auth-login-page/tape-drive/backend/uploadfiles');
    const sanitizedGroupName = typeof groupName === 'object' ? groupName.name : String(groupName);
    const sanitizedUserName = String(userName);

    const filePath = path.join(
      uploadDir,
      sanitizedGroupName,
      sanitizedUserName,
      sanitizedFileName
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'Upload cancelled and cleaned up successfully' });
    } else {
      res.json({ message: 'No partial upload found to clean up (already deleted or never existed).' });
    }
    return;
  } catch (error) {
    console.error('Error cleaning up cancelled upload:', error);
    res.status(500).json({ error: 'Failed to clean up cancelled upload' });
  }
});;

// Get files endpoint
router.get('/files', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as User;
  if (!isValidRole(user.role)) {
    return res.status(403).json({ error: 'Invalid role' });
  }

  try {
    let query = 'SELECT * FROM upload_details';
    const params: any[] = [];

    
    if (!isAdminRole(user.role)) {
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

  if (!isValidRole(user.role)) {
    return res.status(403).json({ error: 'Invalid role' });
  }

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

    const connection = await mysqlPool.getConnection();

    try {
      // Check if file exists in local cache
      const isInCache = file.local_file_location && fs.existsSync(file.local_file_location);

      if (isInCache) {

        // check is it is dirctory or file
        const isDirectory = fs.statSync(file.local_file_location).isDirectory();
        if(isDirectory){
          return res.status(302).json({ message: 'File is a directory, Please Download it by Server Method' });
        }
        // If download=true, serve the file
        if (download === 'true') {
          const fileStream = fs.createReadStream(file.local_file_location);
          const stat = fs.statSync(file.local_file_location);
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(file.file_name)}"`
          });

          fileStream.pipe(res);
          return;
        }

        // File is in cache, create download request with cache source
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
        return;
      }

      // File not in cache, create download request and queue job
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO download_requests (file_id, user_name, group_name, status) VALUES (?, ?, ?, ?)',
        [file.id, user.name, user.role, 'processing']
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

      console.log('jobData : ', jobData);

      const job = await fileQueue.add('file-processing', jobData, {
        priority: getPriority(user.role),
        jobId: `download-${result.insertId}`
      });

      console.log('Job added successfully with ID:', job.id);

      res.json({
        status: 'processing',
        message: 'Your request has been taken. You will be notified by email when the file is available.',
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

  if (!isValidRole(user.role)) {
    return res.status(403).json({ error: 'Invalid role' });
  }

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

// Get download history
router.get('/history', hasFeatureAccess, async (req, res) => {
  try {
    const { group_name } = req.query;
    const user = (req as any).user;

    if (!isValidRole(user.role)) {
      return res.status(403).json({ error: 'Invalid role' });
    }

    let query = `
      SELECT 
        dr.id,
        dr.file_id,
        dr.user_name,
        dr.group_name,
        ud.file_name,
        ud.file_size,
        dr.status,
        dr.served_from,
        dr.served_to,
        dr.requested_at,
        dr.completed_at
      FROM download_requests dr
      JOIN upload_details ud ON dr.file_id = ud.id
    `;

    const params = [];

    // If user is not admin, filter by their group
    if (user.role !== 'admin') {
      query += ' WHERE dr.group_name = ?';
      params.push(user.role);
    }

    query += ' ORDER BY dr.requested_at DESC';

    const [rows] = await mysqlPool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Check download request status by fileId
router.get('/download-requests/status', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { fileId } = req.query;
  const user = req.user as User;

  if (!fileId) {
    return res.status(400).json({ error: 'File ID is required' });
  }

  if (!isValidRole(user.role)) {
    return res.status(403).json({ error: 'Invalid role' });
  }

  try {
    const [requests] = await mysqlPool.query(
      `SELECT * FROM download_requests 
       WHERE file_id = ? AND user_name = ? 
       ORDER BY requested_at DESC 
       LIMIT 1`,
      [fileId, user.name]
    );

    if ((requests as any[]).length === 0) {
      return res.json({
        status: 'none',
        message: 'No download request found'
      });
    }

    const request = (requests as any[])[0];

    res.json({
      status: request.status,
      requestId: request.id,
      message: request.status === 'completed' ? 'File is ready for download' :
        request.status === 'failed' ? 'Download request failed' :
          'Request is being processed'
    });
  } catch (error) {
    console.error('Error checking download status:', error);
    res.status(500).json({ error: 'Failed to check download status' });
  }
});


// Handle secure copy upload
router.post('/secureupload', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const connection = await mysqlPool.getConnection();
  
  try {
    // add a entry in upload_details table if type is upload
    if(req.body.type === 'upload'){ 
      const { server, sshUser, filePath, description } = req.body;
      const fileName = filePath.split('/').pop();
      const type = 'upload';
      
      if(!server || !filePath || !sshUser){
        return res.status(400).json({ error: 'Server, file path and ssh user are required' });
      }
      
      if (!isValidRole(req.user.role)) {
        return res.status(403).json({ error: 'Invalid role' });
      }

      // check if same name file already exist in upload_details table
      const [existingFile] = await mysqlPool.query('SELECT * FROM upload_details WHERE file_name = ?', [fileName]);
      if ((existingFile as any[]).length > 0) {
        return res.status(400).json({ error: 'File already exists. Please use a different file name.' });
      }
      
      // check ssh connection to server
      const sshResult = await checkSSHReadAccess(server, sshUser, filePath);
      if (!sshResult.success) {
        return res.status(404).json({ stderr: sshResult.stderr, errMsg: sshResult.errMsg });
      }

      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO upload_details (user_name, group_name, file_name, file_size, status, local_file_location, method, description ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.name, req.user.role, fileName, 'unknown', 'pending', filePath, server, description]
      );
      
      if(!result){
        return res.status(500).json({ error: 'Failed to add entry to upload_details table' });
      }
      
      const jobData: SecureCopyUploadJob = {
        type: type,
        fileId: result.insertId,
        fileName: fileName,
        userName: req.user.name,
        userEmail: req.user.email,
        groupName: req.user.role,
        filePath: filePath,
        server: server,
        sshUser: sshUser,
        isAdmin: req.user.role === 'admin',
        requestedAt: Date.now()
      };
      
      console.log('Secure CopyjobData : ', jobData);
      
      try{
        const job = await secureCopyQueue.add('SecureCopy', jobData, {
          priority: getPriority(req.user.role),
          jobId: `secureCopy-upload-${result.insertId}`
        });
        
        console.log('Job added successfully with ID:', job.id);
      } catch (error) {
        console.error('Failed to add job to queue:', error);
        throw error;
      }
      
      return res.status(200).json({ success: true, message: 'File uploaded successfully' });
    }
    else{
      throw new Error('Invalid request type');
    }
  } 
  catch (error) {
    console.error('Error adding entry to upload_details table:', error);
    res.status(500).json({ error: 'Failed to add entry to upload_details table' });
  }
  finally{
    connection.release();
  }
});

// Handle secure copy download
router.post('/securedownload', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const connection = await mysqlPool.getConnection();
  
  try {
    if(req.body.type === 'download') {
      const {fileId, server, sshUser, filePath, fileName } = req.body;
      
      if (!server || !filePath || !sshUser) {
        return res.status(400).json({ error: 'Server, file path and ssh user are required' });
      }

      if (!isValidRole(req.user.role)) {
        return res.status(403).json({ error: 'Invalid role' });
      }
      
      // check ssh connection to server
      const sshResult = await checkSSHReadAccess(server, sshUser, filePath);
      if (!sshResult.success) {
        return res.status(404).json({ stderr: sshResult.stderr, errMsg: sshResult.errMsg });
      }

      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO download_requests (file_id, user_name, group_name, status, served_from, served_to, served_to_location, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [fileId, req.user.name, req.user.role, 'requested', 'cache', server, filePath]
      );
      
      const jobData: SecureCopyDownloadJob = {
        type: 'download',
        downloadRequestId: result.insertId,
        fileId: fileId,
        fileName: fileName,
        userName: req.user.name,
        userEmail: req.user.email,
        groupName: req.user.role,
        filePath: filePath,
        server: server,
        sshUser: sshUser,
        isAdmin: req.user.role === 'admin',
        requestedAt: Date.now()
      };
      
      console.log('Adding Secure Copy download job:', jobData);
      
      const job = await secureCopyQueue.add('SecureCopy', jobData, {
        priority: getPriority(req.user.role),
        jobId: `secureCopy-download-${result.insertId}`
      });
      
      console.log('Secure Copy download job added successfully with ID:', job.id);
      
      res.status(200).json({ success: true, message: 'Secure download request submitted successfully' });
    } else {
      throw new Error('Invalid request type');
    }
  } catch(error) {
    console.error('Error processing secure download request:', error);
    res.status(500).json({ error: 'Failed to process secure download request' });
  } finally {
    connection.release();
  }
});

// Check if file is in cache without creating a download request
router.get('/files/:id/check-cache', hasFeatureAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = req.user as User;
  const { id } = req.params;
  
  if (!isValidRole(user.role)) {
    return res.status(403).json({ error: 'Invalid role' });
  }
  
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
    const isInCache = file.local_file_location && fs.existsSync(file.local_file_location);
    
    res.json({ isInCache });
  } catch (error) {
    console.error('Error checking file cache:', error);
    res.status(500).json({ error: 'Failed to check file cache' });
  }
});

// Get tape info group-wise
router.get('/tapeinfo', hasFeatureAccess, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!isValidRole(user.role)) {
      return res.status(403).json({ error: 'Invalid role' });
    }
    let query = `SELECT group_name, 
    JSON_ARRAYAGG(JSON_OBJECT(
      'id', id,
      'tape_no', tape_no,
      'total_size', total_size,
      'used_size', used_size,
      'available_size', available_size,
      'usage_percentage', usage_percentage,
      'updated_at', updated_at,
      'status', status,
      'tags', tags
      )) AS tapes
      FROM tape_info`;
      let params: any[] = [];
      if (!user || user.role !== 'admin') {
        query += ' WHERE group_name = ?';
        params.push(user?.role);
      }
      query += ' GROUP BY group_name';
      const [rows] = await mysqlPool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching tape info:', error);
      res.status(500).json({ error: 'Failed to fetch tape info' });
    }
  });

  // Update tape info
  router.put('/tapeinfo/:id', hasFeatureAccess, async (req, res) => {
    const { id } = req.params;
    const { tag } = req.body;
    const user = (req as any).user;

    if (!isValidRole(user.role)) {
      return res.status(403).json({ error: 'Invalid role' });
    }

    try {
      // First check if the tape exists and user has access
      const [tapes] = await mysqlPool.query(
        'SELECT * FROM tape_info WHERE id = ?',
        [id]
      );

      if ((tapes as any[]).length === 0) {
        return res.status(404).json({ error: 'Tape not found' });
      }

      const tape = (tapes as any[])[0];
      
      // Check if user has access to this tape
      if (user.role !== 'admin' && tape.group_name !== user.role) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update the tag
      await mysqlPool.query(
        'UPDATE tape_info SET tags = ? WHERE id = ?',
        [tag, id]
      );

      res.json({ message: 'Tape tag updated successfully' });
    } catch (error) {
      console.error('Error updating tape tag:', error);
      res.status(500).json({ error: 'Failed to update tape tag' });
    }
  });

  // Delete user (admin only)
  router.delete('/users/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await mysqlPool.query('DELETE FROM users WHERE id = ?', [id]);
      if ((result as ResultSetHeader).affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      // If the deleted user is the currently logged-in user, clear their session cookie
      if (req.user && req.user.id && String(req.user.id) === String(id)) {
        // The default session cookie name for express-session is 'connect.sid'
        res.clearCookie('connect.sid');
        req.logout?.((err: any) => {
          if (err) {
            console.error('Error logging out:', err);
          }
        });
      }
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });
  
  // Get all tapes (admin only)
  router.get('/tapes', isAdmin, async (req, res) => {
    try {
      const [rows] = await mysqlPool.query('SELECT * FROM tape_info ORDER BY id ASC');
      res.json(rows);
    } catch (error) {
      console.error('Error fetching tapes:', error);
      res.status(500).json({ error: 'Failed to fetch tapes' });
    }
  });
  
  // Update tape group (admin only)
  router.put('/tapes/:id/group', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { group_name } = req.body;
    if (!group_name) {
      return res.status(400).json({ error: 'Missing group_name' });
    }
    try {
      const [result] = await mysqlPool.query('UPDATE tape_info SET group_name = ? WHERE id = ?', [group_name, id]);
      if ((result as ResultSetHeader).affectedRows === 0) {
        return res.status(404).json({ error: 'Tape not found' });
      }
      res.json({ message: 'Tape group updated successfully' });
    } catch (error) {
      console.error('Error updating tape group:', error);
      res.status(500).json({ error: 'Failed to update tape group' });
    }
  });
  
  // Add interface for server info
  interface ServerInfo extends RowDataPacket {
    id: number;
    server_name: string;
    server_ip: string;
    group_name: string;
  }

  // Get server info
  router.get('/serverinfo', hasFeatureAccess, async (req, res) => {
    try {
      const user = (req as any).user;

      if (!user || !user.role) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // First check if user's group exists
      const [groups] = await mysqlPool.query(
        'SELECT name FROM user_groups_table WHERE name = ?',
        [user.role]
      );

      if (!Array.isArray(groups) || groups.length === 0) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Your group is not configured. Please contact the administrator.'
        });
      }

      // Get all servers
      const [rows] = await mysqlPool.query<ServerInfo[]>('SELECT * FROM server_info');
      
      if (!rows || !Array.isArray(rows)) {
        return res.status(500).json({ error: 'Invalid server info data' });
      }
      
      let filteredServers: ServerInfo[];
      if (user.role === 'admin') {
        filteredServers = rows;
      } else {
        // For non-admin users, filter by their group
        filteredServers = rows.filter(row => row.group_name === user.role);
      }

      if (filteredServers.length === 0) {
        return res.json([]); // Return empty array instead of error
      }
      
      return res.json(filteredServers);
      
    } catch (error) {
      console.error('Error fetching server info:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch server info',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Update server info group 
  router.put('/serverinfo/:id/group', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { group_name } = req.body;
    if (!group_name) {
      return res.status(400).json({ error: 'Missing group_name' });
    }
    try {
      const [result] = await mysqlPool.query('UPDATE server_info SET group_name = ? WHERE id = ?', [group_name, id]);
      if ((result as ResultSetHeader).affectedRows === 0) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      return res.json({ 
        message: 'Server info updated successfully',
        updatedServer: {
          server_name: req.body.server_name,
          server_ip: req.body.server_ip,
          group_name: req.body.group_name
        }
      });
    } catch (error) {
      console.error('Error updating server group:', error);
      res.status(500).json({ error: 'Failed to update server group' });
    }
  });
  
  export default router; 
  