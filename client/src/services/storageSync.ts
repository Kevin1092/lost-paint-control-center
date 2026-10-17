// Client-side fail-safe database synchronization
// Protects studio data on free-tier cloud containers (e.g. Render spin-downs) by maintaining
// a secure browser-side IndexedDB snapshot and automatically restoring it if the backend restarts from template.

import { api, onApiMutation } from '../api/client';

const DB_NAME = 'lost_paint_storage';
const STORE_NAME = 'backups';
const KEY = 'latest_db_backup';
const TS_KEY = 'lost_paint_db_backup_ts';

let dbPromise: Promise<IDBDatabase> | null = null;
let debounceTimer: any = null;
let isRestoring = false;

function getIndexedDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export const storageSync = {
  // Save active database blob into IndexedDB
  async saveLocalBackup(): Promise<void> {
    try {
      const token = localStorage.getItem('lost_paint_token');
      if (!token) return;

      const res = await fetch('/api/backup/download', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;

      const blob = await res.blob();
      if (blob.size < 1000) return;

      const idb = await getIndexedDb();
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const now = new Date().toISOString();
      store.put({ blob, timestamp: now }, KEY);

      localStorage.setItem(TS_KEY, now);
      console.log(`[Storage Sync] Saved local backup snapshot (${blob.size} bytes at ${now}).`);
    } catch (err: any) {
      console.warn('[Storage Sync] Could not save local backup:', err.message);
    }
  },

  // Schedule a debounced backup after modifications
  scheduleBackup(delayMs = 3500): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      this.saveLocalBackup().catch(() => {});
    }, delayMs);
  },

  // Check if backend restarted with an older/template DB and auto-restore if needed
  async checkAndAutoRestore(): Promise<boolean> {
    if (isRestoring) return false;
    try {
      const token = localStorage.getItem('lost_paint_token');
      if (!token) return false;

      const status = await api.getStorageStatus().catch(() => null);
      if (!status || !status.updatedAt) return false;

      const localTs = localStorage.getItem(TS_KEY);
      if (!localTs) {
        // No local backup yet; capture current state as initial baseline
        this.scheduleBackup(2000);
        return false;
      }

      const serverTime = new Date(status.updatedAt).getTime();
      const localTime = new Date(localTs).getTime();

      // If local backup is noticeably newer than what the server started with (difference > 15 seconds)
      if (localTime - serverTime > 15000) {
        console.warn(`[Storage Sync] Server data (${status.updatedAt}) is older than browser local backup (${localTs}). Restoring...`);
        isRestoring = true;

        const idb = await getIndexedDb();
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const record = await new Promise<{ blob: Blob; timestamp: string } | null>((resolve) => {
          const req = store.get(KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (record && record.blob && record.blob.size > 1000) {
          const res = await api.restoreDbBackup(record.blob);
          console.log('[Storage Sync] Auto-restore completed successfully:', res.message);
          isRestoring = false;
          return true;
        }
        isRestoring = false;
      } else {
        // Server is up to date; take periodic local backup
        this.scheduleBackup(5000);
      }
    } catch (err: any) {
      console.warn('[Storage Sync] Auto-restore check failed:', err.message);
      isRestoring = false;
    }
    return false;
  }
};

// Auto-schedule backup whenever any API mutation succeeds
onApiMutation(() => {
  storageSync.scheduleBackup();
});

