import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(here, '..');

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

let jwtSecret = env.JWT_SECRET?.trim();
if (!jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production.');
  }
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET is not set, so a temporary one is in use. Everyone is signed out whenever the server restarts.');
}

export const config = {
  isProduction,
  port: Number(env.PORT) || 4000,
  // Origin of the React dev server. Only used for CORS when the frontend is served from a different origin.
  clientUrl: env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret,
  sessionDays: 7,
  googleClientId: env.GOOGLE_CLIENT_ID?.trim() || '',
  databasePath: env.DATABASE_PATH || path.join(backendRoot, 'data', 'tracker.db'),
  // Number of reverse proxies in front of the app (e.g. 1 on Render/Railway/Heroku). Needed for correct rate limiting.
  trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || 1 : false,
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction,
  // true: new accounts start from the statuses saved in the Excel workbook. false: everything starts as "Not started".
  useWorkbookProgress: env.USE_WORKBOOK_PROGRESS !== 'false',
  // The built React app. When it exists, the backend serves it so one process runs the whole site.
  frontendDist: path.resolve(backendRoot, '..', 'Frontend', 'dist'),
};
