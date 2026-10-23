import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard, getTrackerForUser, updateItem } from '../services/tracker.js';

const router = Router();

// Every sheet with this user's progress merged in.
router.get('/tracker', requireAuth, (req, res) => {
  res.json(getTrackerForUser(req.user.id));
});

router.get('/dashboard', requireAuth, (req, res) => {
  res.json(getDashboard(req.user.id));
});

// Body: the fields to change, e.g. { "status": "Done" } or { "confidence": 4, "notes": "Finished chapter 3" }.
router.patch('/items/:itemId', requireAuth, (req, res) => {
  const values = updateItem(req.user.id, req.params.itemId, req.body);
  res.json({ id: req.params.itemId, values });
});

export default router;
