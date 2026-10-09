// SQLite database (single local file). Data stays on this machine.
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (
  name        TEXT PRIMARY KEY,
  label       TEXT,
  category    TEXT,
  rated_watts REAL,
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS readings (
  device    TEXT NOT NULL REFERENCES devices(name) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,           -- ISO string, sorts correctly as text
  watts     REAL NOT NULL,
  PRIMARY KEY (device, timestamp)    -- re-importing the same reading overwrites it
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS baselines (
  device     TEXT PRIMARY KEY REFERENCES devices(name) ON DELETE CASCADE,
  data       TEXT NOT NULL,          -- baseline JSON from the detector
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id         TEXT PRIMARY KEY,       -- device|type|start  (dedupes re-scans)
  device     TEXT NOT NULL REFERENCES devices(name) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  severity   TEXT,
  start      TEXT NOT NULL,
  data       TEXT NOT NULL,          -- full event JSON from the detector
  created_at TEXT NOT NULL,
  read       INTEGER NOT NULL DEFAULT 0,
  dismissed  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_alerts_device_start ON alerts(device, start);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                -- JSON
);
`

// file: path to the .db file, or ':memory:' for tests.
export function openDb(file = process.env.KURYENTE_DB || 'data/kuryentewatch.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}