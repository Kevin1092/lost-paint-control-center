import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Bug,
  Users,
  Calendar,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import { DashboardStats, Chapter } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

interface DashboardViewProps {
  onNavigate: (section: any) => void;
  onOpenQuickAction: (type?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickAction
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { canEdit } = useAuth();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <LoadingSpinner label="Loading Lost Paint Studios dashboard metrics..." />;
  }

  const { taskCounts, chapterProgress, teamWorkload, bugStats, recentActivity, upcomingEvents, blockedTasks } = stats;

  return (
    <div className="space-y-6">
      {/* Blockers Alert Banner (if any) */}
      {blockedTasks && blockedTasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-200">
              Active Production Blockers ({blockedTasks.length})
            </h4>
            <div className="mt-1 space-y-1">
              {blockedTasks.map(t => (
                <div key={t.id} className="text-xs text-rose-300/90 flex items-center justify-between">
                  <span>• {t.title} <span className="text-rose-400/70 font-mono">({t.category})</span></span>
                  <button
                    onClick={() => onNavigate('tasks')}
                    className="text-[11px] underline hover:text-rose-100"
                  >
                    Resolve in Tasks →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Tasks */}
        <div className="studio-card p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Tasks</span>
            <CheckSquareIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2 font-mono">
            {taskCounts.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Tracked studio tasks</div>
        </div>

        {/* Completed */}
        <div className="studio-card p-4">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-2 font-mono">
            {taskCounts.completed}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Finished deliverables</div>
        </div>

        {/* In Progress */}
        <div className="studio-card p-4">
          <div className="flex items-center justify-between text-sky-400 text-xs font-medium">
            <span>In Progress</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-300 mt-2 font-mono">
            {taskCounts.in_progress}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Active work in studio</div>
        </div>

        {/* Blocked */}
        <div className="studio-card p-4">
          <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
            <span>Blocked</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">
            {taskCounts.blocked}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Needs team intervention</div>
        </div>

        {/* Open Bugs */}
        <div className="studio-card p-4">
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
            <span>Open Bugs</span>
            <Bug className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2 font-mono">
            {bugStats.open}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {bugStats.critical > 0 ? `${bugStats.critical} Critical!` : 'QA tracking'}
          </div>
        </div>

        {/* Overdue */}
        <div className="studio-card p-4">
          <div className="flex items-center justify-between text-purple-400 text-xs font-medium">
            <span>Overdue</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-2 font-mono">
            {taskCounts.overdue}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Past target deadline</div>
        </div>
      </div>

      {/* Chapter Roadmap Progress */}
      <div className="studio-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MilestoneIcon className="w-5 h-5 text-rose-500" />
              Chapter Roadmap & Vertical Slice Progress
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly calculated from real linked tasks ({taskCounts.completed} of {taskCounts.total} completed)
            </p>
          </div>
          <button
            onClick={() => onNavigate('chapters')}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
          >
            Full Roadmap <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-4">
          {chapterProgress.map((chapter: Chapter) => {
            const percent = chapter.progress_percent || 0;
            return (
              <div key={chapter.id} className="p-3.5 rounded-xl bg-studio-850/60 border border-studio-800 hover:border-studio-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-rose-400/90 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                      {chapter.day_range}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">
                      {chapter.name}
                    </span>
                    <Badge
                      variant={
                        chapter.status === 'Completed'
                          ? 'emerald'
                          : chapter.status === 'In Progress'
                          ? 'sky'
                          : chapter.status === 'Blocked'
                          ? 'rose'
                          : 'default'
                      }
                      size="sm"
                    >
                      {chapter.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {percent}%
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1.5 font-mono">
                      ({chapter.completed_tasks || 0}/{chapter.total_tasks || 0} tasks)
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-studio-900 rounded-full overflow-hidden border border-studio-800/80">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      percent === 100
                        ? 'bg-emerald-500'
                        : percent > 50
                        ? 'bg-rose-500'
                        : percent > 0
                        ? 'bg-sky-500'
                        : 'bg-studio-700'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Team Workload + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Workload */}
        <div className="studio-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-500" />
              Team Workload & Assignments
            </h3>
            <button
              onClick={() => onNavigate('team')}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
            >
              All 13 Members <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {teamWorkload.slice(0, 7).map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-studio-850/40 border border-studio-800/80 text-xs"
              >
                <div className="flex items-center gap-2.5 truncate max-w-[200px]">
                  <span className="text-base">{getCountryFlag(m.country_code)}</span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-200 block truncate">{m.name}</span>
                    <span className="text-[10px] text-slate-400 truncate block">{m.roles}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-studio-800 text-slate-300 font-mono text-[11px]">
                    {m.active || 0} active
                  </span>
                  {m.overdue > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono">
                      {m.overdue} overdue
                    </span>
                  )}
                  <span className="text-slate-400 font-mono text-[11px]">
                    {m.completed || 0} done
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Deadlines & Calendar Events */}
        <div className="studio-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-500" />
              Upcoming Sessions & Deadlines
            </h3>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
            >
              View Calendar <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-studio-800 rounded-xl">
              No upcoming events scheduled. Use Calendar to add sessions.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {upcomingEvents.map((evt: any) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-studio-850/40 border border-studio-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block">{evt.title}</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono text-rose-400">{evt.start_time.slice(0, 10)}</span>
                      <span>•</span>
                      <span className="capitalize">{evt.event_type}</span>
                    </div>
                  </div>
                  <Badge variant={evt.status === 'Completed' ? 'emerald' : 'default'} size="sm">
                    {evt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launchpad */}
        <div className="studio-card p-6">
          <h3 className="text-base font-bold text-slate-100 mb-3">Quick Production Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => onOpenQuickAction('task')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-750 text-xs font-medium text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-400" />
                Create New Production Task
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Tasks</span>
            </button>
            <button
              onClick={() => onOpenQuickAction('devlog')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-750 text-xs font-medium text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                Log Daily Development Update
              </span>
              <span className="text-[10px] text-slate-400 font-mono">DevLogs</span>
            </button>
            <button
              onClick={() => onOpenQuickAction('bug')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-750 text-xs font-medium text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Report Bug / Glitch
              </span>
              <span className="text-[10px] text-slate-400 font-mono">QA</span>
            </button>
            <button
              onClick={() => onNavigate('data')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-750 text-xs font-medium text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Download Excel Workbook (.xlsx)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Export</span>
            </button>
          </div>
        </div>

        {/* Recent Audit / Change Activity */}
        <div className="studio-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" />
              Recent Studio Activity & Change Log
            </h3>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
            >
              Full Change Log <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {recentActivity.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-2.5 rounded-xl bg-studio-850/40 border border-studio-800/80 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{log.user_name}</span>
                    <Badge variant="default" size="sm" className="font-mono text-[10px]">
                      {log.action}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-mono">[{log.entity_type}]</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                  {log.created_at ? log.created_at.slice(11, 16) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function CheckSquareIcon(props: any) {
  return <CheckCircle2 {...props} />;
}

function MilestoneIcon(props: any) {
  return <TrendingUp {...props} />;
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
