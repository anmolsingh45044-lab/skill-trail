import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import { config } from './config.js';
import { HttpError } from './errors.js';
import authRoutes from './routes/auth.js';
import trackerRoutes from './routes/tracker.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Google Identity Services (the "Continue with Google" button) and Google Fonts.
          'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'https://*.googleusercontent.com'],
          'connect-src': ["'self'", 'https://accounts.google.com/gsi/'],
          'frame-src': ["'self'", 'https://accounts.google.com/gsi/'],
          // http://localhost can't be upgraded to https, which would break the site when testing locally.
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      // Google's sign-in popup needs to talk back to this page; the default "same-origin" blocks that.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api', trackerRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Serve the built React app (Frontend/dist) when it exists.
  const indexHtml = path.join(config.frontendDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.frontendDist));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(indexHtml) : next()));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
  });

  return app;
}
