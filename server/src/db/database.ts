import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { cloudSync } from '../services/cloudSync';

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export function getDatabasePath(): string {
  if (isTest) {
    return process.env.TEST_DATABASE_PATH || path.resolve(__dirname, '../../data/lost_paint_test.db');
  }
  if (process.env.DATABASE_PATH) {
    return path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.resolve(process.cwd(), process.env.DATABASE_PATH);
  }
  // Auto-detect Render Persistent Disk mounts
  if (fs.existsSync('/data')) {
    return '/data/lost_paint.db';
  }
  if (fs.existsSync('/var/data')) {
    return '/var/data/lost_paint.db';
  }
  return path.resolve(__dirname, '../../data/lost_paint.db');
}

export const DB_PATH = getDatabasePath();
cloudSync.setDbPathGetter(getDatabasePath);

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Pre-populate persistent disk from base template if disk was freshly mounted
const seedTemplatePath = path.resolve(__dirname, '../../data/lost_paint.db');
if (!fs.existsSync(DB_PATH) && fs.existsSync(seedTemplatePath) && path.resolve(DB_PATH) !== path.resolve(seedTemplatePath)) {
  try {
    fs.copyFileSync(seedTemplatePath, DB_PATH);
    console.log(`[Database] Initialized persistent disk storage at ${DB_PATH} from template.`);
  } catch (err: any) {
    console.warn(`[Database] Notice: Could not pre-populate persistent disk: ${err.message}`);
  }
}

let currentDb = new Database(DB_PATH);

// Safely configure SQLite pragmas (Use DELETE mode instead of WAL for cloud container/Render compatibility)
try {
  currentDb.pragma('journal_mode = DELETE');
} catch (e) {
  console.warn('[Database] Could not set journal_mode:', e);
}

try {
  currentDb.pragma('foreign_keys = ON');
} catch (e) {
  console.warn('[Database] Could not set foreign_keys:', e);
}

export function reloadDatabaseConnection() {
  try {
    currentDb.close();
  } catch {}
  currentDb = new Database(DB_PATH);
  try {
    currentDb.pragma('journal_mode = DELETE');
  } catch (e) {
    console.warn('[Database] Could not set journal_mode:', e);
  }
  try {
    currentDb.pragma('foreign_keys = ON');
  } catch (e) {
    console.warn('[Database] Could not set foreign_keys:', e);
  }
}

export const db: Database.Database = new Proxy({} as any, {
  get(_target, prop) {
    const val = (currentDb as any)[prop];
    if (typeof val === 'function') {
      return val.bind(currentDb);
    }
    return val;
  }
});

