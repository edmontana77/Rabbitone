import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
process.env.API_KEY = '';

const { runSync } = await import('../src/syncService.js');
const { listComputers, listSoftwareInstances, getLatestSyncRun, getSoftwarePresenceSummary } = await import('../src/db.js');

function fakeClient({ computers, softwareInstances }) {
  return {
    fetchAllComputers: async () => computers,
    fetchAllSoftwareInstances: async () => softwareInstances,
  };
}

test('runSync upserts computers and software instances and records history', async () => {
  const client = fakeClient({
    computers: [
      { id: '1', name: 'win11-01', osName: 'Windows', osVersion: '11', raw: {} },
      { id: '2', name: 'rhel-01', osName: 'RHEL', osVersion: '9.3', raw: {} },
    ],
    softwareInstances: [
      { id: 'si-1', computerId: '1', name: 'CrowdStrike', version: '7.2', raw: {} },
      { id: 'si-2', computerId: '2', name: 'BES Client', version: '11.0', raw: {} },
    ],
  });

  const result = await runSync({ client });

  assert.equal(result.computersSynced, 2);
  assert.equal(result.softwareInstancesSynced, 2);

  const computers = listComputers();
  assert.equal(computers.length, 2);
  assert.equal(computers.find((c) => c.id === '1').os_version, '11');

  const software = listSoftwareInstances({ computerId: '1' });
  assert.equal(software.length, 1);
  assert.equal(software[0].name, 'CrowdStrike');

  const latestRun = getLatestSyncRun();
  assert.equal(latestRun.status, 'success');
  assert.equal(latestRun.computers_synced, 2);

  const presence = getSoftwarePresenceSummary(['CrowdStrike', 'BES Client']);
  assert.equal(presence.length, 2);
});

test('runSync records an error run when the BigFix client throws', async () => {
  const client = {
    fetchAllComputers: async () => {
      throw new Error('connection refused');
    },
    fetchAllSoftwareInstances: async () => [],
  };

  await assert.rejects(() => runSync({ client }), /connection refused/);

  const latestRun = getLatestSyncRun();
  assert.equal(latestRun.status, 'error');
  assert.match(latestRun.error_message, /connection refused/);
});

test('a second concurrent runSync call reuses the in-flight sync', async () => {
  let resolveFetch;
  const slowClient = {
    fetchAllComputers: () =>
      new Promise((resolve) => {
        resolveFetch = () => resolve([]);
      }),
    fetchAllSoftwareInstances: async () => [],
  };

  const first = runSync({ client: slowClient });
  const second = runSync({ client: slowClient });
  assert.equal(first, second);
  resolveFetch();
  await first;
});
