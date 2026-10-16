import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const devlogsRouter = Router();

const DevlogSchema = z.object({
  log_date: z.string(),
  done: z.string().optional().default(''),
  in_progress: z.string().optional().default(''),
  blocked: z.string().optional().default(''),
  next_steps: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  linked_chapter_id: z.string().nullable().optional(),
  linked_task_ids: z.string().nullable().optional(), // JSON array string
  attachments: z.string().nullable().optional(),
  update_task_statuses: z.record(z.string()).optional() // Optional map of taskId -> newStatus
});

// GET /api/devlogs
devlogsRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { author_id, chapter_id, search, from_date, to_date } = req.query;

  let query = `
    SELECT
      d.*,
      c.name as chapter_name,
      u.display_name as user_name
    FROM development_logs d
    LEFT JOIN chapters c ON d.linked_chapter_id = c.id
    LEFT JOIN users u ON d.author_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (author_id) {
    query += ' AND d.author_id = ?';
    params.push(author_id);
  }
  if (chapter_id) {
    query += ' AND d.linked_chapter_id = ?';
    params.push(chapter_id);
  }
  if (from_date) {
    query += ' AND d.log_date >= ?';
    params.push(from_date);
  }
  if (to_date) {
    query += ' AND d.log_date <= ?';
    params.push(to_date);
  }
  if (search && typeof search === 'string') {
    query += ' AND (d.done LIKE ? OR d.in_progress LIKE ? OR d.blocked LIKE ? OR d.notes LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY d.log_date DESC, d.created_at DESC';

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

// POST /api/devlogs
devlogsRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = DevlogSchema.parse(req.body);
    const id = 'log-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO development_logs (
          id, log_date, author_id, author_name, done, in_progress,
          blocked, next_steps, notes, linked_chapter_id, linked_task_ids, attachments, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.log_date,
        req.user!.id,
        req.user!.display_name,
        data.done || '',
        data.in_progress || '',
        data.blocked || '',
        data.next_steps || '',
        data.notes || '',
        data.linked_chapter_id || null,
        data.linked_task_ids || null,
        data.attachments || null,
        now,
        now
      );

      // If user explicitly checked tasks to update:
      if (data.update_task_statuses) {
        const updateTaskStmt = db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
        for (const [taskId, newStatus] of Object.entries(data.update_task_statuses)) {
          updateTaskStmt.run(newStatus, now, taskId);
        }
      }
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'DEVLOG',
      entityId: id,
      details: `Submitted dev log for date ${data.log_date}`
    });

    res.status(201).json({ id, message: 'Development log saved.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/devlogs/:id
devlogsRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id FROM development_logs WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Log not found.' });
      return;
    }

    const data = DevlogSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE development_logs SET
        log_date = ?, done = ?, in_progress = ?, blocked = ?, next_steps = ?,
        notes = ?, linked_chapter_id = ?, linked_task_ids = ?, attachments = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.log_date,
      data.done || '',
      data.in_progress || '',
      data.blocked || '',
      data.next_steps || '',
      data.notes || '',
      data.linked_chapter_id || null,
      data.linked_task_ids || null,
      data.attachments || null,
      now,
      req.params.id
    );

    res.json({ message: 'Development log updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// DELETE /api/devlogs/:id
devlogsRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM development_logs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Development log deleted.' });
});
