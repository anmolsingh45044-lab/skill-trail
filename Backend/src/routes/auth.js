import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { currentUser, endSession, startSession } from '../middleware/auth.js';

const router = Router();

const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

// Used to spend the same time on unknown emails as on real ones, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

const q = {
  byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  byGoogleId: db.prepare('SELECT * FROM users WHERE google_id = ?'),
  insert: db.prepare(
    'INSERT INTO users (email, name, picture, password_hash, google_id, last_login_at) VALUES (@email, @name, @picture, @passwordHash, @googleId, datetime(\'now\'))',
  ),
  touch: db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?'),
  // Linking Google drops any password. Password sign-ups aren't email-verified, so without this someone could
  // register another person's email first and keep access after that person signs in with Google.
  linkGoogle: db.prepare(
    'UPDATE users SET google_id = @googleId, password_hash = NULL, name = @name, picture = @picture, last_login_at = datetime(\'now\') WHERE id = @id',
  ),
  refreshGoogle: db.prepare(
    'UPDATE users SET name = @name, picture = @picture, last_login_at = datetime(\'now\') WHERE id = @id',
  ),
};

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, picture: u.picture ?? null });

const credentials = z.object({
  email: z.email('Enter a valid email address.').max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'That password is too long.'),
});
const registerBody = credentials.extend({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'That name is too long.'),
});
const loginBody = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1, 'Enter your password.').max(128),
});
const googleBody = z.object({ credential: z.string().min(20).max(4096) });

const parse = (schema, body) => {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  return result.data;
};

// The frontend asks for this at startup, so the Google client id only has to be configured in one place.
router.get('/config', (_req, res) => {
  res.json({ googleClientId: config.googleClientId || null });
});

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = parse(registerBody, req.body);

  if (q.byEmail.get(email)) {
    throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const { lastInsertRowid } = q.insert.run({ email, name, picture: null, passwordHash, googleId: null });

  startSession(res, Number(lastInsertRowid));
  res.status(201).json({ user: publicUser({ id: Number(lastInsertRowid), name, email }) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(loginBody, req.body);
  const user = q.byEmail.get(email);

  const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !matches) {
    throw new HttpError(401, 'Incorrect email or password. If you signed up with Google, use "Continue with Google".');
  }

  q.touch.run(user.id);
  startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/google', authLimiter, async (req, res) => {
  if (!googleClient) throw new HttpError(503, 'Google sign-in is not set up on this server.');
  const { credential } = parse(googleBody, req.body);

  let profile;
  try {
    // Checks the signature, expiry and that the token was issued for *our* client id.
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    profile = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Google sign-in failed. Try again.');
  }
  if (!profile?.sub || !profile.email || !profile.email_verified) {
    throw new HttpError(401, 'Your Google account needs a verified email address.');
  }

  const email = profile.email.toLowerCase();
  const info = { googleId: profile.sub, name: profile.name || email.split('@')[0], picture: profile.picture ?? null };

  let user = q.byGoogleId.get(profile.sub);
  if (user) {
    q.refreshGoogle.run({ id: user.id, name: info.name, picture: info.picture });
  } else if ((user = q.byEmail.get(email))) {
    if (user.google_id) throw new HttpError(409, 'This email is already linked to a different Google account.');
    q.linkGoogle.run({ id: user.id, ...info });
  } else {
    const { lastInsertRowid } = q.insert.run({ email, passwordHash: null, ...info });
    user = { id: Number(lastInsertRowid) };
  }

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  startSession(res, fresh.id);
  res.json({ user: publicUser(fresh) });
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.status(204).end();
});

// Not an error when signed out: the app calls this on every page load to find out whether to show the login page.
router.get('/me', (req, res) => {
  const user = currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

export default router;
