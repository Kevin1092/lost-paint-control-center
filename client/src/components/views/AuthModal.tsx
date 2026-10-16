import React, { useState, useEffect } from 'react';
import { Skull, KeyRound, ShieldAlert, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { api } from '../../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'setup' | 'invite';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login'
}) => {
  const { setupNeeded, login, setupAdmin, acceptInvite } = useAuth();
  const [mode, setMode] = useState<'login' | 'setup' | 'invite'>(setupNeeded ? 'setup' : initialMode);

  const [email, setEmail] = useState(setupNeeded ? 'kevin@lostpaintstudios.com' : '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(setupNeeded ? 'BuildwithKevin' : '');
  const [selectedFounder, setSelectedFounder] = useState('member-1');
  const [inviteToken, setInviteToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (setupNeeded) {
      setMode('setup');
      setEmail('kevin@lostpaintstudios.com');
      setDisplayName('BuildwithKevin');
    } else {
      setMode(initialMode);
    }
  }, [setupNeeded, initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'setup') {
        await setupAdmin({
          email,
          password,
          display_name: displayName || (selectedFounder === 'member-1' ? 'BuildwithKevin' : 'AquaMiletYT'),
          team_member_id: selectedFounder
        });
        onClose();
      } else if (mode === 'login') {
        await login({ email, password });
        onClose();
      } else if (mode === 'invite') {
        await acceptInvite({
          token: inviteToken,
          password,
          display_name: displayName
        });
        onClose();
      }
    } catch (err) {
      // Error handled by ToastContext in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'setup'
          ? 'Initialize Lost Paint Studios Owner Account'
          : mode === 'invite'
          ? 'Accept Studio Invitation'
          : 'Studio Control Center Login'
      }
      subtitle={
        mode === 'setup'
          ? 'Configure the first founder administrator account (BuildwithKevin or AquaMiletYT)'
          : mode === 'invite'
          ? 'Activate your studio member account using a secure invitation token'
          : 'Authenticate with your studio email and password'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {mode === 'setup' && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-4 h-4 text-amber-400" />
              First-Time System Initialization
            </span>
            <p className="text-[11px] leading-relaxed text-amber-300/80">
              No administrator accounts exist yet. Create your Owner/Admin login now to unlock full permissions.
            </p>

            <div className="pt-2">
              <label className="block text-slate-300 font-medium mb-1">Founder Profile to Link:</label>
              <select
                value={selectedFounder}
                onChange={e => {
                  setSelectedFounder(e.target.value);
                  setDisplayName(e.target.value === 'member-1' ? 'BuildwithKevin' : 'AquaMiletYT');
                  setEmail(e.target.value === 'member-1' ? 'kevin@lostpaintstudios.com' : 'aquamilet@lostpaintstudios.com');
                }}
                className="w-full px-2.5 py-1.5 bg-studio-900 border border-studio-700 rounded-lg text-slate-100 text-xs"
              >
                <option value="member-1">BuildwithKevin (Main Founder • UI, Level Design, Visual Scripting)</option>
                <option value="member-2">AquaMiletYT (Main Founder • Story Writing, Design Support, Management)</option>
              </select>
            </div>
          </div>
        )}

        {mode === 'invite' && (
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Invitation Token *</label>
            <input
              type="text"
              required
              value={inviteToken}
              onChange={e => setInviteToken(e.target.value)}
              placeholder="Paste 48-character invite token..."
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 font-mono"
            />
          </div>
        )}

        {(mode === 'setup' || mode === 'invite') && (
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Display Name *</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. BuildwithKevin"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100"
            />
          </div>
        )}

        {mode !== 'invite' && (
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="founder@lostpaintstudios.com"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100"
            />
          </div>
        )}

        <div>
          <label className="block text-slate-400 mb-1 font-medium">Password * (Min 8 characters)</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg transition-transform active:scale-95 text-xs"
        >
          {submitting
            ? 'Processing...'
            : mode === 'setup'
            ? 'Initialize Owner Account'
            : mode === 'invite'
            ? 'Activate Account'
            : 'Sign In to Control Center'}
        </button>

        {!setupNeeded && (
          <div className="flex justify-between items-center pt-2 text-[11px] text-slate-400">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => setMode('invite')}
                className="hover:text-rose-400 underline"
              >
                Have an invitation token?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="hover:text-rose-400 underline"
              >
                Back to Sign In
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
