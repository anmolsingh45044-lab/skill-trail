import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { currentUser, endSession, startSession } from '../middleware/auth.js';

const router = Router();
const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

const findByEmail = async (email) => (await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email])).rows[0] ?? null;
const findByGoogleId = async (googleId) => (await query('SELECT * FROM users WHERE google_id = $1', [googleId])).rows[0] ?? null;
const insertUser = async ({ email, name, picture, passwordHash, googleId }) => (await query(
  'INSERT INTO users (email, name, picture, password_hash, google_id, last_login_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
  [email, name, picture, passwordHash, googleId],
)).rows[0];
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, picture: u.picture ?? null });

const credentials = z.object({
  email: z.email('Enter a valid email address.').max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'That password is too long.'),
});
const registerBody = credentials.extend({ name: z.string().trim().min(1, 'Enter your name.').max(80, 'That name is too long.') });
const loginBody = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().min(1, 'Enter your password.').max(128) });
const googleBody = z.object({ credential: z.string().min(20).max(4096) });
const parse = (schema, body) => {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  return result.data;
};

router.get('/config', (_req, res) => res.json({ googleClientId: config.googleClientId || null }));

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = parse(registerBody, req.body);
  if (await findByEmail(email)) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  const passwordHash = await bcrypt.hash(password, 12);
  const { id } = await insertUser({ email, name, picture: null, passwordHash, googleId: null });
  startSession(res, Number(id));
  res.status(201).json({ user: publicUser({ id: Number(id), name, email }) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(loginBody, req.body);
  const user = await findByEmail(email);
  const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !matches) throw new HttpError(401, 'Incorrect email or password. If you signed up with Google, use "Continue with Google".');
  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
  startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/google', authLimiter, async (req, res) => {
  if (!googleClient) throw new HttpError(503, 'Google sign-in is not set up on this server.');
  const { credential } = parse(googleBody, req.body);
  let profile;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    profile = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Google sign-in failed. Try again.');
  }
  if (!profile?.sub || !profile.email || !profile.email_verified) throw new HttpError(401, 'Your Google account needs a verified email address.');

  const email = profile.email.toLowerCase();
  const info = { googleId: profile.sub, name: profile.name || email.split('@')[0], picture: profile.picture ?? null };
  let user = await findByGoogleId(profile.sub);
  if (user) {
    await query('UPDATE users SET name = $1, picture = $2, last_login_at = CURRENT_TIMESTAMP WHERE id = $3', [info.name, info.picture, user.id]);
  } else if ((user = await findByEmail(email))) {
    if (user.google_id) throw new HttpError(409, 'This email is already linked to a different Google account.');
    await query('UPDATE users SET google_id = $1, password_hash = NULL, name = $2, picture = $3, last_login_at = CURRENT_TIMESTAMP WHERE id = $4', [info.googleId, info.name, info.picture, user.id]);
  } else {
    const inserted = await insertUser({ email, passwordHash: null, ...info });
    user = { id: Number(inserted.id) };
  }

  const fresh = (await query('SELECT * FROM users WHERE id = $1', [user.id])).rows[0];
  startSession(res, fresh.id);
  res.json({ user: publicUser(fresh) });
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  const user = await currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

export default router;
