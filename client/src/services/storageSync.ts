// Client-side fail-safe database synchronization
// Protects studio data on free-tier cloud containers (e.g. Render spin-downs) by maintaining
// a secure browser-side IndexedDB snapshot and automatically restoring it if the backend restarts from template.

import { api, onApiMutation } from '../api/client';

const DB_NAME = 'lost_paint_storage';
const STORE_NAME = 'backups';
const KEY = 'latest_db_backup';
const TS_KEY = 'lost_paint_db_backup_ts';
const TASK_COUNT_KEY = 'lost_paint_db_task_count';
const DATA_VER_KEY = 'lost_paint_db_data_version';

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
    const req = window.indexedDB.open(DB_NAME, 2);
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

interface BackupRecord {
  blob: Blob;
  timestamp: string;
  taskCount: number;
  dataVersion: number;
}

export const storageSync = {
  // Save active database blob into IndexedDB
  async saveLocalBackup(): Promise<void> {
    try {
      const token = localStorage.getItem('lost_paint_token');
      if (!token) return;

      // Check server status first to avoid overwriting a richer local backup with an empty server template
      const status = await api.getStorageStatus().catch(() => null);
      const localTaskCount = Number(localStorage.getItem(TASK_COUNT_KEY) || '0');
      const localDataVer = Number(localStorage.getItem(DATA_VER_KEY) || '1');

      if (status && status.taskCount < localTaskCount && status.isTemplate) {
        console.warn('[Storage Sync] Server has fewer tasks than local snapshot and is on template. Triggering restore instead of saving.');
        this.checkAndAutoRestore();
        return;
      }

      const res = await fetch('/api/backup/download', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) return;

      const blob = await res.blob();
      if (blob.size < 1000) return;

      const idb = await getIndexedDb();
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const now = new Date().toISOString();
      const taskCount = status?.taskCount ?? localTaskCount;
      const dataVersion = status?.dataVersion ?? localDataVer;

      const record: BackupRecord = {
        blob,
        timestamp: now,
        taskCount,
        dataVersion
      };

      store.put(record, KEY);

      localStorage.setItem(TS_KEY, now);
      localStorage.setItem(TASK_COUNT_KEY, String(taskCount));
      localStorage.setItem(DATA_VER_KEY, String(dataVersion));

      console.log(`[Storage Sync] Saved local backup snapshot (${blob.size} bytes, ${taskCount} tasks, version ${dataVersion} at ${now}).`);
    } catch (err: any) {
      console.warn('[Storage Sync] Could not save local backup:', err.message);
    }
  },

  // Schedule a debounced backup after modifications (800ms)
  scheduleBackup(delayMs = 800): void {
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
      if (!status) return false;

      const idb = await getIndexedDb();
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const record = await new Promise<BackupRecord | null>((resolve) => {
        const req = store.get(KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (!record || !record.blob || record.blob.size < 1000) {
        // No local backup yet; capture current state as initial baseline
        this.scheduleBackup(500);
        return false;
      }

      const localTaskCount = record.taskCount || Number(localStorage.getItem(TASK_COUNT_KEY) || '0');
      const localDataVer = record.dataVersion || Number(localStorage.getItem(DATA_VER_KEY) || '1');
      const serverTaskCount = status.taskCount || 0;
      const serverDataVer = status.dataVersion || 1;

      // Determine if local backup has more tasks or newer version than current server state
      const hasMoreTasks = localTaskCount > serverTaskCount;
      const isServerTemplate = Boolean(status.isTemplate) && (localTaskCount > 6 || localDataVer > 1);
      const isNewerVersion = localDataVer > serverDataVer;

      const localTime = new Date(record.timestamp || localStorage.getItem(TS_KEY) || 0).getTime();
      const serverTime = status.updatedAt ? new Date(status.updatedAt).getTime() : 0;
      const isNoticeablyNewerTime = (localTime - serverTime > 5000) && (localTaskCount >= serverTaskCount);

      if (hasMoreTasks || isServerTemplate || isNewerVersion || isNoticeablyNewerTime) {
        console.warn(`[Storage Sync] Server data is outdated (server tasks: ${serverTaskCount}, local tasks: ${localTaskCount}, serverVer: ${serverDataVer}, localVer: ${localDataVer}). Restoring...`);
        isRestoring = true;

        const res = await api.restoreDbBackup(record.blob);
        console.log('[Storage Sync] Auto-restore completed successfully:', res.message);
        isRestoring = false;

        // Dispatch global event so all active views (Tasks, Chapters, Dashboard) refresh their data immediately
        window.dispatchEvent(new CustomEvent('studio-storage-restored'));
        return true;
      } else {
        // Server has equal or newer data; capture state
        this.scheduleBackup(1500);
      }
    } catch (err: any) {
      console.warn('[Storage Sync] Auto-restore check failed:', err.message);
      isRestoring = false;
    }
    return false;
  }
};

// Auto-schedule backup immediately whenever any API mutation succeeds
onApiMutation(() => {
  storageSync.scheduleBackup(800);
});

// Save immediately before page unloads to guarantee nothing is lost on page reload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    storageSync.saveLocalBackup().catch(() => {});
  });
}
