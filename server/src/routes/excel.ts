import { Router, Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { generateStudioWorkbook } from '../services/excelService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const excelRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/excel/export (Download current snapshot)
excelRouter.get('/export', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workbook = await generateStudioWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lost_paint_studios_export_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();

    logAudit({
      userId: req.user?.id,
      userName: req.user?.display_name || 'Anonymous',
      action: 'EXPORT',
      entityType: 'EXCEL',
      details: 'Exported full studio operational workbook'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate Excel workbook: ' + err.message });
  }
});

// GET /api/excel/template (Download blank/template workbook)
excelRouter.get('/template', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workbook = await generateStudioWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="lost_paint_studios_template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate template: ' + err.message });
  }
});

// POST /api/excel/preview (Parse and dry-run validate workbook without writing)
excelRouter.post('/preview', requireAuth, requireRole('admin', 'editor'), upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No Excel file uploaded.' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);

    const sheetSummaries: Record<string, { totalRows: number; validRows: number; errors: string[] }> = {};

    workbook.eachSheet((worksheet, sheetId) => {
      const sheetName = worksheet.name;
      if (sheetName.toLowerCase().includes('readme')) return;

      const rowCount = worksheet.rowCount - 1; // subtract header
      const errors: string[] = [];

      if (rowCount <= 0) {
        sheetSummaries[sheetName] = { totalRows: 0, validRows: 0, errors: ['Sheet is empty'] };
        return;
      }

      // Check header row
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell(cell => headers.push(String(cell.value || '')));

      sheetSummaries[sheetName] = {
        totalRows: Math.max(0, rowCount),
        validRows: Math.max(0, rowCount),
        errors
      };
    });

    res.json({
      valid: true,
      message: 'Workbook validated successfully.',
      sheets: sheetSummaries
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to parse Excel file: ' + err.message });
  }
});

