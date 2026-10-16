import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

export const documentsRouter = Router();

const DocumentSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  content: z.string(),
  tags: z.string().optional().default(''),
  chapter_id: z.string().nullable().optional()
});

// GET /api/documents
documentsRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { category, chapter_id, search, tag } = req.query;

  let query = `
    SELECT
      d.id, d.title, d.category, d.author_name, d.tags, d.chapter_id, d.version,
      d.created_at, d.updated_at,
      c.name as chapter_name
    FROM documents d
    LEFT JOIN chapters c ON d.chapter_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (category) {
    query += ' AND d.category = ?';
    params.push(category);
  }
  if (chapter_id) {
    query += ' AND d.chapter_id = ?';
    params.push(chapter_id);
  }
  if (tag && typeof tag === 'string') {
    query += ' AND d.tags LIKE ?';
    params.push(`%${tag}%`);
  }
  if (search && typeof search === 'string') {
    query += ' AND (d.title LIKE ? OR d.content LIKE ? OR d.tags LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY d.updated_at DESC';

  const docs = db.prepare(query).all(...params);
  res.json({ documents: docs });
});

// GET /api/documents/:id (Fetch document and its revision history)
documentsRouter.get('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const doc = db.prepare(`
    SELECT d.*, c.name as chapter_name
    FROM documents d
    LEFT JOIN chapters c ON d.chapter_id = c.id
    WHERE d.id = ?
  `).get(req.params.id) as any;

  if (!doc) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const history = db.prepare(`
    SELECT id, version, changed_by, summary, created_at
    FROM document_history
    WHERE document_id = ?
    ORDER BY version DESC
  `).all(doc.id);

  res.json({ document: { ...doc, history } });
});

// POST /api/documents
documentsRouter.post('/', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const data = DocumentSchema.parse(req.body);
    const id = 'doc-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO documents (id, title, category, content, author_name, tags, chapter_id, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        data.title,
        data.category,
        data.content,
        req.user!.display_name,
        data.tags || '',
        data.chapter_id || null,
        now,
        now
      );

      db.prepare(`
        INSERT INTO document_history (id, document_id, version, content, changed_by, summary, created_at)
        VALUES (?, ?, 1, ?, ?, 'Initial document creation', ?)
      `).run('hist-' + crypto.randomUUID().slice(0, 8), id, data.content, req.user!.display_name, now);
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'CREATE',
      entityType: 'DOC',
      entityId: id,
      details: `Created document "${data.title}" in ${data.category}`
    });

    res.status(201).json({ id, message: 'Document created successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// PUT /api/documents/:id (Update document & push revision)
documentsRouter.put('/:id', requireAuth, requireRole('admin', 'editor'), (req: AuthRequest, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const data = DocumentSchema.parse(req.body);
    const { summary } = req.body;
    const now = new Date().toISOString();
    const newVersion = existing.version + 1;

    db.transaction(() => {
      db.prepare(`
        UPDATE documents SET
          title = ?, category = ?, content = ?, tags = ?, chapter_id = ?,
          version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        data.title,
        data.category,
        data.content,
        data.tags || '',
        data.chapter_id || null,
        newVersion,
        now,
        req.params.id
      );

      db.prepare(`
        INSERT INTO document_history (id, document_id, version, content, changed_by, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'hist-' + crypto.randomUUID().slice(0, 8),
        req.params.id,
        newVersion,
        data.content,
        req.user!.display_name,
        summary || `Updated to version ${newVersion}`,
        now
      );
    })();

    logAudit({
      userId: req.user!.id,
      userName: req.user!.display_name,
      action: 'UPDATE',
      entityType: 'DOC',
      entityId: req.params.id,
      details: `Updated document "${data.title}" to version ${newVersion}`
    });

    res.json({ message: 'Document updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors ? err.errors[0].message : err.message });
  }
});

// DELETE /api/documents/:id
documentsRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ message: 'Document deleted.' });
});
