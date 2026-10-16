import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const teamRouter = Router();

const MemberSchema = z.object({
  name: z.string().min(2),
  country: z.string().min(2),
  country_code: z.string().length(2),
  roles: z.string().min(2),
  skills: z.string().optional().default(''),
  is_founder: z.number().optional().default(0),
  can_record_gameplay: z.number().optional().default(0),
  status: z.enum(['active', 'inactive', 'on_leave']).default('active'),
  notes: z.string().optional().default('')
});

// Country code to flag emoji helper
export function getCountryFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// GET /api/team (List all members with computed task metrics and account status)
teamRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);

  const members = db.prepare(`
    SELECT
      tm.*,
      u.id as account_user_id,
      u.email as account_email,
      u.role as account_role,
      u.is_active as account_active,
      COUNT(ta.task_id) as total_tasks,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN t.status NOT IN ('Done', 'Cancelled') THEN 1 ELSE 0 END) as open_tasks,
      SUM(CASE WHEN t.status NOT IN ('Done', 'Cancelled') AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) as overdue_tasks
    FROM team_members tm
    LEFT JOIN users u ON tm.id = u.team_member_id
    LEFT JOIN task_assignees ta ON tm.id = ta.team_member_id
    LEFT JOIN tasks t ON ta.task_id = t.id
    GROUP BY tm.id
    ORDER BY tm.is_founder DESC, tm.name ASC
  `).all(today) as any[];

  const enriched = members.map(m => ({
    ...m,
    flag: getCountryFlag(m.country_code || 'US'),
    has_account: Boolean(m.account_user_id)
  }));

  res.json({ team: enriched });
});

// GET /api/team/:id (Single member with tasks and assigned media items)
teamRouter.get('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const member = db.prepare(`
    SELECT tm.*, u.email as account_email, u.role as account_role
    FROM team_members tm
    LEFT JOIN users u ON tm.id = u.team_member_id
    WHERE tm.id = ?
  `).get(req.params.id) as any;

  if (!member) {
    res.status(404).json({ error: 'Team member not found.' });
    return;
  }

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.category, t.due_date
    FROM tasks t
    JOIN task_assignees ta ON t.id = ta.task_id
    WHERE ta.team_member_id = ?
    ORDER BY t.created_at DESC
  `).all(member.id);

  const mediaItems = db.prepare(`
    SELECT m.id, m.title, m.media_type, m.status, mpa.assignment_role
    FROM media_production_items m
    JOIN media_production_assignees mpa ON m.id = mpa.item_id
    WHERE mpa.team_member_id = ?
  `).all(member.id);

  res.json({
    member: {
      ...member,
      flag: getCountryFlag(member.country_code || 'US'),
      tasks,
      mediaItems
    }
  });
});

// POST /api/team (Create team member)
teamRouter.post('/', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const data = MemberSchema.parse(req.body);
    const id = 'member-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO team_members (
        id, name, country, country_code, roles, skills, is_founder,
        can_record_gameplay, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.country,
      data.country_code.toUpperCase(),
      data.roles,
      data.skills || '',
      data.is_founder || 0,
      data.can_record_gameplay || 0,
      data.status || 'active',
      data.notes || '',
      now,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'TEAM',
      entityId: id,
      details: `Added new team profile: ${data.name} (${data.roles})`
    });

    res.status(201).json({ id, message: 'Team member profile created.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/team/:id (Update team member)
teamRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id FROM team_members WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }

    const data = MemberSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE team_members SET
        name = ?, country = ?, country_code = ?, roles = ?, skills = ?,
        is_founder = ?, can_record_gameplay = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name,
      data.country,
      data.country_code.toUpperCase(),
      data.roles,
      data.skills || '',
      data.is_founder || 0,
      data.can_record_gameplay || 0,
      data.status || 'active',
      data.notes || '',
      now,
      req.params.id
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'UPDATE',
      entityType: 'TEAM',
      entityId: req.params.id,
      details: `Updated profile for ${data.name}`
    });

    res.json({ message: 'Team member profile updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// DELETE /api/team/:id (Admin only; safe removal/soft-delete check)
teamRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  const existing = db.prepare('SELECT name, is_founder FROM team_members WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Team member not found.' });
    return;
  }

  // Prevent deleting founders directly
  if (existing.is_founder === 1) {
    res.status(400).json({ error: 'Cannot delete studio founder profile. You can set their status to inactive instead.' });
    return;
  }

  // Soft deactivate or delete
  db.prepare("UPDATE team_members SET status = 'inactive', updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    req.params.id
  );

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'ARCHIVE',
    entityType: 'TEAM',
    entityId: req.params.id,
    details: `Marked team profile ${existing.name} as inactive`
  });

  res.json({ message: 'Team member archived as inactive.' });
});
