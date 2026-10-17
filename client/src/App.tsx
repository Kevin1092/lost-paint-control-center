import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar, NavSection } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/views/DashboardView';
import { TasksView } from './components/views/TasksView';
import { ChaptersView } from './components/views/ChaptersView';
import { TeamView } from './components/views/TeamView';
import { CalendarView } from './components/views/CalendarView';
import { DevlogsView } from './components/views/DevlogsView';
import { BugsView } from './components/views/BugsView';
import { DocumentsView } from './components/views/DocumentsView';
import { MarketingView } from './components/views/MarketingView';
import { MediaView } from './components/views/MediaView';
import { AuditView } from './components/views/AuditView';
import { DataView } from './components/views/DataView';
import { SettingsView } from './components/views/SettingsView';
import { AuthModal } from './components/views/AuthModal';
import { QuickActionModal } from './components/views/QuickActionModal';
import { api } from './api/client';
import { storageSync } from './services/storageSync';

const SECTION_METADATA: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Studio Overview & Production Metrics',
    subtitle: 'Real-time studio workload, roadmap completion, and critical blockers'
  },
  tasks: {
    title: 'Task Management & Kanban Board',
    subtitle: 'Track sprint deliverables, visual scripting graphs, models, and audio'
  },
  chapters: {
    title: 'Chapters & Production Roadmap',
    subtitle: 'Days 1–100 progression for Chapter 1 Opening vertical slice'
  },
  team: {
    title: 'Lost Paint Studios Team Roster',
    subtitle: '13 core members across India, Lebanon, Nigeria, USA, HK, and Malaysia'
  },
  calendar: {
    title: 'Production Calendar & Time Blocks',
    subtitle: 'Playtests, sprint deadlines, team syncs, and milestone dates'
  },
  devlogs: {
    title: 'Daily Development Logs',
    subtitle: 'Standardized standup records: Done, In Progress, Blocked, and Next'
  },
  bugs: {
    title: 'Bug Tracker & QA Verification',
    subtitle: 'Gameplay anomalies, collision glitches, and platform performance'
  },
  documents: {
    title: 'Internal Documents & Knowledge Base',
    subtitle: 'Story canon, GDD systems, camera mechanics, and optimization rules'
  },
  marketing: {
    title: 'Marketing & Instagram Content Calendar',
    subtitle: 'Pre-launch social presence, teasers, reels, and devlog clips'
  },
  media: {
    title: 'Video, Trailer & Gameplay Production',
    subtitle: 'Gameplay recording captures, raw footage links, and trailer exports'
  },
  audit: {
    title: 'Studio Change Log & Audit History',
    subtitle: 'Verified operational history of changes, logins, and configurations'
  },
  data: {
    title: 'Excel & Notion Data Gateway',
    subtitle: 'Operational workbook (.xlsx) export/import and Notion sync pathway'
  },
  settings: {
    title: 'Settings, Roles & Database Backups',
    subtitle: 'Studio identity, user management, and SQLite snapshot downloads'
  }
};

const MainLayout: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [quickActionModalOpen, setQuickActionModalOpen] = useState(false);

  // Dynamic counts for sidebar badges
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [openBugsCount, setOpenBugsCount] = useState(0);

  const { setupNeeded, user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        setAuthModalOpen(true);
      } else if (setupNeeded) {
        setAuthModalOpen(true);
      } else if (!user) {
        setAuthModalOpen(true);
      } else {
        storageSync.checkAndAutoRestore().then((restored) => {
          if (restored) {
            loadBadgeCounts();
          }
        });
      }
    }
  }, [setupNeeded, user, loading]);

  useEffect(() => {
    loadBadgeCounts();
  }, [currentSection, user]);

  const loadBadgeCounts = async () => {
    try {
      const stats = await api.getDashboardStats();
      setOpenTasksCount(stats.taskCounts?.in_progress || 0);
      setOpenBugsCount(stats.bugStats?.open || 0);
    } catch (e) {
      // Ignore background badge error
    }
  };

  const handleQuickActionSelect = (section: string) => {
    setCurrentSection(section as NavSection);
  };

  const renderActiveView = () => {
    switch (currentSection) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={setCurrentSection}
            onOpenQuickAction={() => setQuickActionModalOpen(true)}
            onOpenAuthModal={() => setAuthModalOpen(true)}
          />
        );
      case 'tasks':
        return <TasksView />;
      case 'chapters':
        return <ChaptersView />;
      case 'team':
        return <TeamView />;
      case 'calendar':
        return <CalendarView />;
      case 'devlogs':
        return <DevlogsView />;
      case 'bugs':
        return <BugsView />;
      case 'documents':
        return <DocumentsView />;
      case 'marketing':
        return <MarketingView />;
      case 'media':
        return <MediaView />;
      case 'audit':
        return <AuditView />;
      case 'data':
        return <DataView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setCurrentSection} onOpenQuickAction={() => setQuickActionModalOpen(true)} />;
    }
  };

  const meta = SECTION_METADATA[currentSection] || SECTION_METADATA.dashboard;

  return (
    <div className="min-h-screen bg-studio-950 text-slate-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        openTasksCount={openTasksCount}
        unreadBugsCount={openBugsCount}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenQuickAction={() => setQuickActionModalOpen(true)}
          onOpenAuthModal={() => setAuthModalOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={setupNeeded ? 'setup' : 'login'}
      />

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={quickActionModalOpen}
        onClose={() => setQuickActionModalOpen(false)}
        onSelectAction={handleQuickActionSelect}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
