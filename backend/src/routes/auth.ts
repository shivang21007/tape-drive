import express from 'express';
import passport from 'passport';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is not set');
}

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL!);
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.BACKEND_NODE_ENV === 'production',
      sameSite: 'none',
      domain: process.env.BACKEND_NODE_ENV === 'production' ? '.octro.com' : undefined
    });
    
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

export default router; 