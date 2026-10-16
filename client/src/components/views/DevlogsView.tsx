import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  User,
  Plus,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Search,
  Trash2,
  Edit2
} from 'lucide-react';
import { DevelopmentLog, Chapter, Task } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const DevlogsView: React.FC = () => {
  const [logs, setLogs] = useState<DevelopmentLog[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [activeLog, setActiveLog] = useState<Partial<DevelopmentLog> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadDevlogs();
  }, [search, chapterFilter]);

  const loadDevlogs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (chapterFilter) params.chapter_id = chapterFilter;

      const [logsRes, chRes, tasksRes] = await Promise.all([
        api.getDevlogs(params),
        api.getChapters(),
        api.getTasks()
      ]);
      setLogs(logsRes.logs);
      setChapters(chRes.chapters);
      setTasks(tasksRes.tasks);
    } catch (err) {
      console.error('Failed to load devlogs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setActiveLog({
      log_date: today,
      done: '',
      in_progress: '',
      blocked: '',
      next_steps: '',
      notes: '',
      linked_chapter_id: chapters[0]?.id || null
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (log: DevelopmentLog) => {
    setActiveLog({ ...log });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLog?.log_date) {
      error('Log date is required.');
      return;
    }

    try {
      if (isEditing && activeLog.id) {
        await api.updateDevlog(activeLog.id, activeLog);
        success('Development log updated.');
      } else {
        await api.createDevlog(activeLog);
        success('Daily development log recorded.');
      }
      setModalOpen(false);
      loadDevlogs();
    } catch (err: any) {
      error(err.message || 'Failed to save dev log.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this development log?')) return;
    try {
      await api.deleteDevlog(id);
      success('Log entry deleted.');
      loadDevlogs();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading daily development logs..." />;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs by keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={chapterFilter}
            onChange={e => setChapterFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Chapters</option>
            {chapters.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.day_range} — {ch.name}</option>
            ))}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Log Daily Update</span>
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No dev logs recorded"
          description="Log daily progress with sections: Done, In Progress, Blocked, and Next Steps."
          actionText={canEdit ? "Create Today's Log" : undefined}
          onAction={canEdit ? handleOpenCreate : undefined}
        />
      ) : (
        <div className="space-y-4">
          {logs.map(log => (
            <div
              key={log.id}
              className="studio-card p-6 space-y-4 hover:border-studio-700 transition-all"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-studio-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/40 border border-rose-900/60 px-2.5 py-1 rounded-lg">
                    {log.log_date}
                  </span>
                  <div>
                    <span className="text-sm font-bold text-slate-100">
                      Update by {log.author_name}
                    </span>
                    {log.chapter_name && (
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Focus: {log.chapter_name}
                      </span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(log)}
                      className="p-1.5 bg-studio-850 hover:bg-studio-800 text-slate-300 rounded-lg text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-950 text-rose-400 rounded-lg text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Daily Update Template 4-Section Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Done */}
                <div className="p-3.5 rounded-xl bg-studio-850/50 border border-emerald-950/60 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed Deliverables
                  </span>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {log.done || 'None recorded.'}
                  </p>
                </div>

                {/* In Progress */}
                <div className="p-3.5 rounded-xl bg-studio-850/50 border border-sky-950/60 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-sky-400 font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    In Progress Today
                  </span>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {log.in_progress || 'None recorded.'}
                  </p>
                </div>

                {/* Blocked */}
                <div className="p-3.5 rounded-xl bg-studio-850/50 border border-rose-950/60 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Blockers & Obstacles
                  </span>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {log.blocked || 'No active blockers.'}
                  </p>
                </div>

                {/* Next Steps */}
                <div className="p-3.5 rounded-xl bg-studio-850/50 border border-studio-800 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    Next Steps Tomorrow
                  </span>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {log.next_steps || 'None recorded.'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {log.notes && (
                <div className="p-3 rounded-xl bg-studio-900/60 border border-studio-800 text-xs">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    Additional Studio Notes
                  </span>
                  <p className="text-slate-300 leading-relaxed">{log.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT DEVLOG MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Development Log' : 'Log Daily Studio Update'}
        subtitle="Standardized Daily Standup Template: Done, In Progress, Blocked, Next Steps"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveLog} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Log Date *</label>
              <input
                type="date"
                required
                value={activeLog?.log_date || ''}
                onChange={e => setActiveLog({ ...activeLog, log_date: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Related Chapter</label>
              <select
                value={activeLog?.linked_chapter_id || ''}
                onChange={e => setActiveLog({ ...activeLog, linked_chapter_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">None</option>
                {chapters.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.day_range} — {ch.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-emerald-400 mb-1 font-semibold">Done / Completed Work</label>
            <textarea
              rows={2}
              value={activeLog?.done || ''}
              onChange={e => setActiveLog({ ...activeLog, done: e.target.value })}
              placeholder="What deliverables did you complete today?"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-sky-400 mb-1 font-semibold">In Progress</label>
            <textarea
              rows={2}
              value={activeLog?.in_progress || ''}
              onChange={e => setActiveLog({ ...activeLog, in_progress: e.target.value })}
              placeholder="What are you currently implementing?"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-rose-400 mb-1 font-semibold">Blocked / Issues</label>
            <textarea
              rows={2}
              value={activeLog?.blocked || ''}
              onChange={e => setActiveLog({ ...activeLog, blocked: e.target.value })}
              placeholder="Are there any bugs, asset dependencies, or technical blockers?"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Next Steps</label>
            <textarea
              rows={2}
              value={activeLog?.next_steps || ''}
              onChange={e => setActiveLog({ ...activeLog, next_steps: e.target.value })}
              placeholder="What is planned for tomorrow?"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Notes / Links</label>
            <textarea
              rows={2}
              value={activeLog?.notes || ''}
              onChange={e => setActiveLog({ ...activeLog, notes: e.target.value })}
              placeholder="Any other notes, build hashes, or reference links..."
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-studio-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-studio-800 text-slate-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
            >
              Save Log
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
