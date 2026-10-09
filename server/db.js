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
  dismissed  INTEGER NOT NULL DEFAULT 0,
  ai_explanation TEXT,               -- cached plain-language explanation from the local AI
  ai_model       TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_device_start ON alerts(device, start);
CREATE TABLE IF NOT EXISTS appliances (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Other',
  watts      REAL NOT NULL,          -- rated power from the label
  hours      REAL NOT NULL,          -- hours used per day
  pattern    TEXT NOT NULL DEFAULT 'Daily',
  brand      TEXT,
  model      TEXT,
  sample     INTEGER NOT NULL DEFAULT 0, -- 1 = built-in example, 0 = added by the user
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meter_readings (
  id          TEXT PRIMARY KEY,
  kwh         REAL NOT NULL,         -- value shown on the household meter
  recorded_at TEXT NOT NULL,         -- ISO string, when the meter was read
  source      TEXT NOT NULL DEFAULT 'Manual entry',
  created_at  TEXT NOT NULL,
  is_reset    INTEGER NOT NULL DEFAULT 0 -- 1 = new or replaced meter, counting starts over
);
CREATE INDEX IF NOT EXISTS idx_meter_readings_time ON meter_readings(recorded_at);
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
  // Databases created before the replaced-meter option do not have this column yet.
  if (!db.prepare('PRAGMA table_info(meter_readings)').all().some(c => c.name === 'is_reset')) db.exec('ALTER TABLE meter_readings ADD COLUMN is_reset INTEGER NOT NULL DEFAULT 0')
  // Databases created before AI explanations do not have these columns yet.
  const alertCols = db.prepare('PRAGMA table_info(alerts)').all().map(c => c.name)
  if (!alertCols.includes('ai_explanation')) db.exec('ALTER TABLE alerts ADD COLUMN ai_explanation TEXT')
  if (!alertCols.includes('ai_model')) db.exec('ALTER TABLE alerts ADD COLUMN ai_model TEXT')
  return db
}