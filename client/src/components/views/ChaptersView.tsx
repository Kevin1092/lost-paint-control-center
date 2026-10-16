import React, { useState, useEffect } from 'react';
import {
  Milestone,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  FileText,
  User,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Chapter, TeamMember } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const ChaptersView: React.FC = () => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Detail Modal
  const [activeChapter, setActiveChapter] = useState<Partial<Chapter> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadChapters();
  }, []);

  const loadChapters = async () => {
    try {
      setLoading(true);
      const [chRes, teamRes] = await Promise.all([
        api.getChapters(),
        api.getTeam()
      ]);
      setChapters(chRes.chapters);
      setTeam(teamRes.team);
    } catch (err) {
      console.error('Failed to load chapters', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (ch: Chapter) => {
    setActiveChapter({ ...ch });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleOpenCreate = () => {
    setActiveChapter({
      name: '',
      day_range: 'Days 101–120',
      summary: '',
      status: 'Planned',
      owner_id: team[0]?.id || null,
      risks: '',
      notes: '',
      acceptance_criteria: '',
      order_index: chapters.length + 1
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChapter?.name || !activeChapter?.day_range) {
      error('Name and Day Range are required.');
      return;
    }

    try {
      const payload = {
        name: activeChapter.name,
        day_range: activeChapter.day_range,
        summary: activeChapter.summary || '',
        status: activeChapter.status || 'Planned',
        owner_id: activeChapter.owner_id || null,
        target_start_date: activeChapter.target_start_date || null,
        target_end_date: activeChapter.target_end_date || null,
        risks: activeChapter.risks || '',
        notes: activeChapter.notes || '',
        acceptance_criteria: activeChapter.acceptance_criteria || '',
        order_index: activeChapter.order_index
      };

      if (isEditing && activeChapter.id) {
        await api.updateChapter(activeChapter.id, payload);
        success('Roadmap block updated.');
      } else {
        await api.createChapter(payload);
        success('New roadmap block added.');
      }

      setModalOpen(false);
      loadChapters();
    } catch (err: any) {
      error(err.message || 'Failed to save chapter.');
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChapter?.id || !newMilestoneTitle.trim()) return;

    try {
      await api.addMilestone(activeChapter.id, {
        title: newMilestoneTitle.trim(),
        status: 'Pending'
      });
      setNewMilestoneTitle('');
      const updated = await api.getChapter(activeChapter.id);
      setActiveChapter(updated.chapter);
      loadChapters();
      success('Milestone added.');
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, currentStatus: string) => {
    if (!activeChapter?.id) return;
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    try {
      await api.updateMilestone(milestoneId, { status: nextStatus });
      const updated = await api.getChapter(activeChapter.id);
      setActiveChapter(updated.chapter);
      loadChapters();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading Chapter Roadmap & Milestones..." />;

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-5 rounded-2xl bg-studio-900 border border-studio-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Production Roadmap</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Vertical Slice Plan (Days 1–100)</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            Story Progression & Technical Integration Blocks
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Progress is derived automatically from linked production tasks. Day ranges represent relative development sprints; start dates can be configured as sprints officially commence.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Roadmap Block</span>
          </button>
        )}
      </div>

      {/* Chapters Cards List */}
      <div className="space-y-4">
        {chapters.map((ch, index) => {
          const percent = ch.progress_percent || 0;
          return (
            <div
              key={ch.id}
              className="studio-card p-6 space-y-4 hover:border-studio-700 transition-all"
            >
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/40 border border-rose-900/60 px-2.5 py-1 rounded-lg">
                      {ch.day_range}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      {ch.name}
                      <Badge
                        variant={
                          ch.status === 'Completed'
                            ? 'emerald'
                            : ch.status === 'In Progress'
                            ? 'sky'
                            : ch.status === 'Blocked'
                            ? 'rose'
                            : 'default'
                        }
                        size="sm"
                      >
                        {ch.status}
                      </Badge>
                    </h4>
                    {ch.owner_name && (
                      <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        Lead: <strong className="text-slate-300">{ch.owner_name}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-slate-100">
                      {percent}%
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {ch.completed_tasks || 0}/{ch.total_tasks || 0} tasks done
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => handleOpenEdit(ch)}
                      className="p-2 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-300 rounded-xl"
                      title="Edit Chapter & Milestones"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-studio-950 rounded-full overflow-hidden border border-studio-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    percent === 100
                      ? 'bg-emerald-500'
                      : percent > 50
                      ? 'bg-rose-500'
                      : percent > 0
                      ? 'bg-sky-500'
                      : 'bg-studio-800'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Summary */}
              {ch.summary && (
                <p className="text-xs text-slate-300 leading-relaxed bg-studio-850/40 p-3 rounded-xl border border-studio-800/80">
                  {ch.summary}
                </p>
              )}

              {/* Acceptance Criteria & Risks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {ch.acceptance_criteria && (
                  <div className="p-3 bg-studio-900/60 rounded-xl border border-studio-800">
                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold block mb-1">
                      ✓ Definition of Done / Acceptance Criteria
                    </span>
                    <p className="text-slate-300 leading-relaxed">{ch.acceptance_criteria}</p>
                  </div>
                )}

                {ch.risks && (
                  <div className="p-3 bg-studio-900/60 rounded-xl border border-studio-800">
                    <span className="text-[10px] uppercase font-mono text-rose-400 font-bold block mb-1">
                      ⚠️ Known Technical / Design Risks
                    </span>
                    <p className="text-slate-300 leading-relaxed">{ch.risks}</p>
                  </div>
                )}
              </div>

              {/* Milestones Checklist */}
              {ch.milestones && ch.milestones.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block mb-2">
                    Key Milestones ({ch.milestones.filter(m => m.status === 'Completed').length}/{ch.milestones.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ch.milestones.map(m => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                          m.status === 'Completed'
                            ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300 line-through'
                            : 'bg-studio-850 border-studio-750 text-slate-200'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            m.status === 'Completed' ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* EDIT CHAPTER & MILESTONES MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? `Edit ${activeChapter?.name}` : 'New Roadmap Chapter Block'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveChapter} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Chapter / Milestone Title *</label>
              <input
                type="text"
                required
                value={activeChapter?.name || ''}
                onChange={e => setActiveChapter({ ...activeChapter, name: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Day Range *</label>
              <input
                type="text"
                required
                placeholder="Days 1–20"
                value={activeChapter?.day_range || ''}
                onChange={e => setActiveChapter({ ...activeChapter, day_range: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Status</label>
              <select
                value={activeChapter?.status || 'Planned'}
                onChange={e => setActiveChapter({ ...activeChapter, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Lead Owner</label>
              <select
                value={activeChapter?.owner_id || ''}
                onChange={e => setActiveChapter({ ...activeChapter, owner_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">Unassigned</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.roles})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Summary & Production Goals</label>
            <textarea
              rows={3}
              value={activeChapter?.summary || ''}
              onChange={e => setActiveChapter({ ...activeChapter, summary: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Definition of Done / Acceptance Criteria</label>
            <textarea
              rows={2}
              value={activeChapter?.acceptance_criteria || ''}
              onChange={e => setActiveChapter({ ...activeChapter, acceptance_criteria: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Technical & Pacing Risks</label>
            <textarea
              rows={2}
              value={activeChapter?.risks || ''}
              onChange={e => setActiveChapter({ ...activeChapter, risks: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Manage Milestones for this Chapter */}
          {isEditing && activeChapter?.id && (
            <div className="pt-3 border-t border-studio-800 space-y-3">
              <label className="block text-slate-400 font-semibold">Chapter Milestones</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {activeChapter.milestones?.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleToggleMilestone(m.id, m.status)}
                    className="flex items-center justify-between p-2 rounded-xl bg-studio-850 border border-studio-750 cursor-pointer hover:border-studio-600"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={m.status === 'Completed'}
                        onChange={() => {}}
                        className="rounded bg-studio-800 border-studio-700 text-rose-600"
                      />
                      <span className={m.status === 'Completed' ? 'line-through text-slate-500' : 'text-slate-200'}>
                        {m.title}
                      </span>
                    </div>
                    <Badge variant={m.status === 'Completed' ? 'emerald' : 'default'} size="sm">
                      {m.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New milestone checkpoint..."
                  value={newMilestoneTitle}
                  onChange={e => setNewMilestoneTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-studio-850 border border-studio-750 rounded-xl text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="px-3 py-1.5 bg-studio-800 hover:bg-studio-750 text-slate-200 rounded-xl font-medium"
                >
                  Add Milestone
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-studio-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-studio-800 text-slate-300 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
            >
              Save Roadmap Block
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
