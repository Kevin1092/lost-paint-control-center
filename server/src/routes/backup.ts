import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { db, getDatabasePath } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import { cloudSync } from '../services/cloudSync';

export const backupRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// GET /api/backup/status (Check current storage backend)
backupRouter.get('/status', requireAuth, (req: AuthRequest, res: Response): void => {
  const dbPath = getDatabasePath();
  const isRenderDisk = dbPath.startsWith('/data') || dbPath.startsWith('/var/data');
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasSyncUrl = Boolean(process.env.DATABASE_SYNC_URL);

  res.json({
    databasePath: dbPath,
    storageType: isRenderDisk ? 'persistent_disk' : hasUpstash ? 'upstash_cloud_sync' : hasSyncUrl ? 'remote_sync_url' : 'ephemeral_local',
    isPersistent: isRenderDisk || hasUpstash || hasSyncUrl,
    cloudSyncConfigured: hasUpstash || hasSyncUrl
  });
});

// GET /api/backup/download (Admin: download active SQLite database file)
backupRouter.get('/download', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const dbPath = getDatabasePath();

    if (!fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'Database file not found on disk.' });
      return;
    }

    // Force SQLite checkpoint if WAL was used
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}

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
backupRouter.post('/snapshot', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dbPath = getDatabasePath();
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}

    const snapshotDir = path.resolve(path.dirname(dbPath), 'backups');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = path.join(snapshotDir, `lost_paint_${timestamp}.db`);
    fs.copyFileSync(dbPath, snapshotFile);

    // Also trigger cloud sync snapshot
    await cloudSync.backupNow().catch(() => {});

    const now = new Date().toISOString();
    db.prepare("UPDATE settings SET last_backup_at = ?, updated_at = ? WHERE id = 'studio'").run(now, now);

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'SNAPSHOT',
      entityType: 'DATABASE',
      details: `Created snapshot: ${path.basename(snapshotFile)}`,
      isSecurityEvent: 1
    });

    res.json({
      message: 'Snapshot created and synced successfully.',
      filename: path.basename(snapshotFile),
      timestamp: now
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create snapshot: ' + err.message });
  }
});

// POST /api/backup/restore (Admin: upload and restore a .db backup file live)
backupRouter.post('/restore', requireAuth, requireRole('admin'), upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No database file provided.' });
      return;
    }

    // Verify SQLite magic header
    const magic = req.file.buffer.slice(0, 16).toString('utf-8');
    if (!magic.startsWith('SQLite format 3')) {
      res.status(400).json({ error: 'Invalid database file: header does not match SQLite format.' });
      return;
    }

    const dbPath = getDatabasePath();

    // Create safety copy before overwriting
    if (fs.existsSync(dbPath)) {
      const snapshotDir = path.resolve(path.dirname(dbPath), 'backups');
      if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
      fs.copyFileSync(dbPath, path.join(snapshotDir, `pre_restore_${Date.now()}.db`));
    }

    // Write new database
    fs.writeFileSync(dbPath, req.file.buffer);

    // Sync to cloud storage if enabled
    await cloudSync.backupNow().catch(() => {});

    const now = new Date().toISOString();
    db.prepare("UPDATE settings SET last_backup_at = ?, updated_at = ? WHERE id = 'studio'").run(now, now);

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'RESTORE',
      entityType: 'DATABASE',
      details: `Restored live SQLite database from uploaded file (${req.file.size} bytes)`,
      isSecurityEvent: 1
    });

    res.json({
      success: true,
      message: 'Database restored successfully! All records updated live.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
});
