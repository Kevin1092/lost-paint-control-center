export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
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
  created_at: string;
  updated_at: string;
  // Computed fields:
  task_count?: number;
  open_task_count?: number;
  completed_task_count?: number;
  overdue_task_count?: number;
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

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  creator_id?: string | null;
  chapter_id?: string | null;
  milestone_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimate_hours?: number | null;
  tags?: string | null;
  dependencies?: string | null;
  acceptance_criteria?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields:
  assignees?: TeamMember[];
  subtasks?: Subtask[];
  chapter_name?: string | null;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: number;
  order_index: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id?: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  order_index: number;
  name: string;
  day_range: string;
  summary: string;
  status: 'Planned' | 'In Progress' | 'Blocked' | 'Completed';
  owner_id?: string | null;
  target_start_date?: string | null;
  target_end_date?: string | null;
  risks?: string | null;
  notes?: string | null;
  acceptance_criteria?: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields:
  owner_name?: string | null;
  total_tasks?: number;
  completed_tasks?: number;
  progress_percent?: number;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  chapter_id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
  status: 'Pending' | 'In Progress' | 'Completed';
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: 'Meeting' | 'Playtest' | 'Deadline' | 'Work Session' | 'Marketing' | 'Milestone';
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  participants?: string | null; // JSON array of team_member_ids
  related_chapter_id?: string | null;
  related_task_id?: string | null;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  creator_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
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
  linked_task_ids?: string | null; // JSON array
  attachments?: string | null; // JSON array
  created_at: string;
  updated_at: string;
}

export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type BugStatus = 'New' | 'Confirmed' | 'In Progress' | 'Fixed' | 'Retest' | 'Closed' | 'Won’t Fix';

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
  date_found: string;
  related_chapter_id?: string | null;
  related_task_id?: string | null;
  platform?: string | null;
  unity_build_version?: string | null;
  evidence_links?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
}

export interface Document {
  id: string;
  title: string;
  category: string;
  content: string;
  author_name: string;
  tags?: string | null;
  chapter_id?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
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
  reviewer_id?: string | null;
  tags?: string | null;
  related_chapter_id?: string | null;
  published_url?: string | null;
  performance_notes?: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
}

export interface MediaProductionItem {
  id: string;
  title: string;
  media_type: string;
  objective?: string | null;
  status: 'Planned' | 'Recording' | 'Editing' | 'Review' | 'Approved' | 'Exported' | 'Published';
  related_chapter_id?: string | null;
  planned_recording_date?: string | null;
  raw_footage_url?: string | null;
  final_export_url?: string | null;
  aspect_ratio: string;
  deadline?: string | null;
  publication_url?: string | null;
  notes?: string | null;
  checklist?: string | null;
  created_at: string;
  updated_at: string;
  assignees?: { team_member_id: string; name: string; assignment_role: string }[];
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
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
