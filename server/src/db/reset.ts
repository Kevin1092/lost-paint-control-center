import 'dotenv/config';
import { db, initDatabase } from './database';

console.log('[Lost Paint Studios] Resetting database to clean initial state...');

// Checkpoint first
db.pragma('wal_checkpoint(TRUNCATE)');

// Drop tables in clean order
const tables = [
  'import_history',
  'audit_logs',
  'media_production_assignees',
  'media_production_items',
  'marketing_items',
  'document_history',
  'documents',
  'bug_comments',
  'bugs',
  'development_logs',
  'calendar_events',
  'task_comments',
  'subtasks',
  'task_assignees',
  'tasks',
  'milestones',
  'chapters',
  'invites',
  'users',
  'team_members',
  'settings'
];

db.transaction(() => {
  db.pragma('foreign_keys = OFF');
  for (const t of tables) {
    db.prepare(`DROP TABLE IF EXISTS ${t}`).run();
  }
  db.pragma('foreign_keys = ON');
})();

// Re-initialize schema and default initial seed
initDatabase();

console.log('[Lost Paint Studios] Database reset and seeded successfully.');
