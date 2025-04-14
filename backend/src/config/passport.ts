import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { mysqlPool } from '../database/config';
import dotenv from 'dotenv';
import { UserRole } from '../types/auth';

// Extend Express.User to include our User type
declare global {
  namespace Express {
    interface User {
      id: number;
      google_id: string;
      email: string;
      name: string;
      picture?: string;
      role: UserRole;
      created_at: Date;
      updated_at: Date;
    }
  }
}

dotenv.config();

// Serialize user for the session 
passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id: number, done) => {
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM users WHERE id = ?', [id]);
    const user = (rows as any[])[0] as Express.User;
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        const [existingUsers] = await mysqlPool.query(
          'SELECT * FROM users WHERE google_id = ?',
          [profile.id]
        );

        if ((existingUsers as any[]).length > 0) {
          return done(null, (existingUsers as any[])[0] as Express.User);
        }

        // Check if this is the first user
        const [userCount] = await mysqlPool.query('SELECT COUNT(*) as count FROM users');
        const isFirstUser = (userCount as any[])[0].count === 0;
        const defaultRole: UserRole = isFirstUser ? 'admin' : 'user';

        // Create new user
        const [result] = await mysqlPool.query(
          'INSERT INTO users (google_id, email, name, picture, role) VALUES (?, ?, ?, ?, ?)',
          [
            profile.id, 
            profile.emails![0].value, 
            profile.displayName, 
            profile.photos![0].value,
            defaultRole
          ]
        );

        const newUser: Express.User = {
          id: (result as any).insertId,
          google_id: profile.id,
          email: profile.emails![0].value,
          name: profile.displayName,
          picture: profile.photos![0].value,
          role: defaultRole,
          created_at: new Date(),
          updated_at: new Date()
        };

        return done(null, newUser);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
); 