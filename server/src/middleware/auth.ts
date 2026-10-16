import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { User, UserRole } from '../types';

export const JWT_SECRET = process.env.JWT_SECRET || 'lost-paint-studios-super-secure-key-2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      team_member_id: user.team_member_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    let token = req.cookies?.token;

    // Also support Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Also support token query param for direct downloads/exports
    if (!token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = db.prepare('SELECT id, email, display_name, role, team_member_id, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?').get(decoded.id) as User | undefined;

    if (!user || user.is_active !== 1) {
      res.status(401).json({ error: 'User account not found or deactivated.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token && typeof req.query.token === 'string') {
      token = req.query.token;
    }
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      const user = db.prepare('SELECT id, email, display_name, role, team_member_id, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?').get(decoded.id) as User | undefined;
      if (user && user.is_active === 1) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid optional tokens
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
      });
      return;
    }

    next();
  };
}
