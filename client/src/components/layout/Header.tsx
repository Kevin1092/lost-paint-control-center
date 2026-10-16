import React, { useState } from 'react';
import { Menu, Plus, User as UserIcon, LogOut, ShieldCheck, Database, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenMobileSidebar: () => void;
  onOpenQuickAction: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenMobileSidebar,
  onOpenQuickAction,
  onOpenAuthModal
}) => {
  const { user, logout, canEdit } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-studio-950/80 backdrop-blur-md border-b border-studio-800/80 px-4 sm:px-8 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-studio-900 rounded-xl"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-400 hidden sm:block">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center gap-3">
        {/* System Health Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-studio-900 border border-studio-800 text-[11px] text-slate-400 font-mono">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>SQLite WAL</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        {/* Quick Action Button */}
        {canEdit && (
          <button
            onClick={onOpenQuickAction}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-rose-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Action</span>
          </button>
        )}

        {/* User Account / Profile */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-300 font-bold text-xs uppercase">
                {user.display_name.slice(0, 2)}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-semibold text-slate-200 leading-none truncate max-w-[110px]">
                  {user.display_name}
                </div>
                <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                  {user.role}
                </div>
              </div>
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-studio-900 border border-studio-750 rounded-2xl shadow-2xl py-2 z-50 text-xs animate-in zoom-in-95">
                  <div className="px-4 py-3 border-b border-studio-800">
                    <p className="font-semibold text-slate-100">{user.display_name}</p>
                    <p className="text-slate-400 text-[11px] truncate">{user.email}</p>
                    <div className="mt-2">
                      <Badge
                        variant={user.role === 'admin' ? 'rose' : user.role === 'editor' ? 'amber' : 'slate'}
                        size="sm"
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Role: {user.role.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-studio-800 hover:bg-studio-750 text-slate-200 border border-studio-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <KeyRound className="w-4 h-4 text-rose-400" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
