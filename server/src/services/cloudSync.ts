import fs from 'fs';
import path from 'path';

class CloudSyncService {
  private syncTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private dbPathGetter: (() => string) | null = null;

  setDbPathGetter(getter: () => string) {
    this.dbPathGetter = getter;
  }

  private getPath(): string {
    if (this.dbPathGetter) return this.dbPathGetter();
    return process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/lost_paint.db');
  }

  // Restore database from remote cloud storage if configured
  async restoreIfAvailable(): Promise<boolean> {
    const dbPath = this.getPath();

    // Check Upstash Redis REST
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (upstashUrl && upstashToken) {
      try {
        console.log('[CloudSync] Checking Upstash Redis for remote database backup...');
        const res = await fetch(`${upstashUrl}/get/lost_paint_db_backup`, {
          headers: { Authorization: `Bearer ${upstashToken}` }
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.result) {
            const buf = Buffer.from(data.result, 'base64');
            if (buf.length > 1000) {
              const dir = path.dirname(dbPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(dbPath, buf);
              console.log(`[CloudSync] Successfully restored database from Upstash cloud backup (${buf.length} bytes).`);
              return true;
            }
          }
        }
      } catch (err: any) {
        console.warn('[CloudSync] Failed to check/restore from Upstash:', err.message);
      }
    }

    // Check generic DATABASE_SYNC_URL (GET)
    const syncUrl = process.env.DATABASE_SYNC_URL;
    if (syncUrl) {
      try {
        console.log('[CloudSync] Checking remote DATABASE_SYNC_URL for backup...');
        const res = await fetch(syncUrl, {
          headers: process.env.DATABASE_SYNC_TOKEN ? { Authorization: `Bearer ${process.env.DATABASE_SYNC_TOKEN}` } : {}
        });
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuffer);
          if (buf.length > 1000) {
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dbPath, buf);
            console.log(`[CloudSync] Successfully restored database from remote sync URL (${buf.length} bytes).`);
            return true;
          }
        }
      } catch (err: any) {
        console.warn('[CloudSync] Failed to restore from DATABASE_SYNC_URL:', err.message);
      }
    }

    return false;
  }

  // Backup active database to remote cloud storage
  async backupNow(): Promise<boolean> {
    if (this.isSyncing) return false;
    const dbPath = this.getPath();
    if (!fs.existsSync(dbPath)) return false;

    this.isSyncing = true;
    try {
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (upstashUrl && upstashToken) {
        const fileBuf = fs.readFileSync(dbPath);
        const base64 = fileBuf.toString('base64');
        const res = await fetch(`${upstashUrl}/set/lost_paint_db_backup`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${upstashToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(base64)
        });
        if (res.ok) {
          console.log(`[CloudSync] Database successfully backed up to Upstash (${fileBuf.length} bytes).`);
          return true;
        }
      }

      const syncUrl = process.env.DATABASE_SYNC_URL;
      if (syncUrl) {
        const fileBuf = fs.readFileSync(dbPath);
        const res = await fetch(syncUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            ...(process.env.DATABASE_SYNC_TOKEN ? { Authorization: `Bearer ${process.env.DATABASE_SYNC_TOKEN}` } : {})
          },
          body: fileBuf
        });
        if (res.ok) {
          console.log(`[CloudSync] Database successfully uploaded to remote sync URL.`);
          return true;
        }
      }
    } catch (err: any) {
      console.warn('[CloudSync] Failed to backup database:', err.message);
    } finally {
      this.isSyncing = false;
    }
    return false;
  }

  // Schedule debounced backup (called after DB modifications)
  scheduleBackup(delayMs = 5000): void {
    if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.DATABASE_SYNC_URL) {
      return;
    }
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.backupNow().catch(() => {});
    }, delayMs);
  }
}

export const cloudSync = new CloudSyncService();
