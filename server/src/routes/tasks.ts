import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const tasksRouter = Router();

const TaskSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional().default(''),
  status: z.enum(['Backlog', 'To Do', 'In Progress', 'Blocked', 'In Review', 'Done', 'Cancelled']).default('To Do'),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
  category: z.enum([
    'Visual Scripting',
    'Coding',
    'Level Design',
    'UI',
    '3D Art',
    'Texturing',
    'Story',
    'Music',
    'QA',
    'Marketing',
    'Video',
    'Management',
    'Other'
  ]),
  chapter_id: z.string().nullable().optional(),
  milestone_id: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  estimate_hours: z.number().nullable().optional(),
  tags: z.string().nullable().optional(),
  dependencies: z.string().nullable().optional(),
  acceptance_criteria: z.string().nullable().optional(),
  assignee_ids: z.array(z.string()).optional().default([])
});

// GET /api/tasks (with filters: status, category, priority, chapter_id, assignee_id, search)
tasksRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { status, category, priority, chapter_id, assignee_id, search } = req.query;

  let query = `
    SELECT
      t.*,
      c.name as chapter_name,
      m.title as milestone_title,
      u.display_name as creator_name
    FROM tasks t
    LEFT JOIN chapters c ON t.chapter_id = c.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    LEFT JOIN users u ON t.creator_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (category) {
    query += ' AND t.category = ?';
    params.push(category);
  }
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }
  if (chapter_id) {
    query += ' AND t.chapter_id = ?';
    params.push(chapter_id);
  }
  if (assignee_id) {
    query += ' AND t.id IN (SELECT task_id FROM task_assignees WHERE team_member_id = ?)';
    params.push(assignee_id);
  }
  if (search && typeof search === 'string') {
    query += ' AND (t.title LIKE ? OR t.description LIKE ? OR t.tags LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += " ORDER BY CASE t.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Normal' THEN 3 ELSE 4 END, t.created_at DESC";

  const tasks = db.prepare(query).all(...params) as any[];

  // Attach assignees and subtasks
  const taskIds = tasks.map(t => t.id);
  let assigneesByTask: Record<string, any[]> = {};
  let subtasksByTask: Record<string, any[]> = {};

  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',');
    const assignees = db.prepare(`
      SELECT ta.task_id, tm.id, tm.name, tm.country_code, tm.roles
      FROM task_assignees ta
      JOIN team_members tm ON ta.team_member_id = tm.id
      WHERE ta.task_id IN (${placeholders})
    `).all(...taskIds) as any[];

    for (const a of assignees) {
      if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
      assigneesByTask[a.task_id].push(a);
    }

    const subtasks = db.prepare(`
      SELECT id, task_id, title, is_completed, order_index
      FROM subtasks
      WHERE task_id IN (${placeholders})
      ORDER BY order_index ASC
    `).all(...taskIds) as any[];

    for (const st of subtasks) {
      if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
      subtasksByTask[st.task_id].push(st);
    }
  }

  const enrichedTasks = tasks.map(t => ({
    ...t,
    assignees: assigneesByTask[t.id] || [],
    subtasks: subtasksByTask[t.id] || []
  }));

  res.json({ tasks: enrichedTasks });
});

// GET /api/tasks/:id (Single task with full details, assignees, subtasks, comments)
tasksRouter.get('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const task = db.prepare(`
    SELECT t.*, c.name as chapter_name, m.title as milestone_title, u.display_name as creator_name
    FROM tasks t
    LEFT JOIN chapters c ON t.chapter_id = c.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    LEFT JOIN users u ON t.creator_id = u.id
    WHERE t.id = ?
  `).get(req.params.id) as any;

  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  const assignees = db.prepare(`
    SELECT tm.id, tm.name, tm.country_code, tm.roles
    FROM task_assignees ta
    JOIN team_members tm ON ta.team_member_id = tm.id
    WHERE ta.task_id = ?
  `).all(task.id);

  const subtasks = db.prepare(`
    SELECT id, task_id, title, is_completed, order_index
    FROM subtasks
    WHERE task_id = ?
    ORDER BY order_index ASC
  `).all(task.id);

  const comments = db.prepare(`
    SELECT id, task_id, author_id, author_name, content, created_at
    FROM task_comments
    WHERE task_id = ?
    ORDER BY created_at ASC
  `).all(task.id);

  res.json({
    task: {
      ...task,
      assignees,
      subtasks,
      comments
    }
  });
});

// POST /api/tasks (Create task)
tasksRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = TaskSchema.parse(req.body);
    const id = 'task-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const completed_at = data.status === 'Done' ? now : null;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO tasks (
          id, title, description, status, priority, category, creator_id,
          chapter_id, milestone_id, start_date, due_date, estimate_hours,
          tags, dependencies, acceptance_criteria, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.title,
        data.description || '',
        data.status,
        data.priority,
        data.category,
        req.user!.id,
        data.chapter_id || null,
        data.milestone_id || null,
        data.start_date || null,
        data.due_date || null,
        data.estimate_hours || null,
        data.tags || null,
        data.dependencies || null,
        data.acceptance_criteria || null,
        completed_at,
        now,
        now
      );

      const insertAssignee = db.prepare('INSERT INTO task_assignees (task_id, team_member_id) VALUES (?, ?)');
      for (const memberId of data.assignee_ids) {
        insertAssignee.run(id, memberId);
      }
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'TASK',
      entityId: id,
      details: `Created task "${data.title}" in category ${data.category}`
    });

    res.status(201).json({ id, message: 'Task created successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/tasks/:id (Update task)
tasksRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const data = TaskSchema.parse(req.body);
    const now = new Date().toISOString();
    let completed_at = existing.completed_at;

    if (data.status === 'Done' && existing.status !== 'Done') {
      completed_at = now;
    } else if (data.status !== 'Done') {
      completed_at = null;
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE tasks SET
          title = ?, description = ?, status = ?, priority = ?, category = ?,
          chapter_id = ?, milestone_id = ?, start_date = ?, due_date = ?,
          estimate_hours = ?, tags = ?, dependencies = ?, acceptance_criteria = ?,
          completed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.title,
        data.description || '',
        data.status,
        data.priority,
        data.category,
        data.chapter_id || null,
        data.milestone_id || null,
        data.start_date || null,
        data.due_date || null,
        data.estimate_hours || null,
        data.tags || null,
        data.dependencies || null,
        data.acceptance_criteria || null,
        completed_at,
        now,
        req.params.id
      );

      // Re-assign members
      db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(req.params.id);
      const insertAssignee = db.prepare('INSERT INTO task_assignees (task_id, team_member_id) VALUES (?, ?)');
      for (const memberId of data.assignee_ids) {
        insertAssignee.run(req.params.id, memberId);
      }
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'UPDATE',
      entityType: 'TASK',
      entityId: req.params.id,
      details: `Updated task "${data.title}" status to ${data.status}`
    });

    res.json({ message: 'Task updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PATCH /api/tasks/:id/status (Quick status change for Kanban drag-and-drop)
tasksRouter.patch('/:id/status', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { status } = req.body;
  const validStatuses = ['Backlog', 'To Do', 'In Progress', 'Blocked', 'In Review', 'Done', 'Cancelled'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid task status.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  const now = new Date().toISOString();
  const completed_at = status === 'Done' ? now : null;

  db.prepare(`
    UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
  `).run(status, completed_at, now, req.params.id);

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'STATUS_CHANGE',
    entityType: 'TASK',
    entityId: req.params.id,
    details: `Moved task "${existing.title}" from ${existing.status} to ${status}`
  });

  res.json({ message: 'Status updated.' });
});

// DELETE /api/tasks/:id
tasksRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  const existing = db.prepare('SELECT title FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'DELETE',
    entityType: 'TASK',
    entityId: req.params.id,
    details: `Deleted task "${existing.title}"`
  });

  res.json({ message: 'Task deleted successfully.' });
});

// POST /api/tasks/:id/subtasks (Add subtask)
tasksRouter.post('/:id/subtasks', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { title } = req.body;
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Subtask title is required.' });
    return;
  }

  const id = 'sub-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  const countRow = db.prepare('SELECT COUNT(*) as count FROM subtasks WHERE task_id = ?').get(req.params.id) as any;
  const orderIndex = (countRow?.count || 0) + 1;

  db.prepare(`
    INSERT INTO subtasks (id, task_id, title, is_completed, order_index, created_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, req.params.id, title, orderIndex, now);

  res.status(201).json({ id, message: 'Subtask added.' });
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId (Toggle subtask)
tasksRouter.patch('/:taskId/subtasks/:subtaskId', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  const { is_completed } = req.body;
  db.prepare('UPDATE subtasks SET is_completed = ? WHERE id = ? AND task_id = ?').run(
    is_completed ? 1 : 0,
    req.params.subtaskId,
    req.params.taskId
  );
  res.json({ message: 'Subtask updated.' });
});

// DELETE /api/tasks/:taskId/subtasks/:subtaskId
tasksRouter.delete('/:taskId/subtasks/:subtaskId', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM subtasks WHERE id = ? AND task_id = ?').run(req.params.subtaskId, req.params.taskId);
  res.json({ message: 'Subtask deleted.' });
});

// POST /api/tasks/:id/comments (Add comment)
tasksRouter.post('/:id/comments', requireAuth, (req: AuthRequest, res: Response): void => {
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'Comment content is required.' });
    return;
  }

  const id = 'cmt-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO task_comments (id, task_id, author_id, author_name, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, req.user!.id, req.user!.display_name, content, now);

  res.status(201).json({ id, message: 'Comment added.' });
});
