const BASE_URL = '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('lost_paint_token');
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include' // include cookies
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(errorData.error || `Request failed with status ${res.status}`, res.status);
  }

  // If response is a blob/file, caller handles separately
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res as unknown as T;
}

export const api = {
  // Auth
  checkSetupNeeded: () => request<{ setupNeeded: boolean }>('/auth/setup-needed'),
  setupAdmin: (data: any) => request<any>('/auth/setup-admin', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<any>('/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: any }>('/auth/me'),
  getUsers: () => request<{ users: any[] }>('/auth/users'),
  createInvite: (data: any) => request<any>('/auth/invite', { method: 'POST', body: JSON.stringify(data) }),
  getInvite: (token: string) => request<any>(`/auth/invite/${token}`),
  acceptInvite: (data: any) => request<any>('/auth/accept-invite', { method: 'POST', body: JSON.stringify(data) }),
  updateUserRole: (id: string, role: string) => request<any>(`/auth/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  toggleUserStatus: (id: string, is_active: boolean) => request<any>(`/auth/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),

  // Dashboard
  getDashboardStats: () => request<any>('/dashboard/stats'),

  // Tasks
  getTasks: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ tasks: any[] }>(`/tasks${query ? '?' + query : ''}`);
  },
  getTask: (id: string) => request<{ task: any }>(`/tasks/${id}`),
  createTask: (data: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) => request<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateTaskStatus: (id: string, status: string) => request<any>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteTask: (id: string) => request<any>(`/tasks/${id}`, { method: 'DELETE' }),
  addSubtask: (taskId: string, title: string) => request<any>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
  toggleSubtask: (taskId: string, subtaskId: string, is_completed: boolean) => request<any>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify({ is_completed }) }),
  deleteSubtask: (taskId: string, subtaskId: string) => request<any>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),
  addComment: (taskId: string, content: string) => request<any>(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Chapters & Roadmap
  getChapters: () => request<{ chapters: any[] }>('/chapters'),
  getChapter: (id: string) => request<{ chapter: any }>(`/chapters/${id}`),
  createChapter: (data: any) => request<any>('/chapters', { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: any) => request<any>(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChapter: (id: string) => request<any>(`/chapters/${id}`, { method: 'DELETE' }),
  addMilestone: (chapterId: string, data: any) => request<any>(`/chapters/${chapterId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (milestoneId: string, data: any) => request<any>(`/chapters/milestones/${milestoneId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMilestone: (milestoneId: string) => request<any>(`/chapters/milestones/${milestoneId}`, { method: 'DELETE' }),

  // Team
  getTeam: () => request<{ team: any[] }>('/team'),
  getMember: (id: string) => request<{ member: any }>(`/team/${id}`),
  createMember: (data: any) => request<any>('/team', { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (id: string, data: any) => request<any>(`/team/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  archiveMember: (id: string) => request<any>(`/team/${id}`, { method: 'DELETE' }),

  // Calendar
  getCalendar: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ events: any[] }>(`/calendar${query ? '?' + query : ''}`);
  },
  createEvent: (data: any) => request<any>('/calendar', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: string, data: any) => request<any>(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id: string) => request<any>(`/calendar/${id}`, { method: 'DELETE' }),

  // Devlogs
  getDevlogs: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ logs: any[] }>(`/devlogs${query ? '?' + query : ''}`);
  },
  createDevlog: (data: any) => request<any>('/devlogs', { method: 'POST', body: JSON.stringify(data) }),
  updateDevlog: (id: string, data: any) => request<any>(`/devlogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDevlog: (id: string) => request<any>(`/devlogs/${id}`, { method: 'DELETE' }),

  // Bugs
  getBugs: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ bugs: any[] }>(`/bugs${query ? '?' + query : ''}`);
  },
  getBug: (id: string) => request<{ bug: any }>(`/bugs/${id}`),
  createBug: (data: any) => request<any>('/bugs', { method: 'POST', body: JSON.stringify(data) }),
  updateBug: (id: string, data: any) => request<any>(`/bugs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateBugStatus: (id: string, status: string, notes?: string) => request<any>(`/bugs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, resolution_notes: notes }) }),
  deleteBug: (id: string) => request<any>(`/bugs/${id}`, { method: 'DELETE' }),
  addBugComment: (id: string, content: string) => request<any>(`/bugs/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Documents
  getDocuments: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ documents: any[] }>(`/documents${query ? '?' + query : ''}`);
  },
  getDocument: (id: string) => request<{ document: any }>(`/documents/${id}`),
  createDocument: (data: any) => request<any>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  updateDocument: (id: string, data: any) => request<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDocument: (id: string) => request<any>(`/documents/${id}`, { method: 'DELETE' }),

  // Marketing
  getMarketing: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ items: any[] }>(`/marketing${query ? '?' + query : ''}`);
  },
  createMarketing: (data: any) => request<any>('/marketing', { method: 'POST', body: JSON.stringify(data) }),
  updateMarketing: (id: string, data: any) => request<any>(`/marketing/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateMarketingStatus: (id: string, status: string, published_url?: string) => request<any>(`/marketing/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, published_url }) }),
  deleteMarketing: (id: string) => request<any>(`/marketing/${id}`, { method: 'DELETE' }),

  // Media
  getMedia: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ mediaItems: any[] }>(`/media${query ? '?' + query : ''}`);
  },
  createMedia: (data: any) => request<any>('/media', { method: 'POST', body: JSON.stringify(data) }),
  updateMedia: (id: string, data: any) => request<any>(`/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateMediaStatus: (id: string, status: string) => request<any>(`/media/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteMedia: (id: string) => request<any>(`/media/${id}`, { method: 'DELETE' }),

  // Audit Logs
  getAuditLogs: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ logs: any[] }>(`/audit${query ? '?' + query : ''}`);
  },

  // Settings
  getSettings: () => request<{ settings: any }>('/settings'),
  updateSettings: (data: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Backup
  downloadDbBackupUrl: '/api/backup/download',
  getBackupDownloadUrl: () => {
    const token = localStorage.getItem('lost_paint_token');
    return token ? `/api/backup/download?token=${encodeURIComponent(token)}` : '/api/backup/download';
  },
  createSnapshot: () => request<any>('/backup/snapshot', { method: 'POST' }),
  getStorageStatus: () => request<any>('/backup/status'),
  restoreDbBackup: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/backup/restore', { method: 'POST', body: formData });
  },

  // Excel
  exportWorkbookUrl: '/api/excel/export',
  exportTemplateUrl: '/api/excel/template',
  getExportWorkbookUrl: () => {
    const token = localStorage.getItem('lost_paint_token');
    return token ? `/api/excel/export?token=${encodeURIComponent(token)}` : '/api/excel/export';
  },
  getExportTemplateUrl: () => {
    const token = localStorage.getItem('lost_paint_token');
    return token ? `/api/excel/template?token=${encodeURIComponent(token)}` : '/api/excel/template';
  },
  previewExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/excel/preview', { method: 'POST', body: formData });
  },
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/excel/import', { method: 'POST', body: formData });
  },

  // Notion
  getNotionStatus: () => request<any>('/notion/status'),
  testNotionToken: (token: string) => request<any>('/notion/test-connection', { method: 'POST', body: JSON.stringify({ token }) }),
  importManualJson: (type: 'tasks' | 'documents', payload: any) => request<any>('/notion/manual-import', { method: 'POST', body: JSON.stringify({ type, payload }) })
};
