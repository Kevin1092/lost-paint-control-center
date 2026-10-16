import React, { useState } from 'react';
import {
  CheckSquare,
  BookOpen,
  Bug,
  FileText,
  Share2
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (section: string) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  const actions = [
    {
      id: 'tasks',
      title: 'Create Production Task',
      desc: 'Add a new feature, visual script, level blockout, or audio deliverable',
      icon: CheckSquare,
      color: 'text-rose-400'
    },
    {
      id: 'devlogs',
      title: 'Log Daily Development Update',
      desc: 'Submit daily Done, In Progress, Blockers, and Next Steps for the studio log',
      icon: BookOpen,
      color: 'text-sky-400'
    },
    {
      id: 'bugs',
      title: 'Report Bug / Glitch',
      desc: 'Log a gameplay glitch, visual artifact, or physics issue into the QA tracker',
      icon: Bug,
      color: 'text-amber-400'
    },
    {
      id: 'documents',
      title: 'Add Knowledge Base Document',
      desc: 'Draft game design, story canon, or technical guidelines in Markdown',
      icon: FileText,
      color: 'text-purple-400'
    },
    {
      id: 'marketing',
      title: 'Plan Marketing Content',
      desc: 'Schedule an Instagram reel, teaser clip, screenshot, or announcement',
      icon: Share2,
      color: 'text-emerald-400'
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Production Actions"
      subtitle="Select a workflow to quickly log progress or create records"
      maxWidth="md"
    >
      <div className="space-y-2.5">
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => {
                onSelectAction(action.id);
                onClose();
              }}
              className="w-full flex items-start gap-3.5 p-3.5 rounded-2xl bg-studio-850 hover:bg-studio-800 border border-studio-750 hover:border-studio-700 transition-all text-left group"
            >
              <div className="p-2.5 rounded-xl bg-studio-900 border border-studio-800 group-hover:scale-105 transition-transform">
                <Icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition-colors">
                  {action.title}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {action.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
