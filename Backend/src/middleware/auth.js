import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

const COOKIE = 'st_session';
const findUserById = db.prepare('SELECT id, email, name, picture FROM users WHERE id = ?');

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
export function currentUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return findUserById.get(Number(payload.sub)) ?? null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    if (req.cookies?.[COOKIE]) endSession(res); // clear a stale or tampered cookie
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  req.user = user;
  next();
}
