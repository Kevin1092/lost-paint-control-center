import React, { useState, useEffect } from 'react';
import {
  History,
  Shield,
  Search,
  Filter,
  User,
  Clock,
  Lock,
  ArrowRight
} from 'lucide-react';
import { AuditLog } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [securityOnly, setSecurityOnly] = useState(false);

  const { isAdmin } = useAuth();

  useEffect(() => {
    loadLogs();
  }, [search, actionFilter, securityOnly]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      if (securityOnly) params.security_only = 'true';

      const res = await api.getAuditLogs(params);
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && logs.length === 0) {
    return <LoadingSpinner label="Loading audit history & change log..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-studio-900 border border-studio-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Studio Activity</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Tamper-Evident Operational Audit Log</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            Studio Change Log & Security Audit History
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Tracks creation, modification, status changes, database backups, Excel imports, and authentication attempts. Passwords and credentials are never recorded.
          </p>
        </div>

        {isAdmin && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-studio-850 border border-studio-750 cursor-pointer text-xs shrink-0">
            <input
              type="checkbox"
              checked={securityOnly}
              onChange={e => setSecurityOnly(e.target.checked)}
              className="rounded bg-studio-800 border-studio-700 text-rose-600 focus:ring-0"
            />
            <Shield className="w-4 h-4 text-rose-400" />
            <span className="text-slate-200 font-semibold">Security & Auth Events Only</span>
          </label>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search change log..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="STATUS_CHANGE">STATUS_CHANGE</option>
          <option value="DELETE">DELETE</option>
          <option value="LOGIN">LOGIN</option>
          <option value="EXPORT">EXPORT</option>
          <option value="IMPORT">IMPORT</option>
          <option value="BACKUP">BACKUP</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="studio-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-studio-850/80 border-b border-studio-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-studio-800/80">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-studio-850/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {log.created_at ? log.created_at.replace('T', ' ').slice(0, 19) : ''}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.user_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        log.action === 'CREATE'
                          ? 'emerald'
                          : log.action === 'DELETE'
                          ? 'rose'
                          : log.action === 'LOGIN' || log.action === 'SETUP_ADMIN'
                          ? 'purple'
                          : log.action === 'EXPORT' || log.action === 'IMPORT'
                          ? 'sky'
                          : 'default'
                      }
                      size="sm"
                      className="font-mono text-[10px]"
                    >
                      {log.action}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    [{log.entity_type}]
                  </td>
                  <td className="py-3 px-4 text-slate-300 leading-relaxed max-w-lg">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
