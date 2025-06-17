import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import { testConnections } from './database/config';
import './config/passport';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import { isAuthenticated } from './middleware/auth';
import path from 'path';
import { redisClient } from './database/config';
import RedisStore from 'connect-redis';

// Add this type declaration at the top of the file
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: any;
    };
  }
}

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Verify environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'SESSION_SECRET',
  'FRONTEND_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const port = process.env.PORT || 8000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 1728000 // 20 days
};

// Middleware
app.use(cors(corsOptions));

// Increase JSON and URL-encoded payload limits
app.use(express.json({ limit: '100gb' }));
app.use(express.urlencoded({ limit: '100gb', extended: true }));

// Session configuration
const redisStore = new RedisStore({ client: redisClient });

const isProduction = false;
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
console.log("cookieDomain", cookieDomain);
 
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'none' : 'lax',
    domain: cookieDomain,
    path: '/'
  },
  name: 'connect.sid'
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

// Start the server
async function startServer() {
  try {
    // Test Redis connection
    await redisClient.connect();
    await redisClient.ping();
    
    await testConnections();
    
    app.listen(port, () => {
      console.log(`Server is running on port ${port} in ${process.env.BACKEND_NODE_ENV} mode`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log('File processor worker started');
    });
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    process.exit(1); // Exit if Redis connection fails
  }
}

startServer(); 