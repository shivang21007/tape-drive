import express from 'express';
import passport from 'passport';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is not set');
}

const isProduction = process.env.BACKEND_NODE_ENV === 'production';

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

const frontendHost = process.env.FRONTEND_URL?.split('://')[1].split(':')[0] || undefined;
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: true,
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
  }),
  (req, res) => {
    // Set cookie domain for cross-domain auth
    if (isProduction) {
      res.cookie('connect.sid', req.sessionID, {
        domain: isProduction ? frontendHost : undefined,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'none'
      });
    }
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:4173');
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: isProduction ? '.octro.com' : undefined
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