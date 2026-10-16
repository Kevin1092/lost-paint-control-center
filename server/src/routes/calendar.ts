import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const calendarRouter = Router();

const EventSchema = z.object({
  title: z.string().min(2),
  event_type: z.enum(['Meeting', 'Playtest', 'Deadline', 'Work Session', 'Marketing', 'Milestone']),
  start_time: z.string(),
  end_time: z.string().nullable().optional(),
  duration_minutes: z.number().nullable().optional(),
  participants: z.string().nullable().optional(), // JSON or comma-separated
  related_chapter_id: z.string().nullable().optional(),
  related_task_id: z.string().nullable().optional(),
  status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']).default('Scheduled'),
  notes: z.string().nullable().optional()
});

// GET /api/calendar (List events with filters: type, status, timeframe)
calendarRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { event_type, status, timeframe } = req.query;
  const now = new Date().toISOString();

  let query = `
    SELECT
      e.*,
      c.name as chapter_name,
      t.title as task_title,
      u.display_name as creator_name
    FROM calendar_events e
    LEFT JOIN chapters c ON e.related_chapter_id = c.id
    LEFT JOIN tasks t ON e.related_task_id = t.id
    LEFT JOIN users u ON e.creator_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (event_type) {
    query += ' AND e.event_type = ?';
    params.push(event_type);
  }
  if (status) {
    query += ' AND e.status = ?';
    params.push(status);
  }
  if (timeframe === 'upcoming') {
    query += ' AND e.start_time >= ?';
    params.push(now);
  } else if (timeframe === 'past') {
    query += ' AND e.start_time < ?';
    params.push(now);
  }

  query += ' ORDER BY e.start_time ASC';

  const events = db.prepare(query).all(...params);
  res.json({ events });
});

// POST /api/calendar
calendarRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = EventSchema.parse(req.body);
    const id = 'evt-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO calendar_events (
        id, title, event_type, start_time, end_time, duration_minutes,
        participants, related_chapter_id, related_task_id, status, creator_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.event_type,
      data.start_time,
      data.end_time || null,
      data.duration_minutes || null,
      data.participants || null,
      data.related_chapter_id || null,
      data.related_task_id || null,
      data.status,
      req.user!.id,
      data.notes || null,
      now,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'CALENDAR',
      entityId: id,
      details: `Scheduled ${data.event_type}: "${data.title}" at ${data.start_time}`
    });

    res.status(201).json({ id, message: 'Calendar event created.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/calendar/:id
calendarRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id FROM calendar_events WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }

    const data = EventSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE calendar_events SET
        title = ?, event_type = ?, start_time = ?, end_time = ?, duration_minutes = ?,
        participants = ?, related_chapter_id = ?, related_task_id = ?, status = ?,
        notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.title,
      data.event_type,
      data.start_time,
      data.end_time || null,
      data.duration_minutes || null,
      data.participants || null,
      data.related_chapter_id || null,
      data.related_task_id || null,
      data.status,
      data.notes || null,
      now,
      req.params.id
    );

    res.json({ message: 'Calendar event updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// DELETE /api/calendar/:id
calendarRouter.delete('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.json({ message: 'Calendar event deleted.' });
});
