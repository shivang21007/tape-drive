import express from 'express';
import { isAdmin } from '../middleware/auth';
import { mysqlPool } from '../config/database';

const router = express.Router();

// Get all users (admin only)
router.get('/users', isAdmin, async (req, res) => {
  try {
    const [users] = await mysqlPool.query('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get all groups (admin only)
router.get('/groups', isAdmin, async (req, res) => {
  try {
    const [groups] = await mysqlPool.query('SELECT * FROM user_groups_table');
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Error fetching groups' });
  }
});

// Get all processes (admin only)
router.get('/processes', isAdmin, async (req, res) => {
  try {
    const [processes] = await mysqlPool.query('SELECT * FROM processes');
    res.json(processes);
  } catch (error) {
    console.error('Error fetching processes:', error);
    res.status(500).json({ message: 'Error fetching processes' });
  }
});

// Get user's groups
router.get('/user/groups', async (req, res) => {
  try {
    const [groups] = await mysqlPool.query(
      `SELECT g.* FROM user_groups_table g
       INNER JOIN user_group_memberships ugm ON g.id = ugm.group_id
       WHERE ugm.user_id = ?`,
      [req.user?.id]
    );
    res.json(groups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ message: 'Error fetching user groups' });
  }
});

export default router; 