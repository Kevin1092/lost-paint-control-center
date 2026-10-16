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
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setMode('invite');
      setInviteToken(token);
      api.getInvite(token)
        .then((res: any) => {
          if (res?.invite?.member_name) {
            setDisplayName(res.invite.member_name);
          }
        })
        .catch(() => {});
      return;
    }

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

        {mode === 'login' && (
          <div className="p-3 bg-studio-850/80 rounded-xl border border-studio-750 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-slate-200 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                Prebuilt Studio Accounts
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-studio-900 border border-studio-700 px-2 py-0.5 rounded">
                Password: <strong className="text-rose-400 font-bold">lostpaint123</strong>
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Click any profile below to auto-fill credentials:
            </p>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setEmail('kevin@lostpaintstudios.com');
                  setPassword('lostpaint123');
                }}
                className="p-2 bg-studio-900 hover:bg-studio-800 border border-studio-750 rounded-xl text-left transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-rose-300 text-[11px] group-hover:text-rose-200">BuildwithKevin</span>
                  <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800/80 px-1.5 py-0.2 rounded font-mono">Admin</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block truncate">kevin@lostpaintstudios.com</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('aquamilet@lostpaintstudios.com');
                  setPassword('lostpaint123');
                }}
                className="p-2 bg-studio-900 hover:bg-studio-800 border border-studio-750 rounded-xl text-left transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-rose-300 text-[11px] group-hover:text-rose-200">AquaMiletYT</span>
                  <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800/80 px-1.5 py-0.2 rounded font-mono">Admin</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block truncate">aquamilet@lostpaintstudios.com</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('survivor@lostpaintstudios.com');
                  setPassword('lostpaint123');
                }}
                className="p-2 bg-studio-900 hover:bg-studio-800 border border-studio-750 rounded-xl text-left transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-sky-300 text-[11px] group-hover:text-sky-200">Survivor</span>
                  <span className="text-[9px] bg-sky-950/80 text-sky-300 border border-sky-800/80 px-1.5 py-0.2 rounded font-mono">Editor</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block truncate">survivor@lostpaintstudios.com</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('steve@lostpaintstudios.com');
                  setPassword('lostpaint123');
                }}
                className="p-2 bg-studio-900 hover:bg-studio-800 border border-studio-750 rounded-xl text-left transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-sky-300 text-[11px] group-hover:text-sky-200">Steve</span>
                  <span className="text-[9px] bg-sky-950/80 text-sky-300 border border-sky-800/80 px-1.5 py-0.2 rounded font-mono">Editor</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block truncate">steve@lostpaintstudios.com</span>
              </button>
            </div>
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
