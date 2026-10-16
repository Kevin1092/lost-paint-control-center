import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Milestone,
  Users,
  Calendar,
  BookOpen,
  Bug,
  FileText,
  Share2,
  Video,
  History,
  FileSpreadsheet,
  Settings,
  Skull,
  X
} from 'lucide-react';

export type NavSection =
  | 'dashboard'
  | 'tasks'
  | 'chapters'
  | 'team'
  | 'calendar'
  | 'devlogs'
  | 'bugs'
  | 'documents'
  | 'marketing'
  | 'media'
  | 'audit'
  | 'data'
  | 'settings';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  unreadBugsCount?: number;
  openTasksCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpenMobile,
  onCloseMobile,
  unreadBugsCount = 0,
  openTasksCount = 0
}) => {
  const navItems = [
    { id: 'dashboard' as NavSection, label: 'Studio Dashboard', icon: LayoutDashboard },
    { id: 'tasks' as NavSection, label: 'Tasks', icon: CheckSquare, badge: openTasksCount > 0 ? String(openTasksCount) : undefined },
    { id: 'chapters' as NavSection, label: 'Chapters & Roadmap', icon: Milestone },
    { id: 'team' as NavSection, label: 'Team', icon: Users, badge: '13' },
    { id: 'calendar' as NavSection, label: 'Calendar / Time Blocks', icon: Calendar },
    { id: 'devlogs' as NavSection, label: 'Development Logs', icon: BookOpen },
    { id: 'bugs' as NavSection, label: 'Bug Tracker & QA', icon: Bug, badge: unreadBugsCount > 0 ? String(unreadBugsCount) : undefined, badgeColor: 'rose' },
    { id: 'documents' as NavSection, label: 'Documents / KB', icon: FileText },
    { id: 'marketing' as NavSection, label: 'Marketing & Social', icon: Share2 },
    { id: 'media' as NavSection, label: 'Video & Gameplay', icon: Video },
    { id: 'audit' as NavSection, label: 'Change Log / Activity', icon: History },
    { id: 'data' as NavSection, label: 'Data Import / Export', icon: FileSpreadsheet },
    { id: 'settings' as NavSection, label: 'Settings & Backups', icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-studio-950/95 border-r border-studio-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Studio Brand Header */}
        <div className="p-5 border-b border-studio-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-950 p-0.5 shadow-lg shadow-rose-950/50 flex items-center justify-center">
              <Skull className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-wider uppercase">
                Lost Paint Studios
              </h1>
              <p className="text-[11px] font-medium text-rose-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Control Center
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Title Notice Badge */}
        <div className="px-5 py-3 border-b border-studio-800/50 bg-studio-900/40">
          <div className="text-[10px] font-mono uppercase text-slate-400 tracking-widest">Active Project</div>
          <div className="text-xs font-semibold text-slate-200 truncate mt-0.5" title="Untitled Psychological Horror Game">
            Untitled Psychological Horror Game
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-studio-800 text-slate-300 text-[10px] font-mono">Unity URP</span>
            <span>•</span>
            <span className="text-amber-400/90 text-[10px]">Early Pre-Production</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-rose-600/15 text-rose-300 border border-rose-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-studio-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      item.badgeColor === 'rose'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                        : isActive
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-studio-850 text-slate-400 border border-studio-750'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Studio Footer Info */}
        <div className="p-4 border-t border-studio-800/80 bg-studio-900/30 text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span>Targets:</span>
            <span className="text-slate-300 font-mono text-[10px]">Steam / Android</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>First Priority:</span>
            <span className="text-emerald-400 font-medium">Chapter 1 Opening</span>
          </div>
        </div>
      </aside>
    </>
  );
};
