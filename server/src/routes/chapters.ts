import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const chaptersRouter = Router();

const ChapterSchema = z.object({
  name: z.string().min(2),
  day_range: z.string(),
  summary: z.string().optional().default(''),
  status: z.enum(['Planned', 'In Progress', 'Blocked', 'Completed']).default('Planned'),
  owner_id: z.string().nullable().optional(),
  target_start_date: z.string().nullable().optional(),
  target_end_date: z.string().nullable().optional(),
  risks: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  acceptance_criteria: z.string().nullable().optional(),
  order_index: z.number().optional()
});

// GET /api/chapters (List all chapters with computed task progress & milestones)
chaptersRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const chapters = db.prepare(`
    SELECT
      c.*,
      tm.name as owner_name,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) as completed_tasks
    FROM chapters c
    LEFT JOIN team_members tm ON c.owner_id = tm.id
    LEFT JOIN tasks t ON c.id = t.chapter_id
    GROUP BY c.id
    ORDER BY c.order_index ASC
  `).all() as any[];

  const milestones = db.prepare(`
    SELECT * FROM milestones ORDER BY target_date ASC, created_at ASC
  `).all() as any[];

  const milestonesByChapter: Record<string, any[]> = {};
  for (const ms of milestones) {
    if (!milestonesByChapter[ms.chapter_id]) milestonesByChapter[ms.chapter_id] = [];
    milestonesByChapter[ms.chapter_id].push(ms);
  }

  const enriched = chapters.map(c => {
    const chMilestones = milestonesByChapter[c.id] || [];
    const totalMilestones = chMilestones.length;
    const completedMilestones = chMilestones.filter((m: any) => m.status === 'Completed').length;

    let progressPercent = 0;
    if (c.status === 'Completed') {
      progressPercent = 100;
    } else {
      const totalUnits = (c.total_tasks || 0) + totalMilestones;
      const completedUnits = (c.completed_tasks || 0) + completedMilestones;
      if (totalUnits > 0) {
        progressPercent = Math.min(100, Math.max(0, Math.round((completedUnits / totalUnits) * 100)));
      }
    }

    return {
      ...c,
      total_tasks: c.total_tasks || 0,
      completed_tasks: c.completed_tasks || 0,
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones,
      progress_percent: progressPercent,
      milestones: chMilestones
    };
  });

  res.json({ chapters: enriched });
});

// GET /api/chapters/:id
chaptersRouter.get('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const chapter = db.prepare(`
    SELECT c.*, tm.name as owner_name
    FROM chapters c
    LEFT JOIN team_members tm ON c.owner_id = tm.id
    WHERE c.id = ?
  `).get(req.params.id) as any;

  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found.' });
    return;
  }

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.category, t.estimate_hours, t.due_date
    FROM tasks t
    WHERE t.chapter_id = ?
    ORDER BY t.created_at DESC
  `).all(chapter.id) as any[];

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Done').length;

  const milestones = db.prepare(`
    SELECT * FROM milestones WHERE chapter_id = ? ORDER BY created_at ASC
  `).all(chapter.id) as any[];

  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m: any) => m.status === 'Completed').length;

  let progressPercent = 0;
  if (chapter.status === 'Completed') {
    progressPercent = 100;
  } else {
    const totalUnits = totalTasks + totalMilestones;
    const completedUnits = completedTasks + completedMilestones;
    if (totalUnits > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((completedUnits / totalUnits) * 100)));
    }
  }

  res.json({
    chapter: {
      ...chapter,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones,
      progress_percent: progressPercent,
      milestones,
      tasks
    }
  });
});

// POST /api/chapters
chaptersRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = ChapterSchema.parse(req.body);
    const id = 'chapter-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const maxOrder = db.prepare('SELECT MAX(order_index) as max_order FROM chapters').get() as any;
    const orderIndex = data.order_index ?? ((maxOrder?.max_order || 0) + 1);

    db.prepare(`
      INSERT INTO chapters (
        id, order_index, name, day_range, summary, status, owner_id,
        target_start_date, target_end_date, risks, notes, acceptance_criteria, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orderIndex,
      data.name,
      data.day_range,
      data.summary || '',
      data.status,
      data.owner_id || null,
      data.target_start_date || null,
      data.target_end_date || null,
      data.risks || null,
      data.notes || null,
      data.acceptance_criteria || null,
      now,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'CHAPTER',
      entityId: id,
      details: `Created roadmap chapter "${data.name}" (${data.day_range})`
    });

    res.status(201).json({ id, message: 'Chapter created successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/chapters/:id
chaptersRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT id FROM chapters WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    const data = ChapterSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE chapters SET
        name = ?, day_range = ?, summary = ?, status = ?, owner_id = ?,
        target_start_date = ?, target_end_date = ?, risks = ?, notes = ?,
        acceptance_criteria = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name,
      data.day_range,
      data.summary || '',
      data.status,
      data.owner_id || null,
      data.target_start_date || null,
      data.target_end_date || null,
      data.risks || null,
      data.notes || null,
      data.acceptance_criteria || null,
      now,
      req.params.id
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'UPDATE',
      entityType: 'CHAPTER',
      entityId: req.params.id,
      details: `Updated roadmap chapter "${data.name}"`
    });

    res.json({ message: 'Chapter updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// DELETE /api/chapters/:id
chaptersRouter.delete('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const existing = db.prepare('SELECT name FROM chapters WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Chapter not found.' });
    return;
  }

  // Clean up any tasks or milestones linked to this chapter
  db.prepare('UPDATE tasks SET chapter_id = NULL WHERE chapter_id = ?').run(req.params.id);
  db.prepare('DELETE FROM milestones WHERE chapter_id = ?').run(req.params.id);
  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'DELETE',
    entityType: 'CHAPTER',
    entityId: req.params.id,
    details: `Deleted roadmap chapter "${existing.name}"`
  });

  res.json({ message: 'Chapter deleted.' });
});

// POST /api/chapters/:id/milestones (Add milestone)
chaptersRouter.post('/:id/milestones', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { title, description, target_date, status } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Milestone title is required.' });
    return;
  }

  const id = 'ms-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO milestones (id, chapter_id, title, description, target_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, title, description || null, target_date || null, status || 'Pending', now, now);

  res.status(201).json({ id, message: 'Milestone added.' });
});

// PATCH /api/chapters/milestones/:milestoneId (Update milestone status)
chaptersRouter.patch('/milestones/:milestoneId', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { status, title, target_date } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE milestones SET
      status = COALESCE(?, status),
      title = COALESCE(?, title),
      target_date = COALESCE(?, target_date),
      updated_at = ?
    WHERE id = ?
  `).run(status || null, title || null, target_date || null, now, req.params.milestoneId);

  res.json({ message: 'Milestone updated.' });
});

// DELETE /api/chapters/milestones/:milestoneId (Delete milestone)
chaptersRouter.delete('/milestones/:milestoneId', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const existing = db.prepare('SELECT title, chapter_id FROM milestones WHERE id = ?').get(req.params.milestoneId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Milestone not found.' });
    return;
  }

  // Detach any tasks referencing this milestone
  db.prepare('UPDATE tasks SET milestone_id = NULL WHERE milestone_id = ?').run(req.params.milestoneId);
  db.prepare('DELETE FROM milestones WHERE id = ?').run(req.params.milestoneId);

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'DELETE',
    entityType: 'MILESTONE',
    entityId: req.params.milestoneId,
    details: `Deleted milestone "${existing.title}"`
  });

  res.json({ message: 'Milestone deleted.' });
});
