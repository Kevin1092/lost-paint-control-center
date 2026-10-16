import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const backupRouter = Router();

// GET /api/backup/download (Admin: download active SQLite database file)
backupRouter.get('/download', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/lost_paint.db');

    if (!fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'Database file not found on disk.' });
      return;
    }

    // Force SQLite checkpoint so all WAL changes are written to the main DB file
    db.pragma('wal_checkpoint(TRUNCATE)');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lost_paint_backup_${timestamp}.db`;

    // Record last backup time in settings
    const now = new Date().toISOString();
    db.prepare("UPDATE settings SET last_backup_at = ?, updated_at = ? WHERE id = 'studio'").run(now, now);

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'BACKUP',
      entityType: 'DATABASE',
      details: `Generated and downloaded SQLite database backup ${filename}`,
      isSecurityEvent: 1
    });

    res.download(dbPath, filename);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// POST /api/backup/snapshot (Admin: create local snapshot on disk)
backupRouter.post('/snapshot', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/lost_paint.db');
    db.pragma('wal_checkpoint(TRUNCATE)');

    const snapshotDir = path.resolve(__dirname, '../../data/backups');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = path.join(snapshotDir, `lost_paint_${timestamp}.db`);
    fs.copyFileSync(dbPath, snapshotFile);

    const now = new Date().toISOString();
    db.prepare("UPDATE settings SET last_backup_at = ?, updated_at = ? WHERE id = 'studio'").run(now, now);

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'SNAPSHOT',
      entityType: 'DATABASE',
      details: `Created disk snapshot: ${path.basename(snapshotFile)}`,
      isSecurityEvent: 1
    });

    res.json({
      message: 'Snapshot created successfully on persistent storage.',
      filename: path.basename(snapshotFile),
      timestamp: now
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create snapshot: ' + err.message });
  }
});
