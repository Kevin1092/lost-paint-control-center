import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { db, initDatabase } from './db/database';
import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { tasksRouter } from './routes/tasks';
import { chaptersRouter } from './routes/chapters';
import { teamRouter } from './routes/team';
import { calendarRouter } from './routes/calendar';
import { devlogsRouter } from './routes/devlogs';
import { bugsRouter } from './routes/bugs';
import { documentsRouter } from './routes/documents';
import { marketingRouter } from './routes/marketing';
import { mediaRouter } from './routes/media';
import { auditRouter } from './routes/audit';
import { excelRouter } from './routes/excel';
import { notionRouter } from './routes/notion';
import { settingsRouter } from './routes/settings';
import { backupRouter } from './routes/backup';

// Ensure DB is initialized
initDatabase();

export const app = express();

// Security & Parsing Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (supports both /api/health and /health for cloud monitors)
const healthHandler = (req: Request, res: Response) => {
  try {
    const dbCheck = db.prepare('SELECT 1 as healthy').get() as { healthy: number };
    res.json({
      status: 'ok',
      service: 'Lost Paint Studios — Studio Control Center API',
      database: dbCheck?.healthy === 1 ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      database: 'error',
      error: err.message
    });
  }
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/team', teamRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/devlogs', devlogsRouter);
app.use('/api/bugs', bugsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/marketing', marketingRouter);
app.use('/api/media', mediaRouter);
app.use('/api/audit', auditRouter);
app.use('/api/excel', excelRouter);
app.use('/api/notion', notionRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/backup', backupRouter);

// 404 Handler for API routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.baseUrl} not found.` });
});

// Serve static React build when client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Lost Paint Studios] Serving static frontend from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  console.warn(`[Lost Paint Studios] Notice: Static client build not found at ${clientDistPath}. Mounting fallback / route.`);
  app.get('/', (req: Request, res: Response) => {
    res.json({
      message: 'Lost Paint Studios — Studio Control Center API is running.',
      health: '/api/health',
      timestamp: new Date().toISOString()
    });
  });
}

// Centralized Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.',
    ...(isDev && { stack: err.stack })
  });
});
