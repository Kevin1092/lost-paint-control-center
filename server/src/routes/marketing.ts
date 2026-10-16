import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const marketingRouter = Router();

const MarketingSchema = z.object({
  title: z.string().min(2),
  platform: z.string().default('Instagram'),
  format: z.string().default('Post'),
  caption: z.string().optional().default(''),
  media_url: z.string().optional().default(''),
  planned_publish_date: z.string().nullable().optional(),
  status: z.enum(['Idea', 'Draft', 'Ready for Review', 'Approved', 'Scheduled', 'Published', 'Archived']).default('Idea'),
  owner_id: z.string().nullable().optional(),
  reviewer_id: z.string().nullable().optional(),
  tags: z.string().optional().default(''),
  related_chapter_id: z.string().nullable().optional(),
  published_url: z.string().optional().default(''),
  performance_notes: z.string().optional().default('')
});

// GET /api/marketing
marketingRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { platform, status, format, owner_id } = req.query;

  let query = `
    SELECT
      m.*,
      owner.name as owner_name,
      owner.country_code as owner_country,
      reviewer.name as reviewer_name,
      c.name as chapter_name
    FROM marketing_items m
    LEFT JOIN team_members owner ON m.owner_id = owner.id
    LEFT JOIN team_members reviewer ON m.reviewer_id = reviewer.id
    LEFT JOIN chapters c ON m.related_chapter_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (platform) {
    query += ' AND m.platform = ?';
    params.push(platform);
  }
  if (status) {
    query += ' AND m.status = ?';
    params.push(status);
  }
  if (format) {
    query += ' AND m.format = ?';
    params.push(format);
  }
  if (owner_id) {
    query += ' AND m.owner_id = ?';
    params.push(owner_id);
  }

  query += ' ORDER BY CASE WHEN m.planned_publish_date IS NULL THEN 1 ELSE 0 END, m.planned_publish_date ASC, m.created_at DESC';

  const items = db.prepare(query).all(...params);
  res.json({ items });
});

// POST /api/marketing
marketingRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = MarketingSchema.parse(req.body);
    const id = 'mkt-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO marketing_items (
        id, title, platform, format, caption, media_url,
        planned_publish_date, status, owner_id, reviewer_id,
        tags, related_chapter_id, published_url, performance_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title,
      data.platform,
      data.format,
      data.caption || '',
      data.media_url || '',
      data.planned_publish_date || null,
      data.status,
      data.owner_id || null,
      data.reviewer_id || null,
      data.tags || '',
      data.related_chapter_id || null,
      data.published_url || '',
      data.performance_notes || '',
      now,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'MARKETING',
      entityId: id,
      details: `Added ${data.platform} ${data.format}: "${data.title}"`
    });

    res.status(201).json({ id, message: 'Marketing item created.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/marketing/:id
marketingRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id FROM marketing_items WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Marketing item not found.' });
      return;
    }

    const data = MarketingSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE marketing_items SET
        title = ?, platform = ?, format = ?, caption = ?, media_url = ?,
        planned_publish_date = ?, status = ?, owner_id = ?, reviewer_id = ?,
        tags = ?, related_chapter_id = ?, published_url = ?, performance_notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.title,
      data.platform,
      data.format,
      data.caption || '',
      data.media_url || '',
      data.planned_publish_date || null,
      data.status,
      data.owner_id || null,
      data.reviewer_id || null,
      data.tags || '',
      data.related_chapter_id || null,
      data.published_url || '',
      data.performance_notes || '',
      now,
      req.params.id
    );

    res.json({ message: 'Marketing item updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PATCH /api/marketing/:id/status
marketingRouter.patch('/:id/status', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { status, published_url } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE marketing_items SET
      status = ?,
      published_url = COALESCE(?, published_url),
      updated_at = ?
    WHERE id = ?
  `).run(status, published_url || null, now, req.params.id);

  res.json({ message: 'Status updated.' });
});

// DELETE /api/marketing/:id
marketingRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM marketing_items WHERE id = ?').run(req.params.id);
  res.json({ message: 'Marketing item deleted.' });
});
