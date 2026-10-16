import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const bugsRouter = Router();

const BugSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  reproduction_steps: z.string().optional().default(''),
  expected_result: z.string().optional().default(''),
  actual_result: z.string().optional().default(''),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
  status: z.enum(['New', 'Confirmed', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Won’t Fix']).default('New'),
  assignee_id: z.string().nullable().optional(),
  date_found: z.string(),
  related_chapter_id: z.string().nullable().optional(),
  related_task_id: z.string().nullable().optional(),
  platform: z.string().optional().default('Steam / PC'),
  unity_build_version: z.string().optional().default(''),
  evidence_links: z.string().optional().default(''),
  resolution_notes: z.string().optional().default('')
});

// GET /api/bugs
bugsRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { severity, status, platform, assignee_id, chapter_id, search } = req.query;

  let query = `
    SELECT
      b.*,
      tm.name as assignee_name,
      tm.country_code as assignee_country,
      c.name as chapter_name,
      t.title as task_title
    FROM bugs b
    LEFT JOIN team_members tm ON b.assignee_id = tm.id
    LEFT JOIN chapters c ON b.related_chapter_id = c.id
    LEFT JOIN tasks t ON b.related_task_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (severity) {
    query += ' AND b.severity = ?';
    params.push(severity);
  }
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  if (platform) {
    query += ' AND b.platform = ?';
    params.push(platform);
  }
  if (assignee_id) {
    query += ' AND b.assignee_id = ?';
    params.push(assignee_id);
  }
  if (chapter_id) {
    query += ' AND b.related_chapter_id = ?';
    params.push(chapter_id);
  }
  if (search && typeof search === 'string') {
    query += ' AND (b.title LIKE ? OR b.description LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }

  query += `
    ORDER BY
      CASE b.severity WHEN "Critical" THEN 1 WHEN "High" THEN 2 WHEN "Medium" THEN 3 ELSE 4 END,
      b.created_at DESC
  `;

  const bugs = db.prepare(query).all(...params);
  res.json({ bugs });
});

// GET /api/bugs/:id
bugsRouter.get('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const bug = db.prepare(`
    SELECT b.*, tm.name as assignee_name, c.name as chapter_name, t.title as task_title
    FROM bugs b
    LEFT JOIN team_members tm ON b.assignee_id = tm.id
    LEFT JOIN chapters c ON b.related_chapter_id = c.id
    LEFT JOIN tasks t ON b.related_task_id = t.id
    WHERE b.id = ?
  `).get(req.params.id) as any;

  if (!bug) {
    res.status(404).json({ error: 'Bug report not found.' });
    return;
  }

  const comments = db.prepare(`
    SELECT * FROM bug_comments WHERE bug_id = ? ORDER BY created_at ASC
  `).all(bug.id);

  res.json({ bug: { ...bug, comments } });
});

// POST /api/bugs
bugsRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = BugSchema.parse(req.body);
    const id = 'bug-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO bugs (
        id, title, description, reproduction_steps, expected_result, actual_result,
        severity, status, reporter_id, reporter_name, assignee_id, date_found,
        related_chapter_id, related_task_id, platform, unity_build_version,
        evidence_links, resolution_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.description,
      data.reproduction_steps || '',
      data.expected_result || '',
      data.actual_result || '',
      data.severity,
      data.status,
      req.user!.id,
      req.user!.display_name,
      data.assignee_id || null,
      data.date_found,
      data.related_chapter_id || null,
      data.related_task_id || null,
      data.platform || 'Steam / PC',
      data.unity_build_version || '',
      data.evidence_links || '',
      data.resolution_notes || '',
      now,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'BUG',
      entityId: id,
      details: `Reported [${data.severity}] bug: "${data.title}"`
    });

    res.status(201).json({ id, message: 'Bug reported successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/bugs/:id
bugsRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id, status FROM bugs WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Bug report not found.' });
      return;
    }

    const data = BugSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE bugs SET
        title = ?, description = ?, reproduction_steps = ?, expected_result = ?, actual_result = ?,
        severity = ?, status = ?, assignee_id = ?, date_found = ?, related_chapter_id = ?,
        related_task_id = ?, platform = ?, unity_build_version = ?, evidence_links = ?,
        resolution_notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.title,
      data.description,
      data.reproduction_steps || '',
      data.expected_result || '',
      data.actual_result || '',
      data.severity,
      data.status,
      data.assignee_id || null,
      data.date_found,
      data.related_chapter_id || null,
      data.related_task_id || null,
      data.platform || 'Steam / PC',
      data.unity_build_version || '',
      data.evidence_links || '',
      data.resolution_notes || '',
      now,
      req.params.id
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'UPDATE',
      entityType: 'BUG',
      entityId: req.params.id,
      details: `Updated bug "${data.title}" to status ${data.status}`
    });

    res.json({ message: 'Bug report updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PATCH /api/bugs/:id/status
bugsRouter.patch('/:id/status', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { status, resolution_notes } = req.body;
  const validStatuses = ['New', 'Confirmed', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Won’t Fix'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid bug status.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE bugs SET status = ?, resolution_notes = COALESCE(?, resolution_notes), updated_at = ?
    WHERE id = ?
  `).run(status, resolution_notes || null, now, req.params.id);

  res.json({ message: 'Bug status updated.' });
});

// DELETE /api/bugs/:id
bugsRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM bugs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Bug report deleted.' });
});

// POST /api/bugs/:id/comments
bugsRouter.post('/:id/comments', requireAuth, (req: AuthRequest, res: Response): void => {
  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: 'Comment content is required.' });
    return;
  }

  const id = 'bcmt-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO bug_comments (id, bug_id, author_name, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.id, req.user!.display_name, content, now);

  res.status(201).json({ id, message: 'Comment added.' });
});
