import cron from 'node-cron';
import { config } from './config.js';
import { runSync } from './syncService.js';

export function startScheduler() {
  if (!config.sync.cron) {
    console.log('[scheduler] SYNC_CRON not set; automatic sync disabled (use POST /api/sync to trigger manually).');
    return null;
  }
  if (!cron.validate(config.sync.cron)) {
    console.warn(`[scheduler] Invalid SYNC_CRON expression "${config.sync.cron}"; automatic sync disabled.`);
    return null;
  }

  const task = cron.schedule(config.sync.cron, async () => {
    console.log('[scheduler] Starting scheduled BigFix Inventory sync...');
    try {
      const result = await runSync();
      console.log(
        `[scheduler] Sync complete: ${result.computersSynced} computers, ${result.softwareInstancesSynced} software instances.`,
      );
    } catch (err) {
      console.error('[scheduler] Scheduled sync failed:', err.message);
    }
  });

  console.log(`[scheduler] Automatic sync scheduled: ${config.sync.cron}`);
  return task;
}
