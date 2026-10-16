import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const notionRouter = Router();

// GET /api/notion/status (Check Notion API connection status)
notionRouter.get('/status', requireAuth, (req: AuthRequest, res: Response) => {
  const settings = db.prepare('SELECT notion_token, notion_page_id FROM settings WHERE id = ?').get('studio') as any;
  const token = settings?.notion_token || process.env.NOTION_TOKEN;
  const pageId = settings?.notion_page_id || '3e140812c09680fdbffbf5256cfc82ee';

  const isConfigured = Boolean(token && token.trim().length > 10);

  res.json({
    configured: isConfigured,
    pageId,
    publicUrl: 'https://mountainous-mouse-69.a.notion.site/PAINT-SUDIOS-INFOS-3e140812c09680fdbffbf5256cfc82ee',
    hasToken: Boolean(token),
    message: isConfigured
      ? 'Notion API token configured. Ready for authenticated sync.'
      : 'No Notion integration token configured. You can configure one in Settings or use the manual JSON/Markdown import route.'
  });
});

// POST /api/notion/test-connection (Test Notion API Token)
notionRouter.post('/test-connection', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { token } = req.body;
  const effectiveToken = token || process.env.NOTION_TOKEN;

  if (!effectiveToken) {
    res.status(400).json({
      success: false,
      message: 'No Notion integration token provided. Create an integration at notion.so/my-integrations to obtain an internal API secret.'
    });
    return;
  }

  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${effectiveToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      res.status(400).json({
        success: false,
        message: `Notion API rejected token (${response.status}): ${errData.message || response.statusText}`
      });
      return;
    }

    const data: any = await response.json();
    res.json({
      success: true,
      botName: data.name || 'Notion Integration',
      message: 'Successfully verified Notion API connection!'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Network error communicating with Notion API: ' + err.message
    });
  }
});

// POST /api/notion/sync-api (Sync from official Notion API if token is provided)
notionRouter.post('/sync-api', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const settings = db.prepare('SELECT notion_token, notion_page_id FROM settings WHERE id = ?').get('studio') as any;
  const token = settings?.notion_token || process.env.NOTION_TOKEN;

  if (!token) {
    res.status(400).json({
      error: 'Notion API token is not configured. Please provide NOTION_TOKEN in Settings or environment variables.'
    });
    return;
  }

  res.status(501).json({
    error: 'Direct Notion block tree mapping requires target database IDs shared with your integration bot.'
  });
});

// POST /api/notion/manual-import (Manual JSON or Markdown project data import pathway)
notionRouter.post('/manual-import', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { type, payload } = req.body;
    if (!payload) {
      res.status(400).json({ error: 'Payload data is required.' });
      return;
    }

    const now = new Date().toISOString();
    let importedCount = 0;

    if (type === 'tasks' && Array.isArray(payload)) {
      const upsert = db.prepare(`
        INSERT INTO tasks (id, title, category, status, priority, description, created_at, updated_at)
        VALUES (@id, @title, @category, @status, @priority, @description, @now, @now)
        ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = excluded.status, updated_at = @now
      `);

      db.transaction(() => {
        for (const item of payload) {
          if (item.title) {
            upsert.run({
              id: item.id || 'task-' + crypto.randomUUID().slice(0, 8),
              title: item.title,
              category: item.category || 'Other',
              status: item.status || 'To Do',
              priority: item.priority || 'Normal',
              description: item.description || '',
              now
            });
            importedCount++;
          }
        }
      })();
    } else if (type === 'documents' && Array.isArray(payload)) {
      const insertDoc = db.prepare(`
        INSERT INTO documents (id, title, category, content, author_name, tags, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);

      db.transaction(() => {
        for (const doc of payload) {
          if (doc.title && doc.content) {
            insertDoc.run(
              doc.id || 'doc-' + crypto.randomUUID().slice(0, 8),
              doc.title,
              doc.category || 'Game Design & Systems',
              doc.content,
              doc.author_name || req.user!.display_name,
              doc.tags || '',
              now,
              now
            );
            importedCount++;
          }
        }
      })();
    } else {
      res.status(400).json({ error: 'Unsupported manual import format. Expecting "tasks" or "documents" array.' });
      return;
    }

    // Record import history
    db.prepare(`
      INSERT INTO import_history (id, source, status, records_count, details, performed_by, created_at)
      VALUES (?, 'MANUAL_JSON', 'SUCCESS', ?, ?, ?, ?)
    `).run(
      'imp-' + crypto.randomUUID().slice(0, 8),
      importedCount,
      `Imported ${importedCount} ${type} records via manual payload.`,
      req.user!.display_name,
      now
    );

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'IMPORT',
      entityType: 'NOTION_MANUAL',
      details: `Imported ${importedCount} records of type ${type}`
    });

    res.json({
      success: true,
      recordsImported: importedCount,
      message: `Successfully imported ${importedCount} ${type} records.`
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to import payload: ' + err.message });
  }
});
