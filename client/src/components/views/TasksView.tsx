import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Kanban,
  List,
  Trash2,
  Edit2,
  MessageSquare,
  CheckSquare,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, TaskCategory, TeamMember, Chapter } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATUS_COLUMNS: TaskStatus[] = [
  'Backlog',
  'To Do',
  'In Progress',
  'Blocked',
  'In Review',
  'Done'
];

const CATEGORIES: TaskCategory[] = [
  'Visual Scripting',
  'Coding',
  'Level Design',
  'UI',
  '3D Art',
  'Texturing',
  'Story',
  'Music',
  'QA',
  'Marketing',
  'Video',
  'Management',
  'Other'
];

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Partial<Task> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Subtask & Comment State
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter, priorityFilter, chapterFilter, assigneeFilter, search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (chapterFilter) params.chapter_id = chapterFilter;
      if (assigneeFilter) params.assignee_id = assigneeFilter;
      if (search) params.search = search;

      const [tasksRes, teamRes, chaptersRes] = await Promise.all([
        api.getTasks(params),
        api.getTeam(),
        api.getChapters()
      ]);

      setTasks(tasksRes.tasks);
      setTeam(teamRes.team);
      setChapters(chaptersRes.chapters);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setActiveTask({
      title: '',
      description: '',
      status: 'To Do',
      priority: 'Normal',
      category: 'Level Design',
      chapter_id: chapters[0]?.id || null,
      assignees: [],
      estimate_hours: 4,
      acceptance_criteria: '',
      tags: ''
    });
    setIsEditing(false);
    setEditModalOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setActiveTask({
      ...task,
      chapter_id: task.chapter_id || '',
      assignees: task.assignees || []
    });
    setIsEditing(true);
    setEditModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !activeTask.title) {
      error('Task title is required.');
      return;
    }

    try {
      const payload = {
        title: activeTask.title,
        description: activeTask.description || '',
        status: activeTask.status || 'To Do',
        priority: activeTask.priority || 'Normal',
        category: activeTask.category || 'Other',
        chapter_id: activeTask.chapter_id || null,
        due_date: activeTask.due_date || null,
        estimate_hours: activeTask.estimate_hours ? Number(activeTask.estimate_hours) : null,
        tags: activeTask.tags || '',
        acceptance_criteria: activeTask.acceptance_criteria || '',
        assignee_ids: (activeTask.assignees || []).map(a => a.id)
      };

      if (isEditing && activeTask.id) {
        await api.updateTask(activeTask.id, payload);
        success('Task updated successfully.');
      } else {
        await api.createTask(payload);
        success('Task created successfully.');
      }

      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to save task.');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      success(`Status updated to ${newStatus}`);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to change status.');
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete task "${title}"?`)) return;
    try {
      await api.deleteTask(taskId);
      success('Task deleted.');
      if (detailModalOpen) setDetailModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to delete task.');
    }
  };

  const handleOpenDetail = async (taskId: string) => {
    try {
      const res = await api.getTask(taskId);
      setSelectedTask(res.task);
      setDetailModalOpen(true);
    } catch (err) {
      error('Failed to load task details.');
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    try {
      await api.addSubtask(selectedTask.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
      const updated = await api.getTask(selectedTask.id);
      setSelectedTask(updated.task);
      loadData();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentState: number) => {
    if (!selectedTask) return;
    try {
      await api.toggleSubtask(selectedTask.id, subtaskId, currentState === 0);
      const updated = await api.getTask(selectedTask.id);
      setSelectedTask(updated.task);
      loadData();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCommentContent.trim()) return;
    try {
      await api.addComment(selectedTask.id, newCommentContent.trim());
      setNewCommentContent('');
      const updated = await api.getTask(selectedTask.id);
      setSelectedTask(updated.task);
    } catch (err: any) {
      error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks by title or tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="">All Statuses</option>
            {STATUS_COLUMNS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Chapter Filter */}
          <select
            value={chapterFilter}
            onChange={e => setChapterFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="">All Chapters</option>
            {chapters.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.day_range} — {ch.name}</option>
            ))}
          </select>
        </div>

        {/* View Switcher & Create Task Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 bg-studio-900 border border-studio-800 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-studio-800 text-rose-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kanban Board View"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-studio-800 text-rose-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {canEdit && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-rose-950/50 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading production tasks..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description="No production tasks match the current filter selection or search query."
          actionText={canEdit ? "Create First Task" : undefined}
          onAction={canEdit ? handleOpenCreate : undefined}
        />
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
          {STATUS_COLUMNS.map(colStatus => {
            const colTasks = tasks.filter(t => t.status === colStatus);
            return (
              <div
                key={colStatus}
                className="bg-studio-950/70 border border-studio-850 rounded-2xl p-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-studio-800/80">
                  <span className="text-xs font-bold text-slate-200 tracking-wide flex items-center gap-2">
                    {colStatus}
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-studio-850 text-slate-400 border border-studio-750">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => handleOpenDetail(task.id)}
                      className="studio-card p-3 cursor-pointer group hover:border-rose-500/40 hover:shadow-rose-950/20 text-xs space-y-2.5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            task.priority === 'Urgent'
                              ? 'rose'
                              : task.priority === 'High'
                              ? 'amber'
                              : 'default'
                          }
                          size="sm"
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.category}
                        </span>
                      </div>

                      <h4 className="font-semibold text-slate-100 group-hover:text-rose-300 transition-colors leading-snug">
                        {task.title}
                      </h4>

                      {task.chapter_name && (
                        <div className="text-[10px] font-mono text-rose-400/80 truncate">
                          📍 {task.chapter_name}
                        </div>
                      )}

                      {/* Subtasks summary */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <CheckSquare className="w-3 h-3 text-emerald-400" />
                          <span>
                            {task.subtasks.filter(s => s.is_completed === 1).length}/{task.subtasks.length} subtasks
                          </span>
                        </div>
                      )}

                      {/* Card Footer: Assignees & Due Date */}
                      <div className="flex items-center justify-between pt-2 border-t border-studio-800/80 text-[11px]">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {task.assignees?.map(a => (
                            <span
                              key={a.id}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-studio-800 border border-studio-700 text-[10px] font-bold text-slate-200"
                              title={`${a.name} (${a.roles})`}
                            >
                              {a.name.slice(0, 1)}
                            </span>
                          ))}
                        </div>

                        {task.due_date && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="studio-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-studio-850/80 border-b border-studio-800 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Chapter</th>
                  <th className="py-3 px-4">Assignees</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-800/80">
                {tasks.map(task => (
                  <tr
                    key={task.id}
                    onClick={() => handleOpenDetail(task.id)}
                    className="hover:bg-studio-850/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-100 max-w-xs truncate">
                      {task.title}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={task.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        className="bg-studio-850 border border-studio-750 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                      >
                        {STATUS_COLUMNS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={task.priority === 'Urgent' ? 'rose' : task.priority === 'High' ? 'amber' : 'default'}
                        size="sm"
                      >
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {task.category}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px] truncate max-w-[150px]">
                      {task.chapter_name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex -space-x-1.5">
                        {task.assignees?.map(a => (
                          <span
                            key={a.id}
                            className="w-5 h-5 rounded-full bg-studio-800 border border-studio-700 flex items-center justify-center text-[10px] font-bold text-slate-200"
                            title={a.name}
                          >
                            {a.name.slice(0, 1)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {task.due_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(task)}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-studio-800 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
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

      {/* CREATE / EDIT TASK MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={isEditing ? 'Edit Production Task' : 'Create New Production Task'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Task Title *</label>
            <input
              type="text"
              required
              value={activeTask?.title || ''}
              onChange={e => setActiveTask({ ...activeTask, title: e.target.value })}
              placeholder="e.g. Implement cupboard hiding interaction graph"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Category *</label>
              <select
                value={activeTask?.category || 'Level Design'}
                onChange={e => setActiveTask({ ...activeTask, category: e.target.value as TaskCategory })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Status</label>
              <select
                value={activeTask?.status || 'To Do'}
                onChange={e => setActiveTask({ ...activeTask, status: e.target.value as TaskStatus })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {STATUS_COLUMNS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Priority</label>
              <select
                value={activeTask?.priority || 'Normal'}
                onChange={e => setActiveTask({ ...activeTask, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Linked Chapter</label>
              <select
                value={activeTask?.chapter_id || ''}
                onChange={e => setActiveTask({ ...activeTask, chapter_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">None (Independent Task)</option>
                {chapters.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.day_range} — {ch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Estimate (Hours)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={activeTask?.estimate_hours || ''}
                onChange={e => setActiveTask({ ...activeTask, estimate_hours: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Assignees (Select Team Members)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-studio-850 border border-studio-750 rounded-xl">
              {team.map(m => {
                const isAssigned = (activeTask?.assignees || []).some(a => a.id === m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      isAssigned ? 'bg-rose-950/60 text-rose-200 border border-rose-800/60' : 'text-slate-300 hover:bg-studio-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => {
                        const current = activeTask?.assignees || [];
                        const updated = isAssigned
                          ? current.filter(a => a.id !== m.id)
                          : [...current, m];
                        setActiveTask({ ...activeTask, assignees: updated });
                      }}
                      className="rounded bg-studio-800 border-studio-700 text-rose-600 focus:ring-0"
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Detailed Description</label>
            <textarea
              rows={3}
              value={activeTask?.description || ''}
              onChange={e => setActiveTask({ ...activeTask, description: e.target.value })}
              placeholder="Describe technical implementation details, Unity components, or scene requirements..."
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Acceptance Criteria / Definition of Done</label>
            <textarea
              rows={2}
              value={activeTask?.acceptance_criteria || ''}
              onChange={e => setActiveTask({ ...activeTask, acceptance_criteria: e.target.value })}
              placeholder="Specific test criteria to verify this task is finished..."
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-studio-800">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 bg-studio-800 hover:bg-studio-750 text-slate-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-lg"
            >
              {isEditing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* TASK DETAIL MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedTask?.title || 'Task Details'}
        subtitle={`Category: ${selectedTask?.category} • Priority: ${selectedTask?.priority}`}
        maxWidth="2xl"
      >
        {selectedTask && (
          <div className="space-y-6 text-xs">
            {/* Status & Properties */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-studio-850/60 rounded-xl border border-studio-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Status</span>
                <Badge variant={selectedTask.status === 'Done' ? 'emerald' : selectedTask.status === 'Blocked' ? 'rose' : 'default'} size="sm" className="mt-1">
                  {selectedTask.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Chapter</span>
                <span className="font-semibold text-slate-200 mt-1 block truncate">
                  {selectedTask.chapter_name || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Estimate</span>
                <span className="font-mono text-slate-200 mt-1 block">
                  {selectedTask.estimate_hours ? `${selectedTask.estimate_hours} hrs` : 'Unestimated'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Due Date</span>
                <span className="font-mono text-slate-200 mt-1 block">
                  {selectedTask.due_date || 'Unscheduled'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-slate-400 font-semibold mb-1">Description</h4>
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed p-3 bg-studio-850 rounded-xl border border-studio-800">
                {selectedTask.description || 'No description provided.'}
              </p>
            </div>

            {/* Acceptance Criteria */}
            {selectedTask.acceptance_criteria && (
              <div>
                <h4 className="text-slate-400 font-semibold mb-1">Acceptance Criteria</h4>
                <div className="p-3 bg-studio-850 rounded-xl border border-studio-800 text-slate-200 font-mono text-[11px] leading-relaxed">
                  {selectedTask.acceptance_criteria}
                </div>
              </div>
            )}

            {/* Assignees */}
            <div>
              <h4 className="text-slate-400 font-semibold mb-2">Assigned Team Members</h4>
              <div className="flex flex-wrap gap-2">
                {selectedTask.assignees && selectedTask.assignees.length > 0 ? (
                  selectedTask.assignees.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-850 border border-studio-750">
                      <span className="w-5 h-5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-[10px]">
                        {a.name.slice(0, 1)}
                      </span>
                      <span className="font-semibold text-slate-200">{a.name}</span>
                      <span className="text-[10px] text-slate-400">({a.roles})</span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400 italic">No members assigned yet.</span>
                )}
              </div>
            </div>

            {/* Subtasks Checklist */}
            <div className="space-y-2">
              <h4 className="text-slate-400 font-semibold flex items-center justify-between">
                <span>Subtasks / Checklist</span>
                <span className="text-slate-400 font-mono font-normal">
                  {selectedTask.subtasks?.filter(s => s.is_completed === 1).length || 0}/
                  {selectedTask.subtasks?.length || 0}
                </span>
              </h4>

              <div className="space-y-1.5">
                {selectedTask.subtasks?.map(st => (
                  <div
                    key={st.id}
                    onClick={() => canEdit && handleToggleSubtask(st.id, st.is_completed)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      st.is_completed === 1
                        ? 'bg-studio-900/60 border-studio-800 text-slate-400 line-through'
                        : 'bg-studio-850 border-studio-750 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={st.is_completed === 1}
                        onChange={() => {}}
                        className="rounded bg-studio-800 border-studio-700 text-rose-600 focus:ring-0"
                      />
                      <span>{st.title}</span>
                    </div>
                  </div>
                ))}
              </div>

              {canEdit && (
                <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a new checklist item..."
                    className="flex-1 px-3 py-1.5 bg-studio-850 border border-studio-750 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-studio-800 hover:bg-studio-750 text-slate-200 rounded-xl font-medium"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>

            {/* Comments Stream */}
            <div className="space-y-3 pt-3 border-t border-studio-800">
              <h4 className="text-slate-400 font-semibold flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-rose-400" />
                Discussion & Activity
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map(c => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-studio-850 border border-studio-800">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-slate-200">{c.author_name}</span>
                        <span className="font-mono">{c.created_at ? c.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs italic">No comments yet.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newCommentContent}
                  onChange={e => setNewCommentContent(e.target.value)}
                  placeholder="Post an update or note on this task..."
                  className="flex-1 px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold"
                >
                  Post
                </button>
              </form>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-studio-800">
              {isAdmin && (
                <button
                  onClick={() => handleDeleteTask(selectedTask.id, selectedTask.title)}
                  className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-950 border border-rose-800/80 text-rose-300 rounded-xl flex items-center gap-1.5 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Task
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                {canEdit && (
                  <button
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenEdit(selectedTask);
                    }}
                    className="px-4 py-1.5 bg-studio-800 hover:bg-studio-750 text-slate-200 rounded-xl font-medium"
                  >
                    Edit Task
                  </button>
                )}
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
