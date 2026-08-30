import test from 'node:test';
import assert from 'node:assert/strict';
import { BigFixInventoryClient } from '../src/bigfixInventory/client.js';

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test('fetchAllComputers pages through results and maps fields defensively', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url.toString());
    const offset = Number(new URL(url).searchParams.get('offset'));
    if (offset === 0) {
      return jsonResponse({
        total: 3,
        data: [
          { computerId: 1, computerName: 'host-a', os: 'Windows', osVersion: '11', ip: '10.0.0.1' },
          { id: 2, name: 'host-b', osName: 'RHEL', os_version: '9.3' },
        ],
      });
    }
    return jsonResponse({ total: 3, data: [{ id: 3, name: 'host-c', osName: 'AIX', osVersion: '7.3' }] });
  };

  const client = new BigFixInventoryClient({
    baseUrl: 'https://bfi.example.com:9081/api/v1',
    token: 'test-token',
    pageSize: 2,
    fetchImpl,
  });

  const computers = await client.fetchAllComputers();

  assert.equal(computers.length, 3);
  assert.deepEqual(
    computers.map((c) => c.id),
    ['1', '2', '3'],
  );
  assert.equal(computers[0].name, 'host-a');
  assert.equal(computers[0].osVersion, '11');
  assert.equal(computers[1].osVersion, '9.3');
  // token must be appended as a query param on every request
  assert.ok(calls.every((u) => u.includes('token=test-token')));
  assert.equal(calls.length, 2);
});

test('throws a descriptive BigFixInventoryError on 4xx without retrying', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    return jsonResponse({ message: 'bad token' }, { status: 401 });
  };

  const client = new BigFixInventoryClient({
    baseUrl: 'https://bfi.example.com:9081/api/v1',
    token: 'bad',
    fetchImpl,
  });

  await assert.rejects(() => client.fetchAllComputers(), /401/);
  assert.equal(attempts, 1);
});

test('retries on 5xx then succeeds', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 2) return jsonResponse({}, { status: 503 });
    return jsonResponse({ total: 0, data: [] });
  };

  const client = new BigFixInventoryClient({
    baseUrl: 'https://bfi.example.com:9081/api/v1',
    username: 'svc',
    password: 'secret',
    fetchImpl,
  });

  const computers = await client.fetchAllComputers();
  assert.deepEqual(computers, []);
  assert.equal(attempts, 2);
});

test('uses HTTP Basic auth when no token is configured', async () => {
  let seenAuth;
  const fetchImpl = async (url, opts) => {
    seenAuth = opts.headers.Authorization;
    return jsonResponse({ total: 0, data: [] });
  };

  const client = new BigFixInventoryClient({
    baseUrl: 'https://bfi.example.com:9081/api/v1',
    username: 'svc',
    password: 'secret',
    fetchImpl,
  });

  await client.fetchAllComputers();
  assert.equal(seenAuth, `Basic ${Buffer.from('svc:secret').toString('base64')}`);
});
