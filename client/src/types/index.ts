export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  team_member_id?: string | null;
  avatar_url?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  country: string;
  country_code: string;
  roles: string;
  skills: string;
  is_founder: number;
  can_record_gameplay: number;
  user_id?: string | null;
  status: 'active' | 'inactive' | 'on_leave';
  notes?: string | null;
  flag?: string;
  has_account?: boolean;
  account_email?: string | null;
  account_role?: UserRole | null;
  total_tasks?: number;
  open_tasks?: number;
  completed_tasks?: number;
  overdue_tasks?: number;
}

export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Blocked' | 'In Review' | 'Done' | 'Cancelled';
export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TaskCategory =
  | 'Visual Scripting'
  | 'Coding'
  | 'Level Design'
  | 'UI'
  | '3D Art'
  | 'Texturing'
  | 'Story'
  | 'Music'
  | 'QA'
  | 'Marketing'
  | 'Video'
  | 'Management'
  | 'Other';

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: number;
  order_index: number;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id?: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  creator_id?: string | null;
  creator_name?: string | null;
  chapter_id?: string | null;
  chapter_name?: string | null;
  milestone_id?: string | null;
  milestone_title?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimate_hours?: number | null;
  tags?: string | null;
  dependencies?: string | null;
  acceptance_criteria?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  assignees?: TeamMember[];
  subtasks?: Subtask[];
  comments?: TaskComment[];
}

export interface Milestone {
  id: string;
  chapter_id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface Chapter {
  id: string;
  order_index: number;
  name: string;
  day_range: string;
  summary: string;
  status: 'Planned' | 'In Progress' | 'Blocked' | 'Completed';
  owner_id?: string | null;
  owner_name?: string | null;
  target_start_date?: string | null;
  target_end_date?: string | null;
  risks?: string | null;
  notes?: string | null;
  acceptance_criteria?: string | null;
  total_tasks?: number;
  completed_tasks?: number;
  total_milestones?: number;
  completed_milestones?: number;
  progress_percent?: number;
  milestones?: Milestone[];
  tasks?: Task[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: 'Meeting' | 'Playtest' | 'Deadline' | 'Work Session' | 'Marketing' | 'Milestone';
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  participants?: string | null;
  related_chapter_id?: string | null;
  chapter_name?: string | null;
  related_task_id?: string | null;
  task_title?: string | null;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  notes?: string | null;
  creator_name?: string | null;
  created_at: string;
}

export interface DevelopmentLog {
  id: string;
  log_date: string;
  author_id?: string | null;
  author_name: string;
  done: string;
  in_progress: string;
  blocked: string;
  next_steps: string;
  notes: string;
  linked_chapter_id?: string | null;
  chapter_name?: string | null;
  linked_task_ids?: string | null;
  attachments?: string | null;
  created_at: string;
}

export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type BugStatus = 'New' | 'Confirmed' | 'In Progress' | 'Fixed' | 'Retest' | 'Closed' | 'Won’t Fix';

export interface BugComment {
  id: string;
  bug_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Bug {
  id: string;
  title: string;
  description: string;
  reproduction_steps?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  severity: BugSeverity;
  status: BugStatus;
  reporter_id?: string | null;
  reporter_name: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  assignee_country?: string | null;
  date_found: string;
  related_chapter_id?: string | null;
  chapter_name?: string | null;
  related_task_id?: string | null;
  task_title?: string | null;
  platform?: string | null;
  unity_build_version?: string | null;
  evidence_links?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  comments?: BugComment[];
}

export interface DocumentHistoryItem {
  id: string;
  version: number;
  content: string;
  changed_by: string;
  summary?: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  category: string;
  content: string;
  author_name: string;
  tags?: string | null;
  chapter_id?: string | null;
  chapter_name?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  history?: DocumentHistoryItem[];
}

export interface MarketingItem {
  id: string;
  title: string;
  platform: string;
  format: string;
  caption?: string | null;
  media_url?: string | null;
  planned_publish_date?: string | null;
  status: 'Idea' | 'Draft' | 'Ready for Review' | 'Approved' | 'Scheduled' | 'Published' | 'Archived';
  owner_id?: string | null;
  owner_name?: string | null;
  owner_country?: string | null;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  tags?: string | null;
  related_chapter_id?: string | null;
  chapter_name?: string | null;
  published_url?: string | null;
  performance_notes?: string | null;
  created_at: string;
}

export interface MediaProductionItem {
  id: string;
  title: string;
  media_type: string;
  objective?: string | null;
  status: 'Planned' | 'Recording' | 'Editing' | 'Review' | 'Approved' | 'Exported' | 'Published';
  related_chapter_id?: string | null;
  chapter_name?: string | null;
  planned_recording_date?: string | null;
  raw_footage_url?: string | null;
  final_export_url?: string | null;
  aspect_ratio: string;
  deadline?: string | null;
  publication_url?: string | null;
  notes?: string | null;
  checklist?: string | null;
  created_at: string;
  assignees?: { team_member_id: string; name: string; country_code: string; assignment_role: string }[];
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: string | null;
  is_security_event: number;
  created_at: string;
}

export interface StudioSettings {
  id: string;
  studio_name: string;
  game_title: string;
  game_status: string;
  engine: string;
  platform_targets: string;
  default_timezone: string;
  notion_token?: string | null;
  notion_page_id?: string | null;
  last_backup_at?: string | null;
  updated_at: string;
}

export interface DashboardStats {
  taskCounts: {
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    overdue: number;
    due_soon: number;
  };
  chapterProgress: Chapter[];
  teamWorkload: any[];
  bugStats: {
    total: number;
    open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentActivity: AuditLog[];
  recentDevLogs: DevelopmentLog[];
  upcomingEvents: CalendarEvent[];
  marketingStats: {
    total_items: number;
    published_items: number;
    in_production: number;
    scheduled_items: number;
  };
  blockedTasks: Task[];
  settings: StudioSettings;
}
