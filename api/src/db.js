import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS computers (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  os_name         TEXT,
  os_version      TEXT,
  ip_address      TEXT,
  domain          TEXT,
  last_scan_date  TEXT,
  raw_json        TEXT,
  synced_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS software_instances (
  id              TEXT PRIMARY KEY,
  computer_id     TEXT NOT NULL,
  software_id     TEXT,
  name            TEXT,
  version         TEXT,
  publisher       TEXT,
  category        TEXT,
  raw_json        TEXT,
  synced_at       TEXT NOT NULL,
  FOREIGN KEY (computer_id) REFERENCES computers(id)
);
CREATE INDEX IF NOT EXISTS idx_software_instances_computer
  ON software_instances (computer_id);
CREATE INDEX IF NOT EXISTS idx_software_instances_name
  ON software_instances (name);

CREATE TABLE IF NOT EXISTS sync_runs (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at                TEXT NOT NULL,
  finished_at               TEXT,
  status                    TEXT NOT NULL,
  computers_synced          INTEGER DEFAULT 0,
  software_instances_synced INTEGER DEFAULT 0,
  error_message             TEXT
);
`;

let db;

export function getDb() {
  if (!db) {
    const resolved = path.resolve(config.dbPath);
    if (resolved !== ':memory:') {
      mkdirSync(path.dirname(resolved), { recursive: true });
    }
    db = new DatabaseSync(config.dbPath === ':memory:' ? ':memory:' : resolved);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

export function upsertComputers(computers) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO computers (id, name, os_name, os_version, ip_address, domain, last_scan_date, raw_json, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      os_name = excluded.os_name,
      os_version = excluded.os_version,
      ip_address = excluded.ip_address,
      domain = excluded.domain,
      last_scan_date = excluded.last_scan_date,
      raw_json = excluded.raw_json,
      synced_at = excluded.synced_at
  `);
  const syncedAt = new Date().toISOString();

  function insertOne(c) {
    stmt.run(
      c.id,
      c.name ?? null,
      c.osName ?? null,
      c.osVersion ?? null,
      c.ipAddress ?? null,
      c.domain ?? null,
      c.lastScanDate ?? null,
      JSON.stringify(c.raw ?? {}),
      syncedAt,
    );
  }

  database.exec('BEGIN');
  try {
    for (const c of computers) insertOne(c);
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
  return computers.length;
}

export function upsertSoftwareInstances(instances) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO software_instances (id, computer_id, software_id, name, version, publisher, category, raw_json, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      computer_id = excluded.computer_id,
      software_id = excluded.software_id,
      name = excluded.name,
      version = excluded.version,
      publisher = excluded.publisher,
      category = excluded.category,
      raw_json = excluded.raw_json,
      synced_at = excluded.synced_at
  `);
  const syncedAt = new Date().toISOString();
  database.exec('BEGIN');
  try {
    for (const s of instances) {
      stmt.run(
        s.id,
        s.computerId,
        s.softwareId ?? null,
        s.name ?? null,
        s.version ?? null,
        s.publisher ?? null,
        s.category ?? null,
        JSON.stringify(s.raw ?? {}),
        syncedAt,
      );
    }
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
  return instances.length;
}

export function listComputers({ limit = 100, offset = 0 } = {}) {
  const database = getDb();
  const stmt = database.prepare(
    'SELECT * FROM computers ORDER BY name LIMIT ? OFFSET ?',
  );
  return stmt.all(limit, offset);
}

export function countComputers() {
  const database = getDb();
  return database.prepare('SELECT COUNT(*) AS count FROM computers').get().count;
}

export function listSoftwareInstances({ computerId, name, limit = 100, offset = 0 } = {}) {
  const database = getDb();
  const clauses = [];
  const params = [];
  if (computerId) {
    clauses.push('computer_id = ?');
    params.push(computerId);
  }
  if (name) {
    clauses.push('name LIKE ?');
    params.push(`%${name}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const stmt = database.prepare(
    `SELECT * FROM software_instances ${where} ORDER BY name LIMIT ? OFFSET ?`,
  );
  return stmt.all(...params, limit, offset);
}

export function getOsVersionSummary() {
  const database = getDb();
  return database
    .prepare(
      `SELECT os_name, os_version, COUNT(*) AS count
       FROM computers
       GROUP BY os_name, os_version
       ORDER BY os_name, os_version`,
    )
    .all();
}

export function getSoftwarePresenceSummary(softwareNames) {
  const database = getDb();
  const placeholders = softwareNames.map(() => '?').join(', ');
  return database
    .prepare(
      `SELECT c.id AS computer_id, c.name AS computer_name, s.name AS software_name
       FROM computers c
       JOIN software_instances s ON s.computer_id = c.id
       WHERE s.name IN (${placeholders})`,
    )
    .all(...softwareNames);
}

export function recordSyncStart() {
  const database = getDb();
  const startedAt = new Date().toISOString();
  const result = database
    .prepare(
      `INSERT INTO sync_runs (started_at, status) VALUES (?, 'running')`,
    )
    .run(startedAt);
  return Number(result.lastInsertRowid);
}

export function recordSyncFinish(id, { status, computersSynced = 0, softwareInstancesSynced = 0, errorMessage = null }) {
  const database = getDb();
  database
    .prepare(
      `UPDATE sync_runs
       SET finished_at = ?, status = ?, computers_synced = ?, software_instances_synced = ?, error_message = ?
       WHERE id = ?`,
    )
    .run(new Date().toISOString(), status, computersSynced, softwareInstancesSynced, errorMessage, id);
}

export function getLatestSyncRun() {
  const database = getDb();
  return database
    .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1')
    .get();
}

export function listSyncRuns({ limit = 20 } = {}) {
  const database = getDb();
  return database
    .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?')
    .all(limit);
}
