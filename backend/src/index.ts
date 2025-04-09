import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import { testConnections } from './config/database';
import './config/passport';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import { isAuthenticated } from './middleware/auth';

// Add this type declaration at the top of the file
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: any;
    };
  }
}

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envFile });

const app = express();
const port = process.env.PORT || 8000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true only in production with HTTPS
    // secure: process.env.NODE_ENV === 'production', // Set to true in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.serv19.octro.net' : undefined
  },
  name: 'connect.sid',
  rolling: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api', isAuthenticated, apiRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the User Management System API' });
});

// Get current user
app.get('/auth/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.session || !req.session.passport?.user) {
    return res.status(401).json({ error: 'No valid session' });
  }
  
  res.json(req.user);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
  try {
    await testConnections();
    
    app.listen(port, () => {
      console.log(`Server is running on port ${port} in ${process.env.NODE_ENV} mode`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 