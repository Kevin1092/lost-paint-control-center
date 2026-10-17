import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Download,
  Shield,
  Save,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Users,
  HardDrive,
  Upload
} from 'lucide-react';
import { StudioSettings, User } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Notion test
  const [testingNotion, setTestingNotion] = useState(false);
  const [notionTestResult, setNotionTestResult] = useState<any | null>(null);

  const { isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const settingsRes = await api.getSettings();
      setSettings(settingsRes.settings);

      if (isAdmin) {
        const usersRes = await api.getUsers();
        setUsers(usersRes.users);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setSaving(true);
      await api.updateSettings(settings);
      success('Studio configuration saved.');
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      setSnapshotting(true);
      const res = await api.createSnapshot();
      success(`Snapshot created: ${res.filename}`);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to create snapshot.');
    } finally {
      setSnapshotting(false);
    }
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Restore live SQLite database from "${file.name}"? This will replace active records with the backup.`)) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    try {
      const res = await api.restoreDbBackup(file);
      success(res.message || 'Database restored successfully!');
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to restore database.');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleTestNotion = async () => {
    if (!settings?.notion_token) {
      error('Please enter a Notion API token first.');
      return;
    }

    try {
      setTestingNotion(true);
      setNotionTestResult(null);
      const res = await api.testNotionToken(settings.notion_token);
      setNotionTestResult(res);
      success(res.message);
    } catch (err: any) {
      setNotionTestResult({ success: false, message: err.message });
      error(err.message || 'Notion connection test failed.');
    } finally {
      setTestingNotion(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      success('User role updated.');
      loadData();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleToggleStatus = async (userId: string, currentActive: number) => {
    try {
      await api.toggleUserStatus(userId, currentActive === 0);
      success(`Account ${currentActive === 0 ? 'activated' : 'deactivated'}.`);
      loadData();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading studio configuration..." />;

  if (!settings) {
    return (
      <div className="p-8 text-center rounded-2xl bg-studio-900 border border-studio-800 space-y-4 max-w-lg mx-auto mt-12">
        <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
          <Settings className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-100">Authentication Required</h3>
        <p className="text-xs text-slate-400">
          Studio settings and database configuration are accessible to authenticated studio members. Please sign in to view and update configurations.
        </p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Studio Profile Configuration */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-5 text-xs">
        <div className="flex items-center justify-between border-b border-studio-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-rose-500" />
              Studio & Project Configuration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Core identity and environment targets for Lost Paint Studios
            </p>
          </div>

          {isAdmin && (
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Studio Name</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={settings.studio_name}
              onChange={e => setSettings({ ...settings, studio_name: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Game Title (TBD Placeholder)</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={settings.game_title}
              onChange={e => setSettings({ ...settings, game_title: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Engine</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={settings.engine}
              onChange={e => setSettings({ ...settings, engine: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Target Platforms</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={settings.platform_targets}
              onChange={e => setSettings({ ...settings, platform_targets: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        </div>

        {/* Notion API Settings */}
        <div className="pt-4 border-t border-studio-800 space-y-3">
          <h4 className="font-bold text-slate-200 uppercase font-mono text-[11px]">
            Notion Official API Integration Credentials
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Notion Integration Token</label>
              <input
                type="password"
                disabled={!isAdmin}
                placeholder="secret_..."
                value={settings.notion_token || ''}
                onChange={e => setSettings({ ...settings, notion_token: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Notion Page Identifier</label>
              <input
                type="text"
                disabled={!isAdmin}
                placeholder="3e140812c09680fdbffbf5256cfc82ee"
                value={settings.notion_page_id || ''}
                onChange={e => setSettings({ ...settings, notion_page_id: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestNotion}
                disabled={testingNotion}
                className="px-3.5 py-1.5 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-200 rounded-xl text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingNotion ? 'animate-spin' : ''}`} />
                <span>Test Notion API Connection</span>
              </button>

              {notionTestResult && (
                <span className={`text-xs ${notionTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {notionTestResult.message}
                </span>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Database Backup & Recovery Card */}
      <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-studio-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-500" />
              Database Backups & Disaster Recovery
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              SQLite WAL database with zero-downtime checkpoints
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-mono">
              Last Backup: <strong className="text-slate-200">{settings.last_backup_at ? settings.last_backup_at.slice(0, 16).replace('T', ' ') : 'None'}</strong>
            </span>
          </div>
        </div>

        <p className="text-slate-300 leading-relaxed">
          The database is a persistent SQLite store located on disk. Backups force a WAL checkpoint to truncate pending transactions and copy the exact transactional state.
        </p>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={api.getBackupDownloadUrl()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download Live SQLite DB (.db)</span>
            </a>

            <button
              onClick={handleCreateSnapshot}
              disabled={snapshotting}
              className="px-4 py-2 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-200 font-medium rounded-xl flex items-center gap-2"
            >
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>{snapshotting ? 'Creating Snapshot...' : 'Create Local Disk Snapshot'}</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreDatabase}
              accept=".db,application/x-sqlite3"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="px-4 py-2 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-200 font-medium rounded-xl flex items-center gap-2 transition-transform active:scale-95"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>{restoring ? 'Restoring Database...' : 'Restore from Backup (.db)'}</span>
            </button>
          </div>
        ) : (
          <p className="text-slate-400 italic">Database backup downloads are restricted to Owner/Admin and Editor roles.</p>
        )}

        {/* Restore Instructions */}
        <div className="p-4 rounded-xl bg-studio-950/70 border border-studio-800 space-y-2 mt-2">
          <span className="font-bold uppercase font-mono text-[10px] text-slate-400 block">
            How to Restore from a Backup
          </span>
          <ol className="list-decimal list-inside text-slate-300 space-y-1 font-mono text-[11px]">
            <li>Stop the backend server process.</li>
            <li>Replace <code className="text-rose-400">data/lost_paint.db</code> with your backup file.</li>
            <li>Delete any adjacent <code className="text-slate-400">lost_paint.db-wal</code> or <code className="text-slate-400">lost_paint.db-shm</code> files.</li>
            <li>Start the backend server (<code className="text-emerald-400">npm run dev</code>).</li>
          </ol>
        </div>
      </div>

      {/* User & Role Administration (Admin Only) */}
      {isAdmin && (
        <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-studio-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-500" />
                User & Role Administration
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage registered studio accounts, permissions, and status
              </p>
            </div>
            <span className="font-mono text-slate-400 text-xs">{users.length} registered accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-studio-850 border-b border-studio-800 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Linked Member</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-800/80">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-studio-850/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-100">{u.display_name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={u.role}
                        onChange={e => handleUpdateRole(u.id, e.target.value)}
                        className="bg-studio-850 border border-studio-750 rounded px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="admin">Owner/Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {u.member_name || 'None'}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                          u.is_active === 1
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {u.is_active === 1 ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
