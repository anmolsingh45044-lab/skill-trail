import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard, getTrackerForUser, updateItem } from '../services/tracker.js';

const router = Router();

// Every sheet with this user's progress merged in.
router.get('/tracker', requireAuth, async (req, res) => {
  res.json(await getTrackerForUser(req.user.id));
});

router.get('/dashboard', requireAuth, async (req, res) => {
  res.json(await getDashboard(req.user.id));
});

// Body: the fields to change, e.g. { "status": "Done" } or { "confidence": 4, "notes": "Finished chapter 3" }.
router.patch('/items/:itemId', requireAuth, async (req, res) => {
  const values = await updateItem(req.user.id, req.params.itemId, req.body);
  res.json({ id: req.params.itemId, values });
});

export default router;
