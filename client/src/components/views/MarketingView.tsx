import React, { useState, useEffect } from 'react';
import {
  Share2,
  Instagram,
  Youtube,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { MarketingItem, TeamMember, Chapter } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATUS_STAGES = [
  'Idea',
  'Draft',
  'Ready for Review',
  'Approved',
  'Scheduled',
  'Published'
];

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Steam Community', 'X / Twitter', 'Reddit', 'Other'];
const FORMATS = ['reel', 'post', 'story', 'short', 'teaser', 'devlog', 'announcement', 'screenshot', 'gameplay clip'];

export const MarketingView: React.FC = () => {
  const [items, setItems] = useState<MarketingItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<Partial<MarketingItem> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadMarketing();
  }, [platformFilter, statusFilter]);

  const loadMarketing = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (platformFilter) params.platform = platformFilter;
      if (statusFilter) params.status = statusFilter;

      const [mktRes, teamRes, chRes] = await Promise.all([
        api.getMarketing(params),
        api.getTeam(),
        api.getChapters()
      ]);
      setItems(mktRes.items);
      setTeam(teamRes.team);
      setChapters(chRes.chapters);
    } catch (err) {
      console.error('Failed to load marketing items', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    // Survivor is Marketing and Industry Head
    const survivor = team.find(m => m.name.toLowerCase().includes('survivor')) || team[0];
    const aqua = team.find(m => m.name.toLowerCase().includes('aqua')) || team[1];

    setActiveItem({
      title: '',
      platform: 'Instagram',
      format: 'reel',
      caption: '🚪 James Walker approaches the Miller abandoned farmhouse...\n\n#indiegame #gamedev #lostpaintstudios #psychologicalhorror',
      status: 'Idea',
      owner_id: survivor?.id || null,
      reviewer_id: aqua?.id || null,
      planned_publish_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      media_url: '',
      published_url: '',
      performance_notes: ''
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: MarketingItem) => {
    setActiveItem({ ...item });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem?.title) {
      error('Title is required.');
      return;
    }

    try {
      if (isEditing && activeItem.id) {
        await api.updateMarketing(activeItem.id, activeItem);
        success('Marketing item updated.');
      } else {
        await api.createMarketing(activeItem);
        success('Marketing item scheduled in pipeline.');
      }
      setModalOpen(false);
      loadMarketing();
    } catch (err: any) {
      error(err.message || 'Failed to save item.');
    }
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateMarketingStatus(id, newStatus);
      success(`Moved to ${newStatus}`);
      loadMarketing();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this marketing item?')) return;
    try {
      await api.deleteMarketing(id);
      success('Marketing item removed.');
      loadMarketing();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading marketing & Instagram pipeline..." />;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-studio-900 border border-studio-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Marketing Pipeline</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Led by Survivor (Marketing & Industry Head)</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            Pre-Launch Social Media & Instagram Content Planner
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Manage Instagram reels, teasers, shorts, and gameplay snippets. Tracks draft captions, review approvals, publication dates, and engagement.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Plan Content</span>
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <select
          value={platformFilter}
          onChange={e => setPlatformFilter(e.target.value)}
          className="px-3 py-1.5 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Pipeline Stages</option>
          {STATUS_STAGES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
        {STATUS_STAGES.map(stage => {
          const stageItems = items.filter(i => i.status === stage);
          return (
            <div
              key={stage}
              className="bg-studio-950/70 border border-studio-850 rounded-2xl p-3 flex flex-col min-h-[450px]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-studio-800">
                <span className="text-xs font-bold text-slate-200">
                  {stage}
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-studio-850 text-slate-400 border border-studio-750">
                  {stageItems.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {stageItems.map(item => (
                  <div
                    key={item.id}
                    className="studio-card p-3 text-xs space-y-2.5 hover:border-rose-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={item.platform === 'Instagram' ? 'rose' : item.platform === 'YouTube' ? 'amber' : 'default'}
                        size="sm"
                      >
                        {item.platform}
                      </Badge>
                      <span className="text-[10px] uppercase font-mono text-slate-400">
                        {item.format}
                      </span>
                    </div>

                    <h4 className="font-semibold text-slate-100 leading-snug">
                      {item.title}
                    </h4>

                    {item.planned_publish_date && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3 text-rose-400" />
                        <span>Date: {item.planned_publish_date}</span>
                      </div>
                    )}

                    {item.caption && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 italic bg-studio-850/60 p-2 rounded-lg">
                        "{item.caption}"
                      </p>
                    )}

                    <div className="pt-2 border-t border-studio-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate max-w-[100px]">
                        By: <strong className="text-slate-300">{item.owner_name || 'Survivor'}</strong>
                      </span>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 hover:text-slate-100 text-slate-400"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 hover:text-rose-300 text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MARKETING MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Marketing Item' : 'Plan New Social Media Content'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Post Title / Hook *</label>
            <input
              type="text"
              required
              value={activeItem?.title || ''}
              onChange={e => setActiveItem({ ...activeItem, title: e.target.value })}
              placeholder="e.g. Atmospheric Farmhouse Approach Teaser #1"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Platform</label>
              <select
                value={activeItem?.platform || 'Instagram'}
                onChange={e => setActiveItem({ ...activeItem, platform: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {PLATFORMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Format</label>
              <select
                value={activeItem?.format || 'reel'}
                onChange={e => setActiveItem({ ...activeItem, format: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500 capitalize"
              >
                {FORMATS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Pipeline Status</label>
              <select
                value={activeItem?.status || 'Idea'}
                onChange={e => setActiveItem({ ...activeItem, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {STATUS_STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Planned Publish Date</label>
              <input
                type="date"
                value={activeItem?.planned_publish_date || ''}
                onChange={e => setActiveItem({ ...activeItem, planned_publish_date: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Content Owner</label>
              <select
                value={activeItem?.owner_id || ''}
                onChange={e => setActiveItem({ ...activeItem, owner_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {team.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.roles})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Reviewer Lead</label>
              <select
                value={activeItem?.reviewer_id || ''}
                onChange={e => setActiveItem({ ...activeItem, reviewer_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">None</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Draft Caption & Hashtags</label>
            <textarea
              rows={4}
              value={activeItem?.caption || ''}
              onChange={e => setActiveItem({ ...activeItem, caption: e.target.value })}
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
              Save Marketing Post
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
