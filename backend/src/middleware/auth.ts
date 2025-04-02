
import { Request, Response, NextFunction } from 'express';
import { User } from '../types/user';

export type UserRole = 'admin' | 'data_team' | 'art_team' | 'user';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as User;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  next();
};

export const hasRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    next();
  };
}; 