import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/auth';

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

  const user = req.user;
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

    const user = req.user;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    next();
  };
}; 