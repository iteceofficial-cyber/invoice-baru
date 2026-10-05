import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db.ts';
import { apiRouter } from './server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Initialize relational SQLite database
  console.log('[Database] Menginisialisasi basis data relasional SQLite...');
  await getDb();
  console.log('[Database] Basis data berhasil diinisialisasi.');

  // Parsers
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Favicon and static assets
  app.get('/favicon.ico', (_req, res) => {
    res.redirect(301, '/favicon.svg');
  });

  // Direct PDF download routes (without /api prefix, directly accessible from WhatsApp links)
  const forwardToPdf = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    req.url = '/invoices/public/download-pdf' + qs;
    apiRouter(req, res, next);
  };
  app.get(['/download-pdf', '/unduh-pdf', '/faktur-pdf'], forwardToPdf);
  app.get('/pdf/:identifier', (req, res, next) => {
    const qs = req.url.includes('?') ? '&' + req.url.substring(req.url.indexOf('?') + 1) : '';
    req.url = `/invoices/public/download-pdf?inv=${encodeURIComponent(req.params.identifier)}${qs}`;
    apiRouter(req, res, next);
  });

  // Mount API router
  app.use('/api', apiRouter);

  // 404 handler for API routes (prevent falling through to frontend HTML)
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      message: `API endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`,
    });
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Frontend integration
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Aplikasi berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Gagal menjalankan server:', err);
  process.exit(1);
});
