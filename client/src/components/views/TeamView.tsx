import React, { useState, useEffect } from 'react';
import {
  Users,
  Video,
  ShieldCheck,
  Mail,
  Edit2,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Link,
  Copy,
  ExternalLink
} from 'lucide-react';
import { TeamMember } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const TeamView: React.FC = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');

  // Edit / Create Modal
  const [activeMember, setActiveMember] = useState<Partial<TeamMember> | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');
  const [selectedInviteMember, setSelectedInviteMember] = useState<TeamMember | null>(null);

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const res = await api.getTeam();
      setTeam(res.team);
    } catch (err) {
      console.error('Failed to load team', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (m: TeamMember) => {
    setActiveMember({ ...m });
    setIsEditing(true);
    setEditModalOpen(true);
  };

  const handleOpenCreate = () => {
    setActiveMember({
      name: '',
      country: 'India',
      country_code: 'IN',
      roles: '',
      skills: '',
      is_founder: 0,
      can_record_gameplay: 0,
      status: 'active',
      notes: ''
    });
    setIsEditing(false);
    setEditModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember?.name || !activeMember?.roles) {
      error('Name and roles are required.');
      return;
    }

    try {
      const payload = {
        name: activeMember.name,
        country: activeMember.country || 'India',
        country_code: (activeMember.country_code || 'IN').toUpperCase(),
        roles: activeMember.roles,
        skills: activeMember.skills || '',
        is_founder: activeMember.is_founder ? 1 : 0,
        can_record_gameplay: activeMember.can_record_gameplay ? 1 : 0,
        status: activeMember.status || 'active',
        notes: activeMember.notes || ''
      };

      if (isEditing && activeMember.id) {
        await api.updateMember(activeMember.id, payload);
        success('Team member profile updated.');
      } else {
        await api.createMember(payload);
        success('Team member profile created.');
      }

      setEditModalOpen(false);
      loadTeam();
    } catch (err: any) {
      error(err.message || 'Failed to save member.');
    }
  };

  const handleOpenInvite = (member: TeamMember) => {
    setSelectedInviteMember(member);
    setInviteEmail(member.account_email || `${member.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@lostpaintstudios.com`);
    setInviteRole(member.is_founder ? 'admin' : 'editor');
    setGeneratedInviteUrl('');
    setInviteModalOpen(true);
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createInvite({
        email: inviteEmail,
        role: inviteRole,
        team_member_id: selectedInviteMember?.id
      });
      const fullUrl = `${window.location.origin}${res.invite_url}`;
      setGeneratedInviteUrl(fullUrl);
      success('Single-use invitation token created.');
    } catch (err: any) {
      error(err.message || 'Failed to create invite token.');
    }
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(generatedInviteUrl);
    success('Invitation link copied to clipboard!');
  };

  const filteredTeam = filterRole
    ? team.filter(m => m.roles.toLowerCase().includes(filterRole.toLowerCase()) || m.skills.toLowerCase().includes(filterRole.toLowerCase()))
    : team;

  if (loading) return <LoadingSpinner label="Loading Lost Paint Studios team roster..." />;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-studio-900 border border-studio-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Studio Roster</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">13 Core Indie Team Members</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            Lost Paint Studios Team Management
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Team profiles are maintained separately from authentication accounts. Roles and skills can be adjusted by founders as production scales.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member Profile</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterRole('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
            filterRole === '' ? 'bg-rose-600 text-white' : 'bg-studio-900 text-slate-400 hover:text-slate-200 border border-studio-800'
          }`}
        >
          All Members ({team.length})
        </button>
        <button
          onClick={() => setFilterRole('Founder')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
            filterRole === 'Founder' ? 'bg-rose-600 text-white' : 'bg-studio-900 text-slate-400 hover:text-slate-200 border border-studio-800'
          }`}
        >
          Founders (2)
        </button>
        <button
          onClick={() => setFilterRole('Visual Scripting')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
            filterRole === 'Visual Scripting' ? 'bg-rose-600 text-white' : 'bg-studio-900 text-slate-400 hover:text-slate-200 border border-studio-800'
          }`}
        >
          Visual Scripting
        </button>
        <button
          onClick={() => setFilterRole('Design')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
            filterRole === 'Design' ? 'bg-rose-600 text-white' : 'bg-studio-900 text-slate-400 hover:text-slate-200 border border-studio-800'
          }`}
        >
          Game Design
        </button>
        <button
          onClick={() => setFilterRole('Gameplay Recording')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
            filterRole === 'Gameplay Recording' ? 'bg-rose-600 text-white' : 'bg-studio-900 text-slate-400 hover:text-slate-200 border border-studio-800'
          }`}
        >
          Gameplay Capture (4)
        </button>
        <button
          onClick={() => setFilterRole('Music')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
            filterRole === 'Music' ? 'bg-rose-600 text-white' : 'bg-studio-900 text-slate-400 hover:text-slate-200 border border-studio-800'
          }`}
        >
          Audio / Music
        </button>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTeam.map(member => (
          <div
            key={member.id}
            className="studio-card p-5 space-y-4 hover:border-studio-700 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Card Header: Avatar, Name, Flag, Badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-studio-800 to-studio-900 border border-studio-700 flex items-center justify-center text-base font-bold text-slate-200 shadow-md">
                    {member.flag}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                      {member.name}
                      {member.is_founder === 1 && (
                        <span title="Main Founder">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <span>{member.country}</span>
                      <span>•</span>
                      <span className="font-mono">{member.country_code}</span>
                    </span>
                  </div>
                </div>

                {member.is_founder === 1 ? (
                  <Badge variant="amber" size="sm">
                    Founder
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Core Team
                  </Badge>
                )}
              </div>

              {/* Roles & Responsibilities */}
              <div className="mt-4 p-3 bg-studio-850/60 rounded-xl border border-studio-800/80 text-xs">
                <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  Responsibilities
                </span>
                <p className="text-slate-200 font-medium leading-relaxed">
                  {member.roles}
                </p>
              </div>

              {/* Skills */}
              {member.skills && (
                <div className="mt-2.5 text-xs">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    Specializations & Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.split(',').map((skill, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-studio-850 text-slate-300 border border-studio-750 font-mono"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gameplay Recording Tag (if approved) */}
              {member.can_record_gameplay === 1 && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sky-400 bg-sky-950/30 border border-sky-900/50 px-2.5 py-1 rounded-lg">
                  <Video className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Approved Gameplay Recording Lead</span>
                </div>
              )}
            </div>

            {/* Workload and Actions Footer */}
            <div className="pt-4 border-t border-studio-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Task Workload:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-200 font-semibold">{member.open_tasks || 0} active</span>
                  <span>/</span>
                  <span className="text-emerald-400">{member.completed_tasks || 0} done</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {/* Account Status */}
                <div className="flex items-center gap-1.5 text-xs">
                  {member.has_account ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Account Active ({member.account_role})
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      Profile Only (No Login)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isAdmin && (
                    <button
                      onClick={() => handleOpenInvite(member)}
                      className="px-2.5 py-1 bg-studio-800 hover:bg-studio-750 text-slate-300 rounded-lg text-xs flex items-center gap-1"
                      title="Generate Invite Link"
                    >
                      <Mail className="w-3 h-3 text-rose-400" />
                      <span>Invite</span>
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleOpenEdit(member)}
                      className="p-1.5 bg-studio-850 hover:bg-studio-800 text-slate-300 rounded-lg text-xs"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT / CREATE MEMBER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={isEditing ? `Edit ${activeMember?.name}` : 'Add Team Member Profile'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMember} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Full Name / Alias *</label>
            <input
              type="text"
              required
              value={activeMember?.name || ''}
              onChange={e => setActiveMember({ ...activeMember, name: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Country *</label>
              <input
                type="text"
                required
                value={activeMember?.country || ''}
                onChange={e => setActiveMember({ ...activeMember, country: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Country Code (2 letters) *</label>
              <input
                type="text"
                required
                maxLength={2}
                value={activeMember?.country_code || ''}
                onChange={e => setActiveMember({ ...activeMember, country_code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Roles & Responsibilities *</label>
            <input
              type="text"
              required
              value={activeMember?.roles || ''}
              onChange={e => setActiveMember({ ...activeMember, roles: e.target.value })}
              placeholder="e.g. Visual Scripting, Level Design, Main Founder"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Skills (Comma-separated)</label>
            <input
              type="text"
              value={activeMember?.skills || ''}
              onChange={e => setActiveMember({ ...activeMember, skills: e.target.value })}
              placeholder="e.g. C# Scripting, URP Shaders, Lighting, Editing"
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-3 bg-studio-850 rounded-xl border border-studio-750 cursor-pointer">
              <input
                type="checkbox"
                checked={activeMember?.is_founder === 1}
                onChange={e => setActiveMember({ ...activeMember, is_founder: e.target.checked ? 1 : 0 })}
                className="rounded bg-studio-800 border-studio-700 text-rose-600 focus:ring-0"
              />
              <span className="text-slate-200 font-medium">Studio Founder</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-studio-850 rounded-xl border border-studio-750 cursor-pointer">
              <input
                type="checkbox"
                checked={activeMember?.can_record_gameplay === 1}
                onChange={e => setActiveMember({ ...activeMember, can_record_gameplay: e.target.checked ? 1 : 0 })}
                className="rounded bg-studio-800 border-studio-700 text-rose-600 focus:ring-0"
              />
              <span className="text-slate-200 font-medium">Gameplay Recording Lead</span>
            </label>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Notes</label>
            <textarea
              rows={2}
              value={activeMember?.notes || ''}
              onChange={e => setActiveMember({ ...activeMember, notes: e.target.value })}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-studio-800">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 bg-studio-800 text-slate-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
            >
              Save Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* INVITE LINK GENERATION MODAL */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title={`Invite ${selectedInviteMember?.name}`}
        subtitle="Generate a single-use onboarding link to create an authenticated login account"
        maxWidth="md"
      >
        <form onSubmit={handleGenerateInvite} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Invite Email *</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Account Role</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="editor">Editor (Create & update production records)</option>
              <option value="admin">Owner/Admin (Full studio configuration & backups)</option>
              <option value="viewer">Viewer (Read-only access)</option>
            </select>
          </div>

          {generatedInviteUrl ? (
            <div className="space-y-2 p-3 bg-studio-850 rounded-xl border border-studio-750">
              <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold block">
                Single-Use Invite Link Generated (Valid 7 Days)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInviteUrl}
                  className="flex-1 px-2.5 py-1.5 bg-studio-900 border border-studio-800 rounded-lg text-slate-300 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center gap-1 font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-lg"
            >
              Generate Invite Link
            </button>
          )}
        </form>
      </Modal>
    </div>
  );
};
