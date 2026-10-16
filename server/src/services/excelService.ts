import ExcelJS from 'exceljs';
import { db } from '../db/database';

export async function generateStudioWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lost Paint Studios Control Center';
  workbook.created = new Date();

  // 1. README Sheet
  const readmeSheet = workbook.addWorksheet('README & Instructions', {
    views: [{ showGridLines: true }]
  });
  readmeSheet.columns = [
    { header: 'Property', key: 'prop', width: 25 },
    { header: 'Details', key: 'val', width: 70 }
  ];
  readmeSheet.addRow({ prop: 'Studio', val: 'Lost Paint Studios' });
  readmeSheet.addRow({ prop: 'Project', val: 'Untitled Psychological Horror Game (Game Title TBD)' });
  readmeSheet.addRow({ prop: 'Engine & Platforms', val: 'Unity URP | Steam / PC, Google Play / Android' });
  readmeSheet.addRow({ prop: 'Workbook Purpose', val: 'Human-readable operational snapshot, team tracking, and safe import/export.' });
  readmeSheet.addRow({ prop: 'Import Instructions', val: 'Preserve ID columns when updating existing records. Leave ID empty or write "auto" to create new records. All imports are transactional.' });
  styleHeaderRow(readmeSheet);

  // 2. Tasks Sheet
  const tasksSheet = workbook.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 1 }] });
  tasksSheet.columns = [
    { header: 'Task ID', key: 'id', width: 15 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Chapter', key: 'chapter_name', width: 25 },
    { header: 'Assignees', key: 'assignees', width: 30 },
    { header: 'Due Date', key: 'due_date', width: 15 },
    { header: 'Estimate (Hours)', key: 'estimate_hours', width: 18 },
    { header: 'Description', key: 'description', width: 45 }
  ];
  styleHeaderRow(tasksSheet);

  const tasks = db.prepare(`
    SELECT t.*, c.name as chapter_name
    FROM tasks t
    LEFT JOIN chapters c ON t.chapter_id = c.id
    ORDER BY t.created_at DESC
  `).all() as any[];

  for (const t of tasks) {
    const assignees = db.prepare(`
      SELECT tm.name FROM task_assignees ta
      JOIN team_members tm ON ta.team_member_id = tm.id
      WHERE ta.task_id = ?
    `).all(t.id) as { name: string }[];

    tasksSheet.addRow({
      id: t.id,
      title: t.title,
      category: t.category,
      status: t.status,
      priority: t.priority,
      chapter_name: t.chapter_name || '',
      assignees: assignees.map(a => a.name).join(', '),
      due_date: t.due_date || '',
      estimate_hours: t.estimate_hours || '',
      description: t.description || ''
    });
  }

  // 3. Team Sheet
  const teamSheet = workbook.addWorksheet('Team', { views: [{ state: 'frozen', ySplit: 1 }] });
  teamSheet.columns = [
    { header: 'Member ID', key: 'id', width: 15 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Country', key: 'country', width: 18 },
    { header: 'Country Code', key: 'country_code', width: 14 },
    { header: 'Roles', key: 'roles', width: 45 },
    { header: 'Skills', key: 'skills', width: 40 },
    { header: 'Founder', key: 'is_founder', width: 12 },
    { header: 'Can Record Gameplay', key: 'can_record_gameplay', width: 22 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Notes', key: 'notes', width: 35 }
  ];
  styleHeaderRow(teamSheet);

  const team = db.prepare('SELECT * FROM team_members ORDER BY is_founder DESC, name ASC').all() as any[];
  for (const m of team) {
    teamSheet.addRow({
      id: m.id,
      name: m.name,
      country: m.country,
      country_code: m.country_code,
      roles: m.roles,
      skills: m.skills || '',
      is_founder: m.is_founder ? 'Yes' : 'No',
      can_record_gameplay: m.can_record_gameplay ? 'Yes' : 'No',
      status: m.status,
      notes: m.notes || ''
    });
  }

  // 4. Chapters Sheet
  const chaptersSheet = workbook.addWorksheet('Chapters', { views: [{ state: 'frozen', ySplit: 1 }] });
  chaptersSheet.columns = [
    { header: 'Chapter ID', key: 'id', width: 15 },
    { header: 'Order', key: 'order_index', width: 10 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Day Range', key: 'day_range', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Summary', key: 'summary', width: 45 },
    { header: 'Risks', key: 'risks', width: 30 },
    { header: 'Acceptance Criteria', key: 'acceptance_criteria', width: 40 }
  ];
  styleHeaderRow(chaptersSheet);

  const chapters = db.prepare('SELECT * FROM chapters ORDER BY order_index ASC').all() as any[];
  for (const c of chapters) {
    chaptersSheet.addRow({
      id: c.id,
      order_index: c.order_index,
      name: c.name,
      day_range: c.day_range,
      status: c.status,
      summary: c.summary || '',
      risks: c.risks || '',
      acceptance_criteria: c.acceptance_criteria || ''
    });
  }

  // 5. Bugs Sheet
  const bugsSheet = workbook.addWorksheet('Bugs & QA', { views: [{ state: 'frozen', ySplit: 1 }] });
  bugsSheet.columns = [
    { header: 'Bug ID', key: 'id', width: 15 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Platform', key: 'platform', width: 20 },
    { header: 'Reporter', key: 'reporter_name', width: 20 },
    { header: 'Assignee', key: 'assignee_name', width: 20 },
    { header: 'Date Found', key: 'date_found', width: 15 },
    { header: 'Repro Steps', key: 'reproduction_steps', width: 40 }
  ];
  styleHeaderRow(bugsSheet);

  const bugs = db.prepare(`
    SELECT b.*, tm.name as assignee_name
    FROM bugs b
    LEFT JOIN team_members tm ON b.assignee_id = tm.id
    ORDER BY b.created_at DESC
  `).all() as any[];

  for (const b of bugs) {
    bugsSheet.addRow({
      id: b.id,
      title: b.title,
      severity: b.severity,
      status: b.status,
      platform: b.platform || '',
      reporter_name: b.reporter_name,
      assignee_name: b.assignee_name || '',
      date_found: b.date_found,
      reproduction_steps: b.reproduction_steps || ''
    });
  }

  // 6. Development Logs Sheet
  const logsSheet = workbook.addWorksheet('Dev Logs', { views: [{ state: 'frozen', ySplit: 1 }] });
  logsSheet.columns = [
    { header: 'Log ID', key: 'id', width: 15 },
    { header: 'Date', key: 'log_date', width: 15 },
    { header: 'Author', key: 'author_name', width: 20 },
    { header: 'Done', key: 'done', width: 35 },
    { header: 'In Progress', key: 'in_progress', width: 35 },
    { header: 'Blocked', key: 'blocked', width: 25 },
    { header: 'Next Steps', key: 'next_steps', width: 30 }
  ];
  styleHeaderRow(logsSheet);

  const logs = db.prepare('SELECT * FROM development_logs ORDER BY log_date DESC').all() as any[];
  for (const l of logs) {
    logsSheet.addRow({
      id: l.id,
      log_date: l.log_date,
      author_name: l.author_name,
      done: l.done || '',
      in_progress: l.in_progress || '',
      blocked: l.blocked || '',
      next_steps: l.next_steps || ''
    });
  }

  // 7. Marketing Sheet
  const mktSheet = workbook.addWorksheet('Marketing', { views: [{ state: 'frozen', ySplit: 1 }] });
  mktSheet.columns = [
    { header: 'Item ID', key: 'id', width: 15 },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Platform', key: 'platform', width: 16 },
    { header: 'Format', key: 'format', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Planned Date', key: 'planned_publish_date', width: 16 },
    { header: 'Caption', key: 'caption', width: 40 }
  ];
  styleHeaderRow(mktSheet);

  const mkt = db.prepare('SELECT * FROM marketing_items ORDER BY created_at DESC').all() as any[];
  for (const m of mkt) {
    mktSheet.addRow({
      id: m.id,
      title: m.title,
      platform: m.platform,
      format: m.format,
      status: m.status,
      planned_publish_date: m.planned_publish_date || '',
      caption: m.caption || ''
    });
  }

  // 8. Media Production Sheet
  const mediaSheet = workbook.addWorksheet('Media Production', { views: [{ state: 'frozen', ySplit: 1 }] });
  mediaSheet.columns = [
    { header: 'Media ID', key: 'id', width: 15 },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Type', key: 'media_type', width: 20 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Aspect Ratio', key: 'aspect_ratio', width: 14 },
    { header: 'Deadline', key: 'deadline', width: 16 },
    { header: 'Objective', key: 'objective', width: 35 }
  ];
  styleHeaderRow(mediaSheet);

  const media = db.prepare('SELECT * FROM media_production_items ORDER BY created_at DESC').all() as any[];
  for (const med of media) {
    mediaSheet.addRow({
      id: med.id,
      title: med.title,
      media_type: med.media_type,
      status: med.status,
      aspect_ratio: med.aspect_ratio,
      deadline: med.deadline || '',
      objective: med.objective || ''
    });
  }

  // 9. Documents Index Sheet
  const docsSheet = workbook.addWorksheet('Documents Index', { views: [{ state: 'frozen', ySplit: 1 }] });
  docsSheet.columns = [
    { header: 'Doc ID', key: 'id', width: 15 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Author', key: 'author_name', width: 20 },
    { header: 'Version', key: 'version', width: 10 },
    { header: 'Tags', key: 'tags', width: 25 }
  ];
  styleHeaderRow(docsSheet);

  const docs = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all() as any[];
  for (const d of docs) {
    docsSheet.addRow({
      id: d.id,
      title: d.title,
      category: d.category,
      author_name: d.author_name,
      version: d.version,
      tags: d.tags || ''
    });
  }

  return workbook;
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E2439' }
  };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 26;
}
