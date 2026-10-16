import { Router, Response } from 'express';
import { db } from '../db/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Task Stats
  const taskCounts = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
      SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) as blocked_tasks,
      SUM(CASE WHEN status NOT IN ('Done', 'Cancelled') AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) as overdue_tasks,
      SUM(CASE WHEN status NOT IN ('Done', 'Cancelled') AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ? THEN 1 ELSE 0 END) as due_soon_tasks
    FROM tasks
  `).get(today, today, nextWeek) as any;

  // Chapter Roadmap Progress (calculated strictly from linked tasks)
  const chapters = db.prepare(`
    SELECT
      c.id, c.order_index, c.name, c.day_range, c.status,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) as completed_tasks
    FROM chapters c
    LEFT JOIN tasks t ON c.id = t.chapter_id
    GROUP BY c.id
    ORDER BY c.order_index ASC
  `).all() as any[];

  const chapterProgress = chapters.map(c => ({
    ...c,
    progress_percent: c.total_tasks > 0 ? Math.round((c.completed_tasks / c.total_tasks) * 100) : 0
  }));

  // Team Workload
  const teamWorkload = db.prepare(`
    SELECT
      tm.id, tm.name, tm.country_code, tm.roles,
      COUNT(ta.task_id) as total_assigned,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN t.status NOT IN ('Done', 'Cancelled') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN t.status = 'Blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN t.status NOT IN ('Done', 'Cancelled') AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) as overdue
    FROM team_members tm
    LEFT JOIN task_assignees ta ON tm.id = ta.team_member_id
    LEFT JOIN tasks t ON ta.task_id = t.id
    WHERE tm.status = 'active'
    GROUP BY tm.id
    ORDER BY total_assigned DESC
  `).all(today);

  // Bug stats by severity
  const bugStats = db.prepare(`
    SELECT
      COUNT(*) as total_bugs,
      SUM(CASE WHEN status NOT IN ('Closed', 'Won’t Fix') THEN 1 ELSE 0 END) as open_bugs,
      SUM(CASE WHEN severity = 'Critical' AND status NOT IN ('Closed', 'Won’t Fix') THEN 1 ELSE 0 END) as critical_bugs,
      SUM(CASE WHEN severity = 'High' AND status NOT IN ('Closed', 'Won’t Fix') THEN 1 ELSE 0 END) as high_bugs,
      SUM(CASE WHEN severity = 'Medium' AND status NOT IN ('Closed', 'Won’t Fix') THEN 1 ELSE 0 END) as medium_bugs,
      SUM(CASE WHEN severity = 'Low' AND status NOT IN ('Closed', 'Won’t Fix') THEN 1 ELSE 0 END) as low_bugs
    FROM bugs
  `).get() as any;

  // Recent Activity / Audit
  const recentActivity = db.prepare(`
    SELECT id, user_name, action, entity_type, entity_id, details, is_security_event, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  // Recent Dev Logs
  const recentDevLogs = db.prepare(`
    SELECT id, log_date, author_name, done, in_progress, blocked, next_steps, created_at
    FROM development_logs
    ORDER BY log_date DESC, created_at DESC
    LIMIT 5
  `).all();

  // Upcoming Deadlines & Calendar Events
  const upcomingEvents = db.prepare(`
    SELECT id, title, event_type, start_time, end_time, status
    FROM calendar_events
    WHERE start_time >= ?
    ORDER BY start_time ASC
    LIMIT 6
  `).all(today);

  // Marketing Stats
  const marketingStats = db.prepare(`
    SELECT
      COUNT(*) as total_items,
      SUM(CASE WHEN status = 'Published' THEN 1 ELSE 0 END) as published_items,
      SUM(CASE WHEN status IN ('Idea', 'Draft', 'Ready for Review') THEN 1 ELSE 0 END) as in_production,
      SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled_items
    FROM marketing_items
  `).get() as any;

  // Current Blockers (tasks or devlog blockers)
  const blockedTasks = db.prepare(`
    SELECT id, title, category, priority, updated_at
    FROM tasks
    WHERE status = 'Blocked'
    ORDER BY updated_at DESC
    LIMIT 5
  `).all();

  // Studio Settings
  const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('studio');

  res.json({
    taskCounts: {
      total: taskCounts.total_tasks || 0,
      completed: taskCounts.completed_tasks || 0,
      in_progress: taskCounts.in_progress_tasks || 0,
      blocked: taskCounts.blocked_tasks || 0,
      overdue: taskCounts.overdue_tasks || 0,
      due_soon: taskCounts.due_soon_tasks || 0,
    },
    chapterProgress,
    teamWorkload,
    bugStats: {
      total: bugStats.total_bugs || 0,
      open: bugStats.open_bugs || 0,
      critical: bugStats.critical_bugs || 0,
      high: bugStats.high_bugs || 0,
      medium: bugStats.medium_bugs || 0,
      low: bugStats.low_bugs || 0,
    },
    recentActivity,
    recentDevLogs,
    upcomingEvents,
    marketingStats,
    blockedTasks,
    settings
  });
});
