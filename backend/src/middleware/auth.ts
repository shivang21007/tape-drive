import { Request, Response, NextFunction } from 'express';
import { UserRole, isValidRole } from '../models/auth';

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
  if (!isValidRole(user.role) || user.role !== 'admin') {
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
    if (!isValidRole(user.role) || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    next();
  };
}; 