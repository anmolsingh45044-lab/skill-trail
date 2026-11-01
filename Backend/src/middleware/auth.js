import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

const COOKIE = 'st_session';
const cookieOptions = () => ({
  httpOnly: true, // not readable from JavaScript, so an XSS bug can't steal the session
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/',
});

export function startSession(res, userId) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: `${config.sessionDays}d`,
  });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: config.sessionDays * 24 * 60 * 60 * 1000 });
}

export function endSession(res) {
  res.clearCookie(COOKIE, cookieOptions());
}

// Returns the signed-in user, or null when there is no valid session.
export async function currentUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const { rows } = await query('SELECT id, email, name, picture FROM users WHERE id = $1', [Number(payload.sub)]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const user = await currentUser(req);
  if (!user) {
    if (req.cookies?.[COOKIE]) endSession(res); // clear a stale or tampered cookie
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  req.user = user;
  next();
}
