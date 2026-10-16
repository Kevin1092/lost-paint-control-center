import crypto from 'crypto';
import { db } from '../db/database';

export function logAudit({
  userId,
  userName,
  action,
  entityType,
  entityId,
  details,
  ipAddress,
  isSecurityEvent = 0
}: {
  userId?: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  isSecurityEvent?: number;
}) {
  try {
    const id = 'audit-' + crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, ip_address, is_security_event, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId || null, userName, action, entityType, entityId || null, details || null, ipAddress || null, isSecurityEvent, now);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
