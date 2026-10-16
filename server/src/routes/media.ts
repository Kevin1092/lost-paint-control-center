import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const mediaRouter = Router();

const MediaSchema = z.object({
  title: z.string().min(2),
  media_type: z.string().default('Trailer'),
  objective: z.string().optional().default(''),
  status: z.enum(['Planned', 'Recording', 'Editing', 'Review', 'Approved', 'Exported', 'Published']).default('Planned'),
  related_chapter_id: z.string().nullable().optional(),
  planned_recording_date: z.string().nullable().optional(),
  raw_footage_url: z.string().optional().default(''),
  final_export_url: z.string().optional().default(''),
  aspect_ratio: z.string().default('16:9'),
  deadline: z.string().nullable().optional(),
  publication_url: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  checklist: z.string().optional().default('[]'),
  assignees: z.array(z.object({
    team_member_id: z.string(),
    assignment_role: z.string().default('recorder')
  })).optional().default([])
});

// GET /api/media
mediaRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { status, media_type, chapter_id } = req.query;

  let query = `
    SELECT
      m.*,
      c.name as chapter_name
    FROM media_production_items m
    LEFT JOIN chapters c ON m.related_chapter_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ' AND m.status = ?';
    params.push(status);
  }
  if (media_type) {
    query += ' AND m.media_type = ?';
    params.push(media_type);
  }
  if (chapter_id) {
    query += ' AND m.related_chapter_id = ?';
    params.push(chapter_id);
  }

  query += ' ORDER BY m.created_at DESC';

  const items = db.prepare(query).all(...params) as any[];

  // Attach assignees
  const itemIds = items.map(i => i.id);
  let assigneesByItem: Record<string, any[]> = {};

  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',');
    const assignees = db.prepare(`
      SELECT mpa.item_id, mpa.assignment_role, tm.id as team_member_id, tm.name, tm.country_code
      FROM media_production_assignees mpa
      JOIN team_members tm ON mpa.team_member_id = tm.id
      WHERE mpa.item_id IN (${placeholders})
    `).all(...itemIds) as any[];

    for (const a of assignees) {
      if (!assigneesByItem[a.item_id]) assigneesByItem[a.item_id] = [];
      assigneesByItem[a.item_id].push(a);
    }
  }

  const enriched = items.map(i => ({
    ...i,
    assignees: assigneesByItem[i.id] || []
  }));

  res.json({ mediaItems: enriched });
});

// POST /api/media
mediaRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = MediaSchema.parse(req.body);
    const id = 'media-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO media_production_items (
          id, title, media_type, objective, status, related_chapter_id,
          planned_recording_date, raw_footage_url, final_export_url,
          aspect_ratio, deadline, publication_url, notes, checklist, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.title,
        data.media_type,
        data.objective || '',
        data.status,
        data.related_chapter_id || null,
        data.planned_recording_date || null,
        data.raw_footage_url || '',
        data.final_export_url || '',
        data.aspect_ratio || '16:9',
        data.deadline || null,
        data.publication_url || '',
        data.notes || '',
        data.checklist || '[]',
        now,
        now
      );

      const insertAssignee = db.prepare(`
        INSERT INTO media_production_assignees (item_id, team_member_id, assignment_role)
        VALUES (?, ?, ?)
      `);
      for (const a of data.assignees) {
        insertAssignee.run(id, a.team_member_id, a.assignment_role);
      }
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'MEDIA',
      entityId: id,
      details: `Added media asset: "${data.title}" (${data.media_type})`
    });

    res.status(201).json({ id, message: 'Media production item created.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/media/:id
mediaRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id FROM media_production_items WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    const data = MediaSchema.parse(req.body);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        UPDATE media_production_items SET
          title = ?, media_type = ?, objective = ?, status = ?, related_chapter_id = ?,
          planned_recording_date = ?, raw_footage_url = ?, final_export_url = ?,
          aspect_ratio = ?, deadline = ?, publication_url = ?, notes = ?, checklist = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.title,
        data.media_type,
        data.objective || '',
        data.status,
        data.related_chapter_id || null,
        data.planned_recording_date || null,
        data.raw_footage_url || '',
        data.final_export_url || '',
        data.aspect_ratio || '16:9',
        data.deadline || null,
        data.publication_url || '',
        data.notes || '',
        data.checklist || '[]',
        now,
        req.params.id
      );

      db.prepare('DELETE FROM media_production_assignees WHERE item_id = ?').run(req.params.id);
      const insertAssignee = db.prepare(`
        INSERT INTO media_production_assignees (item_id, team_member_id, assignment_role)
        VALUES (?, ?, ?)
      `);
      for (const a of data.assignees) {
        insertAssignee.run(req.params.id, a.team_member_id, a.assignment_role);
      }
    })();

    res.json({ message: 'Media item updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PATCH /api/media/:id/status
mediaRouter.patch('/:id/status', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { status } = req.body;
  const now = new Date().toISOString();
  db.prepare('UPDATE media_production_items SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id);
  res.json({ message: 'Media status updated.' });
});

// DELETE /api/media/:id
mediaRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM media_production_items WHERE id = ?').run(req.params.id);
  res.json({ message: 'Media item deleted.' });
});
