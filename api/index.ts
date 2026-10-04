import express from 'express';
import { getDb } from '../server/db.ts';
import { apiRouter } from '../server/routes.ts';

const app = express();

// Parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Initialize DB before handling requests
let dbInitPromise: Promise<any> | null = null;
app.use(async (_req, res, next) => {
  try {
    if (!dbInitPromise) {
      dbInitPromise = getDb();
    }
    await dbInitPromise;
    next();
  } catch (e: any) {
    console.error('[Vercel Serverless] Failed to initialize database:', e);
    dbInitPromise = null;
    return res.status(500).json({
      success: false,
      message: 'Gagal menginisialisasi basis data server: ' + (e?.message || String(e)),
    });
  }
});

// Favicon redirect
app.get('/favicon.ico', (_req, res) => {
  res.redirect(301, '/favicon.svg');
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', serverless: true, timestamp: new Date().toISOString() });
});

// Mount API routes (support both /api/* and /* if Vercel strips /api prefix)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// JSON 404 fallback for unmatched API requests (guarantees no HTML response)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint API tidak ditemukan: ${req.method} ${req.originalUrl || req.url}`,
  });
});

// Global error handler (guarantees all errors return JSON instead of HTML)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Server Error]:', err);
  res.status(500).json({
    success: false,
    message: err?.message || 'Terjadi kesalahan pada backend server',
  });
});

export default app;
