import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
process.env.API_KEY = 'test-api-key';

const { createApp } = await import('../src/app.js');
const { upsertComputers, upsertSoftwareInstances } = await import('../src/db.js');

upsertComputers([
  { id: '1', name: 'win11-01', osName: 'Windows', osVersion: '11', raw: {} },
]);
upsertSoftwareInstances([
  { id: 'si-1', computerId: '1', name: 'CrowdStrike', version: '7.2', raw: {} },
]);

async function withServer(run) {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /health does not require auth', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('GET /api/reports/computers rejects requests without a valid API key', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/reports/computers`);
    assert.equal(res.status, 401);
  });
});

test('GET /api/reports/computers returns synced data with a valid API key', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/reports/computers`, {
      headers: { Authorization: 'Bearer test-api-key' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.total, 1);
    assert.equal(body.computers[0].name, 'win11-01');
  });
});

test('GET /api/reports/security-agents reports installed agents per computer', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/reports/security-agents?names=CrowdStrike,Trellix`, {
      headers: { Authorization: 'Bearer test-api-key' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.computers.length, 1);
    assert.equal(body.computers[0].agents.CrowdStrike, true);
    assert.equal(body.computers[0].agents.Trellix, false);
  });
});