export function initDatabase() {
  db.exec(`
    -- Studio Settings
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'studio',
      studio_name TEXT NOT NULL DEFAULT 'Lost Paint Studios',
      game_title TEXT NOT NULL DEFAULT 'Untitled Psychological Horror Game',
      game_status TEXT NOT NULL DEFAULT 'Early Pre-Production',
      engine TEXT NOT NULL DEFAULT 'Unity URP',
      platform_targets TEXT NOT NULL DEFAULT 'Steam / PC, Google Play / Android',
      default_timezone TEXT NOT NULL DEFAULT 'UTC',
      notion_token TEXT,
      notion_page_id TEXT,
      last_backup_at TEXT,
      is_seeded INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- Team Members (Profiles separated from auth accounts)
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      country_code TEXT NOT NULL,
      roles TEXT NOT NULL,
      skills TEXT,
      is_founder INTEGER DEFAULT 0,
      can_record_gameplay INTEGER DEFAULT 0,
      user_id TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- User accounts
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      team_member_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Invites
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      team_member_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      created_by TEXT REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    -- Chapters / Roadmap Blocks
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      order_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      day_range TEXT NOT NULL,
      summary TEXT,
      status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned', 'In Progress', 'Blocked', 'Completed')),
      owner_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      target_start_date TEXT,
      target_end_date TEXT,
      risks TEXT,
      notes TEXT,
      acceptance_criteria TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Milestones
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'To Do' CHECK(status IN ('Backlog', 'To Do', 'In Progress', 'Blocked', 'In Review', 'Done', 'Cancelled')),
      priority TEXT NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'Urgent')),
      category TEXT NOT NULL,
      creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
      start_date TEXT,
      due_date TEXT,
      estimate_hours REAL,
      tags TEXT,
      dependencies TEXT,
      acceptance_criteria TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Task Assignees (Many-to-Many)
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, team_member_id)
    );

    -- Subtasks / Checklist
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Task Comments
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Calendar / Time Blocks
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER,
      participants TEXT,
      related_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      related_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled' CHECK(status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
      creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Development Logs
    CREATE TABLE IF NOT EXISTS development_logs (
      id TEXT PRIMARY KEY,
      log_date TEXT NOT NULL,
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      done TEXT,
      in_progress TEXT,
      blocked TEXT,
      next_steps TEXT,
      notes TEXT,
      linked_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      linked_task_ids TEXT,
      attachments TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Bugs & Glitches
    CREATE TABLE IF NOT EXISTS bugs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reproduction_steps TEXT,
      expected_result TEXT,
      actual_result TEXT,
      severity TEXT NOT NULL DEFAULT 'Medium' CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
      status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New', 'Confirmed', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Won’t Fix')),
      reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reporter_name TEXT NOT NULL,
      assignee_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      date_found TEXT NOT NULL,
      related_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      related_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      platform TEXT,
      unity_build_version TEXT,
      evidence_links TEXT,
      resolution_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Bug Comments
    CREATE TABLE IF NOT EXISTS bug_comments (
      id TEXT PRIMARY KEY,
      bug_id TEXT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Documents & Knowledge Base
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT NOT NULL,
      tags TEXT,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Document History
    CREATE TABLE IF NOT EXISTS document_history (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL
    );

    -- Marketing & Social Media Items
    CREATE TABLE IF NOT EXISTS marketing_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'Instagram',
      format TEXT NOT NULL DEFAULT 'Post',
      caption TEXT,
      media_url TEXT,
      planned_publish_date TEXT,
      status TEXT NOT NULL DEFAULT 'Idea' CHECK(status IN ('Idea', 'Draft', 'Ready for Review', 'Approved', 'Scheduled', 'Published', 'Archived')),
      owner_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      reviewer_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      tags TEXT,
      related_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      published_url TEXT,
      performance_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Media Production Items (Trailers, Gameplay Recordings, Shorts, Edits)
    CREATE TABLE IF NOT EXISTS media_production_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      media_type TEXT NOT NULL,
      objective TEXT,
      status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned', 'Recording', 'Editing', 'Review', 'Approved', 'Exported', 'Published')),
      related_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      planned_recording_date TEXT,
      raw_footage_url TEXT,
      final_export_url TEXT,
      aspect_ratio TEXT NOT NULL DEFAULT '16:9',
      deadline TEXT,
      publication_url TEXT,
      notes TEXT,
      checklist TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Media Production Assignees (e.g. Steve, AuraKkboo, Tobyosnow, Survivor)
    CREATE TABLE IF NOT EXISTS media_production_assignees (
      item_id TEXT NOT NULL REFERENCES media_production_items(id) ON DELETE CASCADE,
      team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      assignment_role TEXT NOT NULL DEFAULT 'recorder',
      PRIMARY KEY (item_id, team_member_id, assignment_role)
    );

    -- Audit Logs (User Actions & Security Events)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      is_security_event INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Import History
    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      records_count INTEGER NOT NULL DEFAULT 0,
      details TEXT,
      performed_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Indexes for high-performance lookups
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_chapter ON tasks(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_task_assignees_member ON task_assignees(team_member_id);
    CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
    CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
    CREATE INDEX IF NOT EXISTS idx_devlogs_date ON development_logs(log_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
    CREATE INDEX IF NOT EXISTS idx_marketing_date ON marketing_items(planned_publish_date);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  // Ensure is_seeded column exists for existing databases
  try {
    db.exec('ALTER TABLE settings ADD COLUMN is_seeded INTEGER DEFAULT 0');
  } catch {}

  // Seed default settings and initial data if not present
  seedInitialData();
}

export function seedInitialData() {
  const now = new Date().toISOString();

  // Settings & Permanent Seeding Guard
  const settingsRow = db.prepare('SELECT id, is_seeded FROM settings WHERE id = ?').get('studio') as any;
  if (settingsRow && settingsRow.is_seeded === 1) {
    // Database has already been seeded! NEVER overwrite or re-seed user data (e.g. deleted chapters, custom tasks, etc.)
    return;
  }

  if (!settingsRow) {
    db.prepare(`
      INSERT INTO settings (id, studio_name, game_title, game_status, engine, platform_targets, default_timezone, is_seeded, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      'studio',
      'Lost Paint Studios',
      'Untitled Psychological Horror Game',
      'Early Pre-Production',
      'Unity URP',
      'Steam / PC, Google Play / Android',
      'UTC',
      now
    );
  }

  // 13 Team Members
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM team_members').get() as { count: number };
  if (memberCount.count === 0) {
    const seedMembers = [
      {
        id: 'member-1',
        name: 'BuildwithKevin',
        country: 'India',
        country_code: 'IN',
        roles: 'Basic UI Designing, Level Design, Visual Scripting, Main Founder',
        skills: 'Level Design, UI Design, Visual Scripting, Founder Direction',
        is_founder: 1,
        can_record_gameplay: 0,
        notes: 'Main Founder; oversees core level layouts and visual scripting logic.'
      },
      {
        id: 'member-2',
        name: 'AquaMiletYT',
        country: 'India',
        country_code: 'IN',
        roles: 'Story Writing, Design Support, Main Founder, Management',
        skills: 'Story Writing, Narrative Design, Studio Management, Game Direction',
        is_founder: 1,
        can_record_gameplay: 0,
        notes: 'Main Founder & Management; narrative lead behind James Walker & Miller family storyline.'
      },
      {
        id: 'member-3',
        name: 'Hsein',
        country: 'Lebanon',
        country_code: 'LB',
        roles: 'Main Designing, Substitute Visual Scripter',
        skills: 'Game Design, Environmental Layouts, Visual Scripting',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'Main Designer and substitute visual scripter for puzzle logic.'
      },
      {
        id: 'member-4',
        name: 'AuraKkboo',
        country: 'Nigeria',
        country_code: 'NG',
        roles: 'Main Visual Scripter',
        skills: 'Visual Scripting, Event Systems, State Machines, Gameplay Recording',
        is_founder: 0,
        can_record_gameplay: 1,
        notes: 'Primary visual scripting lead; also approved for gameplay recording captures.'
      },
      {
        id: 'member-5',
        name: 'Tobyosnow',
        country: 'Nigeria',
        country_code: 'NG',
        roles: 'Assistant Designer, Story Ideas',
        skills: 'Level Assistance, Lore Collaboration, Gameplay Recording',
        is_founder: 0,
        can_record_gameplay: 1,
        notes: 'Assists design and story pacing; approved for gameplay footage capture.'
      },
      {
        id: 'member-6',
        name: 'Survivor',
        country: 'India',
        country_code: 'IN',
        roles: 'Bug/Glitch Finding, Game Testing, Marketing, Trailer Creation, Social Media Management',
        skills: 'QA Testing, Graphics Issue Detection, Video Editing, Instagram Management, Marketing Lead',
        is_founder: 0,
        can_record_gameplay: 1,
        notes: 'Marketing & Industry Head; handles Instagram, video editing, trailer cuts, and graphics bug detection.'
      },
      {
        id: 'member-7',
        name: 'Steve',
        country: 'USA',
        country_code: 'US',
        roles: 'Coding Support, Editing, Trailer Creation, Gameplay Recording, Shorts/Instagram content',
        skills: 'C# Coding, Video Editing, Shorts Production, Gameplay Capture',
        is_founder: 0,
        can_record_gameplay: 1,
        notes: 'Coding support, trailer creation, shorts production, and gameplay capture lead.'
      },
      {
        id: 'member-8',
        name: 'Mach Studios',
        country: 'Hong Kong',
        country_code: 'HK',
        roles: '3D Modelling, Design, Texturing',
        skills: '3D Modelling, Texturing, Environmental Props, Low-Poly / Mobile Optimization',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'Environment assets, Miller farmhouse props, furniture, and texturing.'
      },
      {
        id: 'member-9',
        name: 'Raffie0_0',
        country: 'Malaysia',
        country_code: 'MY',
        roles: 'Music Artist',
        skills: 'Atmospheric Soundtrack, Ambient Horror Soundscapes, Tension Audio',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'Composes atmospheric horror OST and suspense audio themes.'
      },
      {
        id: 'member-10',
        name: 'S4mmy',
        country: 'India',
        country_code: 'IN',
        roles: 'Coding Assistance, Music Artist, Creative Assistant',
        skills: 'C# Scripting, Sound Design, Audio Stems, Creative Ideas',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'Multi-disciplinary contributor supporting coding and audio.'
      },
      {
        id: 'member-11',
        name: 'Kite',
        country: 'India',
        country_code: 'IN',
        roles: 'Coder',
        skills: 'C# Gameplay Programming, Physics, Camera Systems, Sanity Mechanics',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'Core gameplay programmer working on photo mode and sanity restores.'
      },
      {
        id: 'member-12',
        name: 'Raphaelle',
        country: 'India',
        country_code: 'IN',
        roles: 'Designer',
        skills: 'Game Mechanics, Puzzle Design, Storyboard Drafts',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'Puzzle pacing and clue investigation design.'
      },
      {
        id: 'member-13',
        name: 'Rosie',
        country: 'India',
        country_code: 'IN',
        roles: 'Basic Menu Designer',
        skills: 'Menu Layouts, Settings UI, Inventory HUD Mockups',
        is_founder: 0,
        can_record_gameplay: 0,
        notes: 'In-game UI screens, main menu, pause menu, and inventory layout.'
      }
    ];

    const insertMember = db.prepare(`
      INSERT INTO team_members (id, name, country, country_code, roles, skills, is_founder, can_record_gameplay, status, notes, created_at, updated_at)
      VALUES (@id, @name, @country, @country_code, @roles, @skills, @is_founder, @can_record_gameplay, 'active', @notes, '${now}', '${now}')
    `);

    const insertMany = db.transaction((members) => {
      for (const m of members) insertMember.run(m);
    });
    insertMany(seedMembers);
  }

  // 5 Production Chapters / Roadmap Blocks (Seed as Planned Roadmap Blocks)
  const chapterCount = db.prepare('SELECT COUNT(*) as count FROM chapters').get() as { count: number };
  if (chapterCount.count === 0) {
    const seedChapters = [
      {
        id: 'chapter-1',
        order_index: 1,
        name: 'Chapter 1 / Opening',
        day_range: 'Days 1–20',
        summary: 'Build the opening area; James visits the Miller house; introduce Lily and Noah; create the cupboard scene; add basic dialogue/cutscene; finish Chapter 1 ending.',
        status: 'In Progress',
        owner_id: 'member-1',
        risks: 'Lighting performance on low-end Android; cutscene pacing.',
        notes: 'First priority: playable, coherent Chapter 1 opening / vertical slice.',
        acceptance_criteria: 'James enters driveway, approaches Miller house, interacts with cupboard, triggers cutscene, completes Chapter 1 transition.'
      },
      {
        id: 'chapter-2',
        order_index: 2,
        name: 'Chapter 2: Farmhouse',
        day_range: 'Days 21–40',
        summary: 'Build the abandoned farmhouse; James enters and explores; add old photos, notes, and markings; add Daniel’s investigation clues; create exploration gameplay.',
        status: 'Planned',
        owner_id: 'member-3',
        risks: 'Atmospheric audio balance; texture memory budgeting.',
        notes: 'Atmospheric exploration, environmental storytelling, inventory pickup implementation.',
        acceptance_criteria: 'Player can navigate ground floor, inspect 5 key environmental clues, pick up flashlight and camera.'
      },
      {
        id: 'chapter-3',
        order_index: 3,
        name: 'Farmhouse Mystery',
        day_range: 'Days 41–60',
        summary: 'Deepen the mystery, connect clues, and expand environmental storytelling.',
        status: 'Planned',
        owner_id: 'member-2',
        risks: 'Clue puzzle clarity; avoiding player disorientation.',
        notes: 'Sanity hallucination triggers and audio cues introduce supernatural tension.',
        acceptance_criteria: 'Connected puzzle logic allowing player to unlock upstairs hallway using Daniel’s symbols.'
      },
      {
        id: 'chapter-4',
        order_index: 4,
        name: 'Daniel’s Story',
        day_range: 'Days 61–80',
        summary: 'Develop Daniel’s investigation, documents, journal, and disappearance-related discoveries.',
        status: 'Planned',
        owner_id: 'member-2',
        risks: 'Ensuring readable font sizes on mobile devices for journals and documents.',
        notes: 'Reveals the Miller family backstory and Douglas Walter connection.',
        acceptance_criteria: '3 readable journal entries with inspect view, audio log playback, and strange object revelation.'
      },
      {
        id: 'chapter-5',
        order_index: 5,
        name: 'Chapter 2 Finale / Integration / Playtest',
        day_range: 'Days 81–100',
        summary: 'Complete the planned chapter finale, integrate systems, fix bugs, and conduct playtests.',
        status: 'Planned',
        owner_id: 'member-6',
        risks: 'Bug volume during multi-system integration; frame drops during basement sequence.',
        notes: 'Vertical slice integration and playtesting across target PC & Android devices.',
        acceptance_criteria: 'Zero crash bugs during complete 45-minute playthrough; stable 30fps+ on low-end Android test devices.'
      }
    ];

    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, order_index, name, day_range, summary, status, owner_id, risks, notes, acceptance_criteria, created_at, updated_at)
      VALUES (@id, @order_index, @name, @day_range, @summary, @status, @owner_id, @risks, @notes, @acceptance_criteria, '${now}', '${now}')
    `);

    const insertChaptersTx = db.transaction((chapters) => {
      for (const c of chapters) insertChapter.run(c);
    });
    insertChaptersTx(seedChapters);

    // Initial Milestones for Chapter 1
    const seedMilestones = [
      { id: 'ms-1', chapter_id: 'chapter-1', title: 'Opening House Exterior Blockout', status: 'Completed', target_date: null },
      { id: 'ms-2', chapter_id: 'chapter-1', title: 'Cupboard Scene Visual Scripting', status: 'In Progress', target_date: null },
      { id: 'ms-3', chapter_id: 'chapter-1', title: 'Lily and Noah Intro Dialogue Trigger', status: 'Pending', target_date: null },
      { id: 'ms-4', chapter_id: 'chapter-1', title: 'Vertical Slice Playable Build', status: 'Pending', target_date: null }
    ];

    const insertMilestone = db.prepare(`
      INSERT INTO milestones (id, chapter_id, title, status, target_date, created_at, updated_at)
      VALUES (@id, @chapter_id, @title, @status, @target_date, '${now}', '${now}')
    `);
    for (const ms of seedMilestones) {
      insertMilestone.run(ms);
    }
  }

  // Seed Initial Tasks
  const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  if (taskCount.count === 0) {
    const initialTasks = [
      {
        id: 'task-101',
        title: 'Block out Miller House exterior & approach road',
        description: 'Create low-poly layout in Unity URP for James Walkers approach sequence. Ensure lighting works well on low-end specs.',
        status: 'Done',
        priority: 'High',
        category: 'Level Design',
        chapter_id: 'chapter-1',
        milestone_id: 'ms-1',
        estimate_hours: 12,
        tags: 'URP, LevelDesign, Chapter1',
        acceptance_criteria: 'Approach driveway navigable with collision mesh, exterior farmhouse shell visible in distance.',
        assignee_ids: ['member-1', 'member-3']
      },
      {
        id: 'task-102',
        title: 'Script cupboard interaction & hiding event',
        description: 'Implement visual scripting event where James inspects the living room cupboard. Camera zooms in, strange noise triggers.',
        status: 'In Progress',
        priority: 'Urgent',
        category: 'Visual Scripting',
        chapter_id: 'chapter-1',
        milestone_id: 'ms-2',
        estimate_hours: 8,
        tags: 'VisualScripting, Gameplay, Chapter1',
        acceptance_criteria: 'Interaction prompt appears within 2m radius; pressing interact triggers smooth door opening and audio cue.',
        assignee_ids: ['member-4', 'member-1']
      },
      {
        id: 'task-103',
        title: 'Implement Sanity / Hallucination core system',
        description: 'Create the sanity meter. Hallucinations increase visual vignette and audio distortion. Medicine pickups restore 35% sanity.',
        status: 'To Do',
        priority: 'High',
        category: 'Coding',
        chapter_id: 'chapter-1',
        estimate_hours: 16,
        tags: 'Mechanics, C#, Sanity',
        acceptance_criteria: 'Sanity decreases by 1pt/sec in dark areas; medicine item in inventory restores sanity; vignette shader smoothly adjusts.',
        assignee_ids: ['member-11', 'member-10']
      },
      {
        id: 'task-104',
        title: 'Design atmospheric ambient audio theme for Opening',
        description: 'Compose looping ambient drone with subtle wind whistling and floorboard creaks for the abandoned entrance hall.',
        status: 'In Progress',
        priority: 'Normal',
        category: 'Music',
        chapter_id: 'chapter-1',
        estimate_hours: 10,
        tags: 'Audio, OST, Ambience',
        acceptance_criteria: 'Seamless 3-minute stereo WAV loop; low memory footprint under 15MB.',
        assignee_ids: ['member-9']
      },
      {
        id: 'task-105',
        title: 'Capture 30-second teaser gameplay clip for Instagram Reel',
        description: 'Record James walking towards the Miller house in twilight. Cut to cupboard shaking scene with suspense audio.',
        status: 'To Do',
        priority: 'Normal',
        category: 'Video',
        chapter_id: 'chapter-1',
        estimate_hours: 6,
        tags: 'Marketing, Instagram, Video',
        acceptance_criteria: '9:16 vertical render at 1080x1920 60fps with studio logo outro.',
        assignee_ids: ['member-6', 'member-7']
      },
      {
        id: 'task-106',
        title: 'Model 3D vintage camera prop for James Walker',
        description: 'Detailed 35mm rangefinder camera model with lens reflection texture. Must include low-LOD variant for Android target.',
        status: 'To Do',
        priority: 'Normal',
        category: '3D Art',
        chapter_id: 'chapter-1',
        estimate_hours: 14,
        tags: '3D, Props, LOD',
        acceptance_criteria: 'High LOD < 3500 tris, Low LOD < 800 tris, 2K PBR texture set and 512px mobile set.',
        assignee_ids: ['member-8']
      }
    ];

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, category, chapter_id, milestone_id, estimate_hours, tags, acceptance_criteria, completed_at, created_at, updated_at)
      VALUES (@id, @title, @description, @status, @priority, @category, @chapter_id, @milestone_id, @estimate_hours, @tags, @acceptance_criteria, @completed_at, '${now}', '${now}')
    `);

    const insertAssignee = db.prepare(`
      INSERT INTO task_assignees (task_id, team_member_id) VALUES (?, ?)
    `);

    const insertSubtask = db.prepare(`
      INSERT INTO subtasks (id, task_id, title, is_completed, order_index, created_at)
      VALUES (?, ?, ?, ?, ?, '${now}')
    `);

    for (const t of initialTasks) {
      const completed_at = t.status === 'Done' ? now : null;
      insertTask.run({
        ...t,
        milestone_id: (t as any).milestone_id || null,
        completed_at
      });
      for (const memId of t.assignee_ids) {
        insertAssignee.run(t.id, memId);
      }
    }

    // Subtasks for task-102
    insertSubtask.run('sub-1', 'task-102', 'Create box collider trigger in front of cupboard', 1, 1);
    insertSubtask.run('sub-2', 'task-102', 'Hook up E/Action key visual script graph', 1, 2);
    insertSubtask.run('sub-3', 'task-102', 'Animate door creak open 45 degrees', 0, 3);
    insertSubtask.run('sub-4', 'task-102', 'Play audio cue sound_scare_creak_01.wav', 0, 4);
  }

  // Seed Knowledge Base Documents
  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
  if (docCount.count === 0) {
    const seedDocs = [
      {
        id: 'doc-1',
        title: 'Core Game Vision & Pillars',
        category: 'Game Design & Systems',
        author_name: 'AquaMiletYT',
        tags: 'Design, Vision, Horror',
        chapter_id: 'chapter-1',
        content: `# Untitled Psychological Horror Game — Game Design Document

**Studio:** Lost Paint Studios  
**Target Experience:** 3–5 hours single-player psychological horror & environmental mystery.  
**Platform Targets:** Steam / PC & Google Play / Android.  
**Engine:** Unity URP (Universal Render Pipeline).  

### Core Pillars
1. **Atmospheric Dread over Cheap Jumpscares:** Tension is generated through soundscapes, lighting shifts, and environmental cues.
2. **Investigation & Clue Connecting:** James Walker's camera and notebook are the primary tools to uncover the Miller family's fate.
3. **Fragile Sanity:** Supernatural phenomena disorient the player. Medicine restores clarity and sharpens vision.

### Core Loop
\`\`\`
Explore → Investigate clues → Solve environmental puzzles → Discover story → Survive supernatural encounters → Uncover deeper mystery
\`\`\`

### Key Mechanics
- **Photo Mode / Camera Lens:** Reveal hidden markings, UV traces, and altered reality unseen by the naked eye.
- **Inventory System:** Hold keys, notes, strange artifacts, flashlight batteries, and sanity medicine.
- **Sanity System:** Sanity decreases in darkness or near anomalies. Hallucinations alter room layouts and spawn auditory illusions.`
      },
      {
        id: 'doc-2',
        title: 'Narrative Canon & Character Backgrounds',
        category: 'Story & Canon',
        author_name: 'AquaMiletYT',
        tags: 'Narrative, JamesWalker, MillerFamily',
        chapter_id: 'chapter-2',
        content: `# Narrative Canon — Lost Paint Studios

### Characters
- **James Walker:** A 32-year-old freelance investigative photographer drawn to the remote Miller homestead after receiving anonymous undeveloped negatives in his studio mailbox.
- **Daniel Miller:** The head of the Miller household. His journals describe strange vibrations beneath the ground and a growing obsession with an unearthed obsidian object.
- **Lily & Noah Miller:** The children whose presence is felt through drawings, toys left mid-play, and audio remnants in the cupboard.
- **Douglas Walter:** An associate referenced in Daniel's private correspondence. His role in funding the excavation remains ambiguous.

### Story Progression
- **Opening:** James arrives in late dusk. The silence is unnatural.
- **Farmhouse:** Uncovers the timeline of the disappearance through dated notes and personal items.
- **The Descent:** The basement reveals an excavation site that should not physically fit under the house.`
      },
      {
        id: 'doc-3',
        title: 'Technical Guidelines — Low-End PC & Android Optimization',
        category: 'Technical Notes',
        author_name: 'BuildwithKevin',
        tags: 'Unity, URP, Mobile, Performance',
        content: `# Technical & Optimization Guidelines

### Performance Targets
- **PC:** Solid 60 FPS at 1080p on GTX 1050 / Intel Iris Xe.
- **Android:** Target 30 FPS minimum on Snapdragon 680 / 4GB RAM devices.

### URP Rendering Rules
1. **Draw Calls:** Keep under 250 draw calls per frame on mobile scenes.
2. **Texture Compression:** Use ASTC 6x6 for Android textures, BC7 for PC builds.
3. **Baked Lighting:** All static environment lighting in the Miller house must be baked. Limit real-time lights to James's flashlight and momentary supernatural flickers.
4. **Shader Complexity:** Avoid heavy multi-pass shaders. Use mobile-friendly custom shaders for sanity distortion.`
      }
    ];

    const insertDoc = db.prepare(`
      INSERT INTO documents (id, title, category, content, author_name, tags, chapter_id, version, created_at, updated_at)
      VALUES (@id, @title, @category, @content, @author_name, @tags, @chapter_id, 1, '${now}', '${now}')
    `);
    for (const d of seedDocs) {
      insertDoc.run({
        ...d,
        chapter_id: (d as any).chapter_id || null
      });
    }
  }

  // Seed Initial QA Bug Report (Clearly labeled as sample / verified data)
  const bugCount = db.prepare('SELECT COUNT(*) as count FROM bugs').get() as { count: number };
  if (bugCount.count === 0) {
    db.prepare(`
      INSERT INTO bugs (
        id, title, description, reproduction_steps, expected_result, actual_result,
        severity, status, reporter_name, assignee_id, date_found, related_chapter_id,
        platform, unity_build_version, evidence_links, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'bug-1',
      'Flashlight beam clips through Miller kitchen door geometry',
      'When turning on the flashlight within 0.5m of the kitchen doorway, the spot light casts harsh shadow artifacts through closed door mesh.',
      '1. Approach closed kitchen door.\n2. Press F to toggle flashlight.\n3. Observe light penetrating wood panel.',
      'Light cone should be fully occluded by the door collider and shadow caster.',
      'Visible light bleeding on kitchen floor while door remains shut.',
      'Medium',
      'Confirmed',
      'Survivor',
      'member-1',
      '2026-10-15',
      'chapter-1',
      'Steam / PC',
      'v0.1.4-pre',
      'https://lostpaintstudios.internal/evidence/bug_kitchen_light.png',
      now,
      now
    );
  }

  // Seed Initial Marketing Item
  const marketingCount = db.prepare('SELECT COUNT(*) as count FROM marketing_items').get() as { count: number };
  if (marketingCount.count === 0) {
    db.prepare(`
      INSERT INTO marketing_items (
        id, title, platform, format, caption, planned_publish_date,
        status, owner_id, reviewer_id, tags, related_chapter_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'mkt-1',
      'Atmospheric Farmhouse Approach Teaser #1',
      'Instagram',
      'reel',
      'Something happened in the Miller house. James Walker is about to find out what. 🚪🕯️\n\n#indiegame #gamedev #psychologicalhorror #unityurp #lostpaintstudios',
      '2026-10-25',
      'Draft',
      'member-6',
      'member-2',
      'Instagram, Teaser, Pre-Production',
      'chapter-1',
      now,
      now
    );
  }

  // Seed Initial Media Production Item
  const mediaCount = db.prepare('SELECT COUNT(*) as count FROM media_production_items').get() as { count: number };
  if (mediaCount.count === 0) {
    db.prepare(`
      INSERT INTO media_production_items (
        id, title, media_type, objective, status, related_chapter_id,
        planned_recording_date, aspect_ratio, deadline, notes, checklist, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'media-1',
      'Chapter 1 Vertical Slice Walkthrough (Internal Demo)',
      'Gameplay Recording',
      'Capture 4K 60fps raw footage of the opening 15 minutes for team review, bug logging, and teaser clipping.',
      'Recording',
      'chapter-1',
      '2026-10-22',
      '16:9',
      '2026-10-24',
      'Assigned to Steve & Survivor. Focus on smooth camera motion and audio balance.',
      JSON.stringify([
        { id: '1', text: 'Set render scale to 1.0 (no FSR)', done: true },
        { id: '2', text: 'Record with lossless audio stems', done: false },
        { id: '3', text: 'Test flashlight flicker event trigger', done: false }
      ]),
      now,
      now
    );

    // Assign Steve and Survivor
    db.prepare(`INSERT INTO media_production_assignees (item_id, team_member_id, assignment_role) VALUES (?, ?, ?)`).run('media-1', 'member-7', 'recorder');
    db.prepare(`INSERT INTO media_production_assignees (item_id, team_member_id, assignment_role) VALUES (?, ?, ?)`).run('media-1', 'member-6', 'editor');
  }

  // Seed Initial Audit Log
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number };
  if (auditCount.count === 0) {
    db.prepare(`
      INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, is_security_event, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'audit-init',
      'System',
      'INITIALIZE',
      'SYSTEM',
      'database',
      'Initialized Lost Paint Studios database schema and seeded 13 team profiles, 5 roadmap blocks, and core production records.',
      0,
      now
    );
  }

  // Mark initial seeding permanently complete so future restarts NEVER overwrite user data
  db.prepare("UPDATE settings SET is_seeded = 1, updated_at = ? WHERE id = 'studio'").run(now);

  // Seed Prebuilt User Accounts (if not in test mode)
  if (!isTest) {
    seedPrebuiltUsers();
  }
}

