import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database';
import { requireAuth, requireRole, generateToken, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import { User } from '../types';

export const authRouter = Router();

// Rate limiter for authentication endpoints: 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  display_name: z.string().min(2),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  team_member_id: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Setup Initial Owner/Admin (Can be used when no users exist)
authRouter.post('/setup-admin', async (req: Request, res: Response): Promise<void> => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count > 0) {
      res.status(400).json({ error: 'Initial administrator account has already been set up.' });
      return;
    }

    const { email, password, display_name, team_member_id } = RegisterSchema.parse(req.body);

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = 'user-' + crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, team_member_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', ?, 1, ?, ?)
    `).run(id, email.toLowerCase(), password_hash, display_name, team_member_id || null, now, now);

    // If team_member_id was selected, link user_id
    if (team_member_id) {
      db.prepare('UPDATE team_members SET user_id = ? WHERE id = ?').run(id, team_member_id);
    }

    const user = db.prepare('SELECT id, email, display_name, role, team_member_id, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?').get(id) as User;

    logAudit({
      userId: user.id,
      userName: user.display_name,
      action: 'SETUP_ADMIN',
      entityType: 'USER',
      entityId: user.id,
      details: `First owner/admin account created: ${user.email}`,
      isSecurityEvent: 1
    });

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user, token, message: 'Owner account created successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// Check if setup is needed
authRouter.get('/setup-needed', (req: Request, res: Response) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  res.json({ setupNeeded: userCount.count === 0 });
});

// Login
authRouter.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as (User & { password_hash: string }) | undefined;

    if (!userRow) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (userRow.is_active !== 1) {
      res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
      return;
    }

    const isValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isValid) {
      logAudit({
        userName: email,
        action: 'FAILED_LOGIN',
        entityType: 'SECURITY',
        details: `Failed login attempt for ${email}`,
        isSecurityEvent: 1
      });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const { password_hash, ...user } = userRow;
    const token = generateToken(user as User);

    logAudit({
      userId: user.id,
      userName: user.display_name,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      details: `Successful login for ${user.email}`,
      isSecurityEvent: 1
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : 'Invalid login request.' });
  }
});

// Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

// Get Current User Profile
authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// Admin: Create an invite link
authRouter.post('/invite', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const InviteSchema = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'editor', 'viewer']),
      team_member_id: z.string().optional()
    });

    const { email, role, team_member_id } = InviteSchema.parse(req.body);
    const token = crypto.randomBytes(24).toString('hex');
    const id = 'inv-' + crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO invites (id, token, email, role, team_member_id, created_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, token, email.toLowerCase(), role, team_member_id || null, req.user!.id, expiresAt, now.toISOString());

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE_INVITE',
      entityType: 'USER',
      details: `Generated invite for ${email} with role ${role}`,
      isSecurityEvent: 1
    });

    res.json({
      message: 'Invite token generated successfully.',
      token,
      expires_at: expiresAt,
      invite_url: `/join?token=${token}`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// Get invite info
authRouter.get('/invite/:token', (req: Request, res: Response): void => {
  const invite = db.prepare(`
    SELECT i.id, i.token, i.email, i.role, i.team_member_id, i.expires_at, i.used_at,
           t.name as member_name
    FROM invites i
    LEFT JOIN team_members t ON i.team_member_id = t.id
    WHERE i.token = ?
  `).get(req.params.token) as any;

  if (!invite) {
    res.status(404).json({ error: 'Invite token not found.' });
    return;
  }

  if (invite.used_at) {
    res.status(400).json({ error: 'This invitation has already been used.' });
    return;
  }

  if (new Date(invite.expires_at) < new Date()) {
    res.status(400).json({ error: 'This invitation link has expired.' });
    return;
  }

  res.json({ invite });
});

// Accept invite & register
authRouter.post('/accept-invite', async (req: Request, res: Response): Promise<void> => {
  try {
    const AcceptSchema = z.object({
      token: z.string(),
      password: z.string().min(8, 'Password must be at least 8 characters long'),
      display_name: z.string().min(2)
    });

    const { token, password, display_name } = AcceptSchema.parse(req.body);
    const invite = db.prepare('SELECT * FROM invites WHERE token = ?').get(token) as any;

    if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
      res.status(400).json({ error: 'Invalid or expired invitation token.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = 'user-' + crypto.randomUUID();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, role, team_member_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, invite.email, password_hash, display_name, invite.role, invite.team_member_id || null, now, now);

      db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(now, invite.id);

      if (invite.team_member_id) {
        db.prepare('UPDATE team_members SET user_id = ? WHERE id = ?').run(id, invite.team_member_id);
      }
    })();

    const user = db.prepare('SELECT id, email, display_name, role, team_member_id, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?').get(id) as User;

    logAudit({
      userId: user.id,
      userName: user.display_name,
      action: 'ACCEPT_INVITE',
      entityType: 'USER',
      entityId: user.id,
      details: `User registered via invite: ${user.email} as ${user.role}`,
      isSecurityEvent: 1
    });

    const authToken = generateToken(user);
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user, token: authToken, message: 'Account registered and activated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// Admin: List all users
authRouter.get('/users', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.display_name, u.role, u.team_member_id, u.is_active, u.created_at, u.updated_at,
           t.name as member_name, t.roles as member_roles
    FROM users u
    LEFT JOIN team_members t ON u.team_member_id = t.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ users });
});

// Admin: Update user role
authRouter.patch('/users/:id/role', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  const { role } = req.body;
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'Invalid role.' });
    return;
  }

  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, new Date().toISOString(), req.params.id);

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'UPDATE_ROLE',
    entityType: 'USER',
    entityId: req.params.id,
    details: `Updated role to ${role}`,
    isSecurityEvent: 1
  });

  res.json({ message: 'User role updated successfully.' });
});

// Admin: Toggle active status
authRouter.patch('/users/:id/status', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  const { is_active } = req.body;
  const statusVal = is_active ? 1 : 0;

  db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(statusVal, new Date().toISOString(), req.params.id);

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'TOGGLE_USER_STATUS',
    entityType: 'USER',
    entityId: req.params.id,
    details: `Updated active status to ${statusVal}`,
    isSecurityEvent: 1
  });

  res.json({ message: 'User status updated successfully.' });
});
