import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Users,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { CalendarEvent, Chapter, Task } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const EVENT_TYPES = ['Meeting', 'Playtest', 'Deadline', 'Work Session', 'Marketing', 'Milestone'];

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [timeframe, setTimeframe] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadEvents();
  }, [typeFilter, timeframe]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (typeFilter) params.event_type = typeFilter;
      if (timeframe !== 'all') params.timeframe = timeframe;

      const [eventsRes, chRes] = await Promise.all([
        api.getCalendar(params),
        api.getChapters()
      ]);
      setEvents(eventsRes.events);
      setChapters(chRes.chapters);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    const today = new Date().toISOString().slice(0, 16);
    setActiveEvent({
      title: '',
      event_type: 'Work Session',
      start_time: today,
      duration_minutes: 60,
      status: 'Scheduled',
      notes: ''
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (evt: CalendarEvent) => {
    setActiveEvent({ ...evt });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent?.title || !activeEvent?.start_time) {
      error('Title and start date/time are required.');
      return;
    }

    try {
      if (isEditing && activeEvent.id) {
        await api.updateEvent(activeEvent.id, activeEvent);
        success('Event updated.');
      } else {
        await api.createEvent(activeEvent);
        success('Session scheduled.');
      }
      setModalOpen(false);
      loadEvents();
    } catch (err: any) {
      error(err.message || 'Failed to save event.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.deleteEvent(id);
      success('Event removed.');
      loadEvents();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading) return <LoadingSpinner label="Loading studio calendar & sessions..." />;

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Timeframe Filter */}
          <div className="flex p-1 bg-studio-900 border border-studio-800 rounded-xl">
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                timeframe === 'all' ? 'bg-studio-800 text-rose-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setTimeframe('upcoming')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                timeframe === 'upcoming' ? 'bg-studio-800 text-rose-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setTimeframe('past')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                timeframe === 'past' ? 'bg-studio-800 text-rose-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Past
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Types</option>
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Session</span>
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No events scheduled"
          description="There are currently no meetings, playtests, or milestone deadlines matching the filter."
          actionText={canEdit ? "Schedule a Session" : undefined}
          onAction={canEdit ? handleOpenCreate : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(evt => (
            <div
              key={evt.id}
              className="studio-card p-5 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      evt.event_type === 'Playtest'
                        ? 'purple'
                        : evt.event_type === 'Deadline'
                        ? 'rose'
                        : evt.event_type === 'Meeting'
                        ? 'sky'
                        : 'default'
                    }
                    size="sm"
                  >
                    {evt.event_type}
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-400">
                    {evt.duration_minutes ? `${evt.duration_minutes} min` : ''}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-100 mt-2 leading-snug">
                  {evt.title}
                </h4>

                <div className="flex items-center gap-2 text-xs text-rose-400/90 font-mono mt-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{evt.start_time.replace('T', ' ')}</span>
                </div>

                {evt.chapter_name && (
                  <div className="text-[11px] text-slate-400 font-mono mt-2 truncate">
                    📍 {evt.chapter_name}
                  </div>
                )}

                {evt.notes && (
                  <p className="text-xs text-slate-300 mt-2.5 p-2.5 rounded-lg bg-studio-850/60 border border-studio-800 leading-relaxed">
                    {evt.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-studio-800 flex items-center justify-between">
                <Badge variant={evt.status === 'Completed' ? 'emerald' : 'default'} size="sm">
                  {evt.status}
                </Badge>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(evt)}
                      className="p-1.5 bg-studio-850 hover:bg-studio-800 text-slate-300 rounded-lg text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(evt.id)}
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

      {/* EVENT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Calendar Session' : 'Schedule New Session / Deadline'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Session Title *</label>
            <input
              type="text"
              required
              value={activeEvent?.title || ''}
              onChange={e => setActiveEvent({ ...activeEvent, title: e.target.value })}
              placeholder="e.g. Chapter 1 Vertical Slice Playtest #2"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Event Type</label>
              <select
                value={activeEvent?.event_type || 'Work Session'}
                onChange={e => setActiveEvent({ ...activeEvent, event_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Status</label>
              <select
                value={activeEvent?.status || 'Scheduled'}
                onChange={e => setActiveEvent({ ...activeEvent, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={activeEvent?.start_time ? activeEvent.start_time.slice(0, 16) : ''}
                onChange={e => setActiveEvent({ ...activeEvent, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Duration (Minutes)</label>
              <input
                type="number"
                min="10"
                step="5"
                value={activeEvent?.duration_minutes || 60}
                onChange={e => setActiveEvent({ ...activeEvent, duration_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Related Chapter</label>
            <select
              value={activeEvent?.related_chapter_id || ''}
              onChange={e => setActiveEvent({ ...activeEvent, related_chapter_id: e.target.value || null })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="">None</option>
              {chapters.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.day_range} — {ch.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Session Notes</label>
            <textarea
              rows={3}
              value={activeEvent?.notes || ''}
              onChange={e => setActiveEvent({ ...activeEvent, notes: e.target.value })}
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
              Save Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
