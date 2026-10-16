import { Router, Response } from 'express';
import { db } from '../db/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const auditRouter = Router();

// GET /api/audit
auditRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { action, entity_type, user_name, security_only, search } = req.query;
  const isAdmin = req.user?.role === 'admin';

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  // Non-admins cannot see raw security events
  if (!isAdmin) {
    query += ' AND is_security_event = 0';
  } else if (security_only === 'true') {
    query += ' AND is_security_event = 1';
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }
  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (user_name) {
    query += ' AND user_name = ?';
    params.push(user_name);
  }
  if (search && typeof search === 'string') {
    query += ' AND (details LIKE ? OR action LIKE ? OR entity_type LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});
