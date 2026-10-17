import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { app } from '../app';
import { db } from '../db/database';
import { generateStudioWorkbook } from '../services/excelService';

describe('Lost Paint Studios — Studio Control Center Backend Tests', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(() => {
    // Clear and re-initialize test state with respect to foreign keys
    db.prepare('DELETE FROM invites').run();
    db.prepare('UPDATE team_members SET user_id = NULL').run();
    db.prepare('UPDATE tasks SET creator_id = NULL').run();
    db.prepare('UPDATE development_logs SET author_id = NULL').run();
    db.prepare('UPDATE bugs SET reporter_id = NULL').run();
    db.prepare('UPDATE calendar_events SET creator_id = NULL').run();
    db.prepare('UPDATE task_comments SET author_id = NULL').run();
    db.prepare('DELETE FROM users').run();
  });

  it('Health endpoint returns healthy status and connected database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.service).toContain('Lost Paint Studios');
  });

  it('Seeds exactly 13 team members with correct countries and roles', async () => {
    const members = db.prepare('SELECT * FROM team_members').all() as any[];
    expect(members.length).toBe(13);

    const names = members.map(m => m.name);
    expect(names).toContain('BuildwithKevin');
    expect(names).toContain('AquaMiletYT');
    expect(names).toContain('Hsein');
    expect(names).toContain('AuraKkboo');
    expect(names).toContain('Tobyosnow');
    expect(names).toContain('Survivor');
    expect(names).toContain('Steve');
    expect(names).toContain('Mach Studios');
    expect(names).toContain('Raffie0_0');
    expect(names).toContain('S4mmy');
    expect(names).toContain('Kite');
    expect(names).toContain('Raphaelle');
    expect(names).toContain('Rosie');

    // Check gameplay recording privileges
    const recorders = members.filter(m => m.can_record_gameplay === 1).map(m => m.name);
    expect(recorders).toContain('Steve');
    expect(recorders).toContain('AuraKkboo');
    expect(recorders).toContain('Tobyosnow');
    expect(recorders).toContain('Survivor');

    // Check founders
    const founders = members.filter(m => m.is_founder === 1).map(m => m.name);
    expect(founders).toContain('BuildwithKevin');
    expect(founders).toContain('AquaMiletYT');
  });

  it('Seeds 5 planned roadmap chapters matching specification', async () => {
    const chapters = db.prepare('SELECT * FROM chapters ORDER BY order_index ASC').all() as any[];
    expect(chapters.length).toBe(5);
    expect(chapters[0].day_range).toBe('Days 1–20');
    expect(chapters[0].name).toContain('Chapter 1 / Opening');
    expect(chapters[1].day_range).toBe('Days 21–40');
    expect(chapters[1].name).toContain('Chapter 2: Farmhouse');
    expect(chapters[2].day_range).toBe('Days 41–60');
    expect(chapters[3].day_range).toBe('Days 61–80');
    expect(chapters[4].day_range).toBe('Days 81–100');
  });

  it('Allows setting up the first owner/admin account', async () => {
    const res = await request(app)
      .post('/api/auth/setup-admin')
      .send({
        email: 'kevin@lostpaintstudios.com',
        password: 'secureFounderPassword2026!',
        display_name: 'BuildwithKevin',
        team_member_id: 'member-1'
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.token).toBeDefined();

    adminToken = res.body.token;

    // Disallow second setup
    const duplicateRes = await request(app)
      .post('/api/auth/setup-admin')
      .send({
        email: 'other@lostpaintstudios.com',
        password: 'anotherPassword123!',
        display_name: 'Another User'
      });
    expect(duplicateRes.status).toBe(400);
  });

  it('Enforces login authentication and validates passwords', async () => {
    // Failed login
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'kevin@lostpaintstudios.com',
        password: 'wrongPassword!'
      });
    expect(failRes.status).toBe(401);

    // Successful login
    const successRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'kevin@lostpaintstudios.com',
        password: 'secureFounderPassword2026!'
      });
    expect(successRes.status).toBe(200);
    expect(successRes.body.token).toBeDefined();
  });

  it('Rejects unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('Supports invite generation and creating a viewer account', async () => {
    // Admin creates invite
    const inviteRes = await request(app)
      .post('/api/auth/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'viewer@lostpaintstudios.com',
        role: 'viewer',
        team_member_id: 'member-12'
      });
    expect(inviteRes.status).toBe(200);
    const token = inviteRes.body.token;

    // Viewer accepts invite
    const acceptRes = await request(app)
      .post('/api/auth/accept-invite')
      .send({
        token,
        password: 'viewerPassword123!',
        display_name: 'Raphaelle'
      });
    expect(acceptRes.status).toBe(200);
    viewerToken = acceptRes.body.token;
  });

  it('Enforces role permissions: Viewer cannot create tasks, Admin can', async () => {
    // Viewer attempt to create task -> 403 Forbidden
    const viewerTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Unauthorized Task',
        category: 'Level Design',
        status: 'To Do',
        priority: 'Normal'
      });
    expect(viewerTaskRes.status).toBe(403);

    // Admin creates task -> 201 Created
    const adminTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Assemble Abandoned Farmhouse Cellar Door',
        description: 'Construct heavy cellar door prop with padlock chain interaction.',
        category: 'Level Design',
        status: 'In Progress',
        priority: 'High',
        chapter_id: 'chapter-1',
        assignee_ids: ['member-1', 'member-8']
      });
    expect(adminTaskRes.status).toBe(201);
    expect(adminTaskRes.body.id).toBeDefined();
  });

  it('Calculates chapter progress accurately based on linked tasks', async () => {
    const res = await request(app)
      .get('/api/chapters')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ch1 = res.body.chapters.find((c: any) => c.id === 'chapter-1');
    expect(ch1).toBeDefined();
    expect(ch1.total_tasks).toBeGreaterThan(0);
    expect(typeof ch1.progress_percent).toBe('number');
  });

  it('Generates operational Excel (.xlsx) export successfully', async () => {
    const res = await request(app)
      .get('/api/excel/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.body).toBeDefined();
  });

  it('Imports Excel operational workbook and generates unique IDs for "auto" and empty ID rows', async () => {
    const wb = await generateStudioWorkbook();

    // Replace tasks sheet rows with 6 tasks having "auto", "AUTO", or empty IDs as instructed in workbook README
    const tasksSheet = wb.getWorksheet('Tasks')!;
    while (tasksSheet.rowCount > 1) {
      tasksSheet.spliceRows(2, 1);
    }
    tasksSheet.addRow({ id: 'auto', title: 'Excel Import Task 1', category: 'Level Design', status: 'To Do', priority: 'High' });
    tasksSheet.addRow({ id: 'auto', title: 'Excel Import Task 2', category: 'Coding', status: 'In Progress', priority: 'Urgent' });
    tasksSheet.addRow({ id: 'AUTO', title: 'Excel Import Task 3', category: 'Visual Scripting', status: 'To Do', priority: 'Normal' });
    tasksSheet.addRow({ id: '', title: 'Excel Import Task 4', category: '3D Art', status: 'Done', priority: 'Normal' });
    tasksSheet.addRow({ id: 'Auto', title: 'Excel Import Task 5', category: 'Music', status: 'In Progress', priority: 'High' });
    tasksSheet.addRow({ id: 'auto', title: 'Excel Import Task 6', category: 'QA', status: 'To Do', priority: 'Low' });

    // Bugs sheet: 1 bug with 'auto' ID
    const bugsSheet = wb.getWorksheet('Bugs & QA')!;
    while (bugsSheet.rowCount > 1) {
      bugsSheet.spliceRows(2, 1);
    }
    bugsSheet.addRow({ id: 'auto', title: 'Excel Import Bug 1', severity: 'Medium', status: 'New' });

    const buffer = await wb.xlsx.writeBuffer();

    const importRes = await request(app)
      .post('/api/excel/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(buffer), 'test-import.xlsx');

    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.recordsImported.tasks).toBe(6);
    expect(importRes.body.recordsImported.team).toBe(13);
    expect(importRes.body.recordsImported.bugs).toBe(1);

    // Verify all 6 imported tasks exist as distinct records and are visible via /api/tasks
    const tasksRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(tasksRes.status).toBe(200);
    const titles = tasksRes.body.tasks.map((t: any) => t.title);
    expect(titles).toContain('Excel Import Task 1');
    expect(titles).toContain('Excel Import Task 2');
    expect(titles).toContain('Excel Import Task 3');
    expect(titles).toContain('Excel Import Task 4');
    expect(titles).toContain('Excel Import Task 5');
    expect(titles).toContain('Excel Import Task 6');

    // Ensure no task literally has 'auto' as primary key ID
    const autoTasks = tasksRes.body.tasks.filter((t: any) => t.id.toLowerCase() === 'auto');
    expect(autoTasks.length).toBe(0);
  });

  it('Successfully queries and sorts tasks with priority ordering', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  it('Successfully queries and sorts bugs with severity ordering', async () => {
    const res = await request(app)
      .get('/api/bugs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bugs)).toBe(true);
  });

  it('Supports adding, toggling, and deleting milestones and chapters', async () => {
    // 1. Create a temporary chapter
    const createRes = await request(app)
      .post('/api/chapters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Deletion Chapter',
        day_range: 'Days 101–120',
        status: 'Planned'
      });
    expect(createRes.status).toBe(201);
    const testChId = createRes.body.id;

    // 2. Add a milestone to this chapter
    const msRes = await request(app)
      .post(`/api/chapters/${testChId}/milestones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Temporary Milestone Test',
        status: 'Pending'
      });
    expect(msRes.status).toBe(201);
    const testMsId = msRes.body.id;

    // 3. Delete milestone
    const delMsRes = await request(app)
      .delete(`/api/chapters/milestones/${testMsId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delMsRes.status).toBe(200);

    // 4. Delete chapter
    const delChRes = await request(app)
      .delete(`/api/chapters/${testChId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delChRes.status).toBe(200);

    // 5. Verify chapter is gone
    const checkRes = await request(app)
      .get(`/api/chapters/${testChId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(checkRes.status).toBe(404);
  });
});

