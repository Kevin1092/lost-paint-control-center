import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Film,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { MediaProductionItem, TeamMember, Chapter } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const WORKFLOW_STAGES = [
  'Planned',
  'Recording',
  'Editing',
  'Review',
  'Approved',
  'Exported',
  'Published'
];

const MEDIA_TYPES = ['Trailer', 'Gameplay Recording', 'Edit', 'Short', 'Promotional Asset', 'Screenshot Pack'];
const ASPECT_RATIOS = ['16:9', '9:16 Vertical', '1:1 Square', '4:5'];

export const MediaView: React.FC = () => {
  const [items, setItems] = useState<MediaProductionItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<Partial<MediaProductionItem> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const [mediaRes, teamRes, chRes] = await Promise.all([
        api.getMedia(),
        api.getTeam(),
        api.getChapters()
      ]);
      setItems(mediaRes.mediaItems);
      setTeam(teamRes.team);
      setChapters(chRes.chapters);
    } catch (err) {
      console.error('Failed to load media assets', err);
    } finally {
      setLoading(false);
    }
  };

  const approvedRecorders = team.filter(m => m.can_record_gameplay === 1);

  const handleOpenCreate = () => {
    setActiveItem({
      title: '',
      media_type: 'Gameplay Recording',
      objective: 'Capture 60fps clean footage for vertical slice review',
      status: 'Planned',
      aspect_ratio: '16:9',
      related_chapter_id: chapters[0]?.id || null,
      raw_footage_url: '',
      final_export_url: '',
      notes: '',
      checklist: '[]',
      assignees: approvedRecorders.slice(0, 2).map(r => ({
        team_member_id: r.id,
        name: r.name,
        country_code: r.country_code,
        assignment_role: 'recorder'
      }))
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: MediaProductionItem) => {
    setActiveItem({ ...item });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem?.title) {
      error('Title is required.');
      return;
    }

    try {
      if (isEditing && activeItem.id) {
        await api.updateMedia(activeItem.id, activeItem);
        success('Media project updated.');
      } else {
        await api.createMedia(activeItem);
        success('Media production project created.');
      }
      setModalOpen(false);
      loadMedia();
    } catch (err: any) {
      error(err.message || 'Failed to save media item.');
    }
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateMediaStatus(id, newStatus);
      success(`Status updated to ${newStatus}`);
      loadMedia();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    try {
      await api.deleteMedia(id);
      success('Media asset removed.');
      loadMedia();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading video & gameplay pipeline..." />;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-studio-900 border border-studio-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Production Pipeline</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Gameplay Capture & Video Editing</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            Trailers, Gameplay Recording & Video Assets
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Approved Gameplay Recording Leads: <strong className="text-slate-200">Steve, AuraKkboo, Tobyosnow, Survivor</strong>. Tracks raw footage, cut edits, aspect ratios, and final renders.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Video Project</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No video or gameplay projects"
          description="Create a capture project for trailers, Instagram shorts, or internal gameplay review."
          actionText={canEdit ? "Create First Video Project" : undefined}
          onAction={canEdit ? handleOpenCreate : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div
              key={item.id}
              className="studio-card p-5 space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge variant="rose" size="sm">
                    {item.media_type}
                  </Badge>
                  <span className="text-[11px] font-mono font-bold text-slate-400 bg-studio-850 px-2 py-0.5 rounded border border-studio-750">
                    {item.aspect_ratio}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-100 mt-2.5 leading-snug">
                  {item.title}
                </h4>

                {item.chapter_name && (
                  <div className="text-xs text-slate-400 font-mono mt-1 truncate">
                    📍 {item.chapter_name}
                  </div>
                )}

                {item.objective && (
                  <p className="text-xs text-slate-300 mt-2 bg-studio-850/60 p-2.5 rounded-xl border border-studio-800 leading-relaxed">
                    {item.objective}
                  </p>
                )}

                {/* Assigned Recorders / Editors */}
                <div className="mt-3 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">
                    Assigned Recorders / Editors
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.assignees && item.assignees.length > 0 ? (
                      item.assignees.map((a, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-studio-850 text-slate-300 text-[11px] border border-studio-750 flex items-center gap-1"
                        >
                          <Video className="w-3 h-3 text-sky-400" />
                          <span>{a.name}</span>
                          <span className="text-[9px] text-slate-400 font-mono">({a.assignment_role})</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 text-[11px] italic">No assignees</span>
                    )}
                  </div>
                </div>

                {/* Footage links if provided */}
                {item.raw_footage_url && (
                  <a
                    href={item.raw_footage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Raw Footage Storage Link</span>
                  </a>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-studio-800 flex items-center justify-between">
                <select
                  value={item.status}
                  onChange={e => handleQuickStatus(item.id, e.target.value)}
                  className="bg-studio-850 border border-studio-750 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  {WORKFLOW_STAGES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 bg-studio-850 hover:bg-studio-800 text-slate-300 rounded-lg text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-950 text-rose-400 rounded-lg text-xs"
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
      )}

      {/* CREATE / EDIT MEDIA MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Media Project' : 'New Video / Gameplay Project'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMedia} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Project Title *</label>
            <input
              type="text"
              required
              value={activeItem?.title || ''}
              onChange={e => setActiveItem({ ...activeItem, title: e.target.value })}
              placeholder="e.g. Chapter 1 Cupboard Scene Teaser Cut"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Type</label>
              <select
                value={activeItem?.media_type || 'Gameplay Recording'}
                onChange={e => setActiveItem({ ...activeItem, media_type: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {MEDIA_TYPES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Aspect Ratio</label>
              <select
                value={activeItem?.aspect_ratio || '16:9'}
                onChange={e => setActiveItem({ ...activeItem, aspect_ratio: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
              >
                {ASPECT_RATIOS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Workflow Stage</label>
              <select
                value={activeItem?.status || 'Planned'}
                onChange={e => setActiveItem({ ...activeItem, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {WORKFLOW_STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Related Chapter</label>
              <select
                value={activeItem?.related_chapter_id || ''}
                onChange={e => setActiveItem({ ...activeItem, related_chapter_id: e.target.value || null })}
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
            <label className="block text-slate-400 mb-1 font-medium">Objective & Scope</label>
            <textarea
              rows={2}
              value={activeItem?.objective || ''}
              onChange={e => setActiveItem({ ...activeItem, objective: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Raw Footage Storage URL / Path</label>
            <input
              type="text"
              value={activeItem?.raw_footage_url || ''}
              onChange={e => setActiveItem({ ...activeItem, raw_footage_url: e.target.value })}
              placeholder="e.g. https://drive.google.com/... or /footage/raw_cupboard.mp4"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono text-xs"
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
              Save Media Asset
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
