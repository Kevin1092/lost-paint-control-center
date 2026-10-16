import React, { useState, useEffect } from 'react';
import {
  Bug as BugIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Search,
  Trash2,
  Edit2,
  ExternalLink,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import { Bug, BugSeverity, BugStatus, TeamMember, Chapter } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const SEVERITIES: BugSeverity[] = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES: BugStatus[] = ['New', 'Confirmed', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Won’t Fix'];
const PLATFORMS = ['Steam / PC', 'Google Play / Android', 'Unity Editor'];

export const BugsView: React.FC = () => {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');

  // Modals
  const [activeBug, setActiveBug] = useState<Partial<Bug> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [newComment, setNewComment] = useState('');

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadBugs();
  }, [search, severityFilter, statusFilter, platformFilter]);

  const loadBugs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;
      if (platformFilter) params.platform = platformFilter;

      const [bugsRes, teamRes, chRes] = await Promise.all([
        api.getBugs(params),
        api.getTeam(),
        api.getChapters()
      ]);
      setBugs(bugsRes.bugs);
      setTeam(teamRes.team);
      setChapters(chRes.chapters);
    } catch (err) {
      console.error('Failed to load bugs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setActiveBug({
      title: '',
      description: '',
      reproduction_steps: '1. \n2. \n3. ',
      expected_result: '',
      actual_result: '',
      severity: 'Medium',
      status: 'New',
      platform: 'Steam / PC',
      unity_build_version: 'v0.1.0-pre',
      date_found: today,
      assignee_id: team[0]?.id || null,
      related_chapter_id: chapters[0]?.id || null,
      evidence_links: '',
      resolution_notes: ''
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (bug: Bug) => {
    setActiveBug({ ...bug });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBug?.title || !activeBug?.description) {
      error('Title and description are required.');
      return;
    }

    try {
      if (isEditing && activeBug.id) {
        await api.updateBug(activeBug.id, activeBug);
        success('Bug report updated.');
      } else {
        await api.createBug(activeBug);
        success('Bug logged into QA tracker.');
      }
      setModalOpen(false);
      loadBugs();
    } catch (err: any) {
      error(err.message || 'Failed to save bug.');
    }
  };

  const handleQuickStatus = async (bugId: string, newStatus: string) => {
    try {
      await api.updateBugStatus(bugId, newStatus);
      success(`Status changed to ${newStatus}`);
      loadBugs();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleOpenDetail = async (id: string) => {
    try {
      const res = await api.getBug(id);
      setSelectedBug(res.bug);
      setDetailModalOpen(true);
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBug || !newComment.trim()) return;
    try {
      await api.addBugComment(selectedBug.id, newComment.trim());
      setNewComment('');
      const res = await api.getBug(selectedBug.id);
      setSelectedBug(res.bug);
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete bug "${title}"?`)) return;
    try {
      await api.deleteBug(id);
      success('Bug deleted.');
      if (detailModalOpen) setDetailModalOpen(false);
      loadBugs();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading bug tracker & QA issues..." />;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search bugs by title or symptom..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Platforms</option>
            {PLATFORMS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Report Bug</span>
          </button>
        )}
      </div>

      {bugs.length === 0 ? (
        <EmptyState
          icon={BugIcon}
          title="No bugs reported"
          description="The bug tracker has no issues matching the current query. Clean build!"
          actionText={canEdit ? "Report an Issue" : undefined}
          onAction={canEdit ? handleOpenCreate : undefined}
        />
      ) : (
        <div className="studio-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-studio-850/80 border-b border-studio-800 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Date Found</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-800/80">
                {bugs.map(bug => (
                  <tr
                    key={bug.id}
                    onClick={() => handleOpenDetail(bug.id)}
                    className="hover:bg-studio-850/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          bug.severity === 'Critical'
                            ? 'rose'
                            : bug.severity === 'High'
                            ? 'amber'
                            : bug.severity === 'Medium'
                            ? 'sky'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {bug.severity}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-100 max-w-sm truncate">
                      {bug.title}
                      {bug.chapter_name && (
                        <span className="text-[10px] text-slate-400 block font-normal font-mono truncate">
                          📍 {bug.chapter_name}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={bug.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleQuickStatus(bug.id, e.target.value)}
                        className="bg-studio-850 border border-studio-750 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {bug.platform || 'Steam / PC'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {bug.assignee_name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {bug.date_found}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(bug)}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-studio-800 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(bug.id, bug.title)}
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BUG MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Bug Report' : 'Report Bug / Glitch'}
        subtitle="Provide precise reproduction steps and expected vs actual behavior"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveBug} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Bug Title *</label>
            <input
              type="text"
              required
              value={activeBug?.title || ''}
              onChange={e => setActiveBug({ ...activeBug, title: e.target.value })}
              placeholder="e.g. Flashlight beam clips through door mesh"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Severity</label>
              <select
                value={activeBug?.severity || 'Medium'}
                onChange={e => setActiveBug({ ...activeBug, severity: e.target.value as BugSeverity })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {SEVERITIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Status</label>
              <select
                value={activeBug?.status || 'New'}
                onChange={e => setActiveBug({ ...activeBug, status: e.target.value as BugStatus })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Target Platform</label>
              <select
                value={activeBug?.platform || 'Steam / PC'}
                onChange={e => setActiveBug({ ...activeBug, platform: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {PLATFORMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Assignee (Developer / QA)</label>
              <select
                value={activeBug?.assignee_id || ''}
                onChange={e => setActiveBug({ ...activeBug, assignee_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">Unassigned</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.roles})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Related Chapter</label>
              <select
                value={activeBug?.related_chapter_id || ''}
                onChange={e => setActiveBug({ ...activeBug, related_chapter_id: e.target.value || null })}
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
            <label className="block text-slate-400 mb-1 font-medium">Reproduction Steps *</label>
            <textarea
              rows={3}
              value={activeBug?.reproduction_steps || ''}
              onChange={e => setActiveBug({ ...activeBug, reproduction_steps: e.target.value })}
              placeholder="1. Launch scene...\n2. Walk to door...\n3. Press F..."
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Expected Result</label>
              <textarea
                rows={2}
                value={activeBug?.expected_result || ''}
                onChange={e => setActiveBug({ ...activeBug, expected_result: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Actual Result</label>
              <textarea
                rows={2}
                value={activeBug?.actual_result || ''}
                onChange={e => setActiveBug({ ...activeBug, actual_result: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
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
              Save Bug Report
            </button>
          </div>
        </form>
      </Modal>

      {/* BUG DETAIL MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedBug?.title || 'Bug Details'}
        subtitle={`Severity: ${selectedBug?.severity} • Status: ${selectedBug?.status}`}
        maxWidth="2xl"
      >
        {selectedBug && (
          <div className="space-y-5 text-xs">
            {/* Repro Steps */}
            <div>
              <h4 className="text-slate-400 font-semibold mb-1">Reproduction Steps</h4>
              <div className="p-3 bg-studio-850 rounded-xl border border-studio-800 font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedBug.reproduction_steps || 'No steps provided.'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-studio-850/60 rounded-xl border border-studio-800">
                <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold block mb-1">
                  Expected Result
                </span>
                <p className="text-slate-300">{selectedBug.expected_result || '—'}</p>
              </div>

              <div className="p-3 bg-studio-850/60 rounded-xl border border-studio-800">
                <span className="text-[10px] uppercase font-mono text-rose-400 font-bold block mb-1">
                  Actual Result
                </span>
                <p className="text-slate-300">{selectedBug.actual_result || '—'}</p>
              </div>
            </div>

            {/* Comments Thread */}
            <div className="space-y-3 pt-3 border-t border-studio-800">
              <h4 className="text-slate-400 font-semibold flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-rose-400" />
                QA Notes & Comments
              </h4>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedBug.comments && selectedBug.comments.length > 0 ? (
                  selectedBug.comments.map(c => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-studio-850 border border-studio-800">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-slate-200">{c.author_name}</span>
                        <span className="font-mono">{c.created_at ? c.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic">No comments on this bug report.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add comment or resolution note..."
                  className="flex-1 px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold"
                >
                  Comment
                </button>
              </form>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-studio-800">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