export function seedPrebuiltUsers() {
  const now = new Date().toISOString();
  const defaultPasswordHash = bcrypt.hashSync('lostpaint123', 10);
  const prebuiltUsers = [
    {
      id: 'user-kevin',
      email: 'kevin@lostpaintstudios.com',
      display_name: 'BuildwithKevin',
      role: 'admin',
      team_member_id: 'member-1'
    },
    {
      id: 'user-aquamilet',
      email: 'aquamilet@lostpaintstudios.com',
      display_name: 'AquaMiletYT',
      role: 'admin',
      team_member_id: 'member-2'
    },
    {
      id: 'user-survivor',
      email: 'survivor@lostpaintstudios.com',
      display_name: 'Survivor',
      role: 'editor',
      team_member_id: 'member-6'
    },
    {
      id: 'user-steve',
      email: 'steve@lostpaintstudios.com',
      display_name: 'Steve',
      role: 'editor',
      team_member_id: 'member-7'
    },
    {
      id: 'user-viewer',
      email: 'viewer@lostpaintstudios.com',
      display_name: 'Studio Viewer',
      role: 'viewer',
      team_member_id: null
    }
  ];

  for (const u of prebuiltUsers) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as { id: string } | undefined;
    if (existing) {
      // Do not overwrite user password if account already exists
      if (u.team_member_id) {
        db.prepare('UPDATE team_members SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = "")').run(existing.id, u.team_member_id);
      }
    } else {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, role, team_member_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(u.id, u.email, defaultPasswordHash, u.display_name, u.role, u.team_member_id, now, now);
      if (u.team_member_id) {
        db.prepare('UPDATE team_members SET user_id = ? WHERE id = ?').run(u.id, u.team_member_id);
      }
    }
  }
}
