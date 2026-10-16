import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const settingsRouter = Router();

const SettingsSchema = z.object({
  studio_name: z.string().min(2),
  game_title: z.string().min(2),
  game_status: z.string(),
  engine: z.string(),
  platform_targets: z.string(),
  default_timezone: z.string(),
  notion_token: z.string().nullable().optional(),
  notion_page_id: z.string().nullable().optional()
});

// GET /api/settings
settingsRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('studio') as any;
  res.json({ settings });
});

// PUT /api/settings
settingsRouter.put('/', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const data = SettingsSchema.parse(req.body);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE settings SET
        studio_name = ?, game_title = ?, game_status = ?, engine = ?,
        platform_targets = ?, default_timezone = ?, notion_token = ?,
        notion_page_id = ?, updated_at = ?
      WHERE id = 'studio'
    `).run(
      data.studio_name,
      data.game_title,
      data.game_status,
      data.engine,
      data.platform_targets,
      data.default_timezone,
      data.notion_token || null,
      data.notion_page_id || null,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'UPDATE_SETTINGS',
      entityType: 'SETTINGS',
      details: `Updated studio configuration. Game title: "${data.game_title}"`
    });

    res.json({ message: 'Settings updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});
