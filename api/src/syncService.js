import { BigFixInventoryClient } from './bigfixInventory/client.js';
import {
  upsertComputers,
  upsertSoftwareInstances,
  recordSyncStart,
  recordSyncFinish,
} from './db.js';
import { config } from './config.js';

let syncInFlight = null;

function buildClient(overrides = {}) {
  return new BigFixInventoryClient({
    baseUrl: config.bigfixInventory.baseUrl,
    token: config.bigfixInventory.token,
    username: config.bigfixInventory.username,
    password: config.bigfixInventory.password,
    tlsVerify: config.bigfixInventory.tlsVerify,
    pageSize: config.sync.pageSize,
    ...overrides,
  });
}

/**
 * Pulls computers + software instances from BigFix Inventory and upserts
 * them into the local cache. Only one sync runs at a time; a concurrent
 * call returns the in-flight promise instead of starting a second sync.
 */
export function runSync({ client } = {}) {
  if (syncInFlight) return syncInFlight;

  const promise = (async () => {
    if (!config.bigfixInventory.baseUrl && !client) {
      throw new Error(
        'BIGFIX_INVENTORY_BASE_URL is not configured. Set it in .env before syncing.',
      );
    }

    const runId = recordSyncStart();
    try {
      const bigfix = client || buildClient();

      const computers = await bigfix.fetchAllComputers();
      const computersSynced = upsertComputers(computers);

      const softwareInstances = await bigfix.fetchAllSoftwareInstances();
      const softwareInstancesSynced = upsertSoftwareInstances(softwareInstances);

      recordSyncFinish(runId, {
        status: 'success',
        computersSynced,
        softwareInstancesSynced,
      });

      return { runId, computersSynced, softwareInstancesSynced };
    } catch (err) {
      recordSyncFinish(runId, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  })();

  syncInFlight = promise;
  // Separate handle for cleanup only; .catch(() => {}) prevents this derived
  // promise's rejection from surfacing as an unhandled rejection, since the
  // real rejection is still delivered to whoever awaits the returned `promise`.
  promise
    .finally(() => {
      syncInFlight = null;
    })
    .catch(() => {});
  return promise;
}

export function isSyncRunning() {
  return syncInFlight !== null;
}
