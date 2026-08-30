import { Router } from 'express';
import { runSync, isSyncRunning } from '../syncService.js';
import { getLatestSyncRun, listSyncRuns } from '../db.js';

export const syncRouter = Router();

// Triggers an on-demand sync from BigFix Inventory. Returns immediately
// with 202 if a sync is already in flight; otherwise runs it and returns
// the result (kept synchronous since a sync is typically a few seconds).
syncRouter.post('/', async (req, res) => {
  if (isSyncRunning()) {
    return res.status(202).json({ message: 'A sync is already in progress.' });
  }
  try {
    const result = await runSync();
    res.status(200).json({ message: 'Sync complete', ...result });
  } catch (err) {
    res.status(502).json({ error: 'Sync failed', detail: err.message });
  }
});

syncRouter.get('/status', (req, res) => {
  res.json({
    running: isSyncRunning(),
    latestRun: getLatestSyncRun() || null,
  });
});

syncRouter.get('/history', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json({ runs: listSyncRuns({ limit }) });
});