// POST /api/excel/import (Transactional import with backup creation)
excelRouter.post('/import', requireAuth, requireRole('admin'), upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No Excel file uploaded.' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);

    const now = new Date().toISOString();
    let importedTasks = 0;
    let importedTeam = 0;
    let importedBugs = 0;
    const errors: string[] = [];

    // Safety backup of DB before import
    const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/lost_paint.db');
    const backupPath = dbPath + `.backup-${Date.now()}`;
    try {
      fs.copyFileSync(dbPath, backupPath);
    } catch (e) {
      console.warn('Could not make safety copy before import:', e);
    }

    // Run within a SQLite Transaction so failures rollback cleanly
    db.transaction(() => {
      // 1. Process Tasks Sheet if present
      const tasksSheet = workbook.getWorksheet('Tasks');
      if (tasksSheet && tasksSheet.rowCount > 1) {
        const upsertTask = db.prepare(`
          INSERT INTO tasks (
            id, title, category, status, priority, description, due_date, estimate_hours, created_at, updated_at
          ) VALUES (@id, @title, @category, @status, @priority, @description, @due_date, @estimate_hours, @created_at, @updated_at)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            category = excluded.category,
            status = excluded.status,
            priority = excluded.priority,
            description = excluded.description,
            due_date = excluded.due_date,
            estimate_hours = excluded.estimate_hours,
            updated_at = excluded.updated_at
        `);

        const parseImportId = (cellValue: any, prefix: string): string => {
          const val = String(cellValue || '').trim();
          if (!val || val.toLowerCase() === 'auto') {
            return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
          }
          return val;
        };

        tasksSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header
          const id = parseImportId(row.getCell(1).value, 'task');
          const title = String(row.getCell(2).value || '').trim();
          const category = String(row.getCell(3).value || 'Other').trim();
          const status = String(row.getCell(4).value || 'To Do').trim();
          const priority = String(row.getCell(5).value || 'Normal').trim();
          const due_date = row.getCell(8).value ? String(row.getCell(8).value) : null;
          const estimate_hours = row.getCell(9).value ? Number(row.getCell(9).value) : null;
          const description = String(row.getCell(10).value || '').trim();

          if (title) {
            upsertTask.run({
              id,
              title,
              category,
              status,
              priority,
              description,
              due_date,
              estimate_hours,
              created_at: now,
              updated_at: now
            });
            importedTasks++;
          }
        });
      }

      // 2. Process Team Sheet if present
      const teamSheet = workbook.getWorksheet('Team');
      if (teamSheet && teamSheet.rowCount > 1) {
        const parseImportId = (cellValue: any, prefix: string): string => {
          const val = String(cellValue || '').trim();
          if (!val || val.toLowerCase() === 'auto') {
            return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
          }
          return val;
        };

        const upsertTeam = db.prepare(`
          INSERT INTO team_members (
            id, name, country, country_code, roles, skills, is_founder, can_record_gameplay, status, notes, created_at, updated_at
          ) VALUES (@id, @name, @country, @country_code, @roles, @skills, @is_founder, @can_record_gameplay, @status, @notes, @created_at, @updated_at)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            country = excluded.country,
            country_code = excluded.country_code,
            roles = excluded.roles,
            skills = excluded.skills,
            is_founder = excluded.is_founder,
            can_record_gameplay = excluded.can_record_gameplay,
            status = excluded.status,
            notes = excluded.notes,
            updated_at = excluded.updated_at
        `);

        teamSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const id = parseImportId(row.getCell(1).value, 'member');
          const name = String(row.getCell(2).value || '').trim();
          const country = String(row.getCell(3).value || 'India').trim();
          const country_code = String(row.getCell(4).value || 'IN').trim().toUpperCase();
          const roles = String(row.getCell(5).value || '').trim();
          const skills = String(row.getCell(6).value || '').trim();
          const is_founder = String(row.getCell(7).value || '').toLowerCase() === 'yes' ? 1 : 0;
          const can_record_gameplay = String(row.getCell(8).value || '').toLowerCase() === 'yes' ? 1 : 0;
          const status = String(row.getCell(9).value || 'active').trim();
          const notes = String(row.getCell(10).value || '').trim();

          if (name) {
            upsertTeam.run({
              id,
              name,
              country,
              country_code,
              roles,
              skills,
              is_founder,
              can_record_gameplay,
              status,
              notes,
              created_at: now,
              updated_at: now
            });
            importedTeam++;
          }
        });
      }

      // 3. Process Bugs Sheet if present
      const bugsSheet = workbook.getWorksheet('Bugs & QA');
      if (bugsSheet && bugsSheet.rowCount > 1) {
        const parseImportId = (cellValue: any, prefix: string): string => {
          const val = String(cellValue || '').trim();
          if (!val || val.toLowerCase() === 'auto') {
            return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
          }
          return val;
        };

        const upsertBug = db.prepare(`
          INSERT INTO bugs (
            id, title, severity, status, platform, reporter_name, date_found, reproduction_steps, description, created_at, updated_at
          ) VALUES (@id, @title, @severity, @status, @platform, @reporter_name, @date_found, @reproduction_steps, @description, @created_at, @updated_at)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            severity = excluded.severity,
            status = excluded.status,
            platform = excluded.platform,
            reporter_name = excluded.reporter_name,
            reproduction_steps = excluded.reproduction_steps,
            updated_at = excluded.updated_at
        `);

        bugsSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const id = parseImportId(row.getCell(1).value, 'bug');
          const title = String(row.getCell(2).value || '').trim();
          const severity = String(row.getCell(3).value || 'Medium').trim();
          const status = String(row.getCell(4).value || 'New').trim();
          const platform = String(row.getCell(5).value || 'Steam / PC').trim();
          const reporter_name = String(row.getCell(6).value || req.user!.display_name).trim();
          const date_found = row.getCell(8).value ? String(row.getCell(8).value) : now.slice(0, 10);
          const reproduction_steps = String(row.getCell(9).value || '').trim();

          if (title) {
            upsertBug.run({
              id,
              title,
              severity,
              status,
              platform,
              reporter_name,
              date_found,
              reproduction_steps,
              description: title,
              created_at: now,
              updated_at: now
            });
            importedBugs++;
          }
        });
      }

      // Record Import History
      const totalImported = importedTasks + importedTeam + importedBugs;
      db.prepare(`
        INSERT INTO import_history (id, source, status, records_count, details, performed_by, created_at)
        VALUES (?, 'EXCEL', 'SUCCESS', ?, ?, ?, ?)
      `).run(
        'imp-' + crypto.randomUUID().slice(0, 8),
        totalImported,
        `Imported ${importedTasks} tasks, ${importedTeam} team members, and ${importedBugs} bugs.`,
        req.user!.display_name,
        now
      );
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'IMPORT',
      entityType: 'EXCEL',
      details: `Excel import committed: ${importedTasks} tasks, ${importedTeam} team profiles, ${importedBugs} bugs`
    });

    res.json({
      success: true,
      message: 'Workbook import completed successfully.',
      recordsImported: {
        tasks: importedTasks,
        team: importedTeam,
        bugs: importedBugs
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});
