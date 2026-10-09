// SQLite database (single local file). Data stays on this machine.
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_DB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'kuryentewatch.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS household (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  household_name TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_profile (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  user_name    TEXT NOT NULL,
  household_id INTEGER NOT NULL REFERENCES household(id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meter_readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_kwh REAL NOT NULL CHECK (reading_kwh > 0),
  recorded_at TEXT NOT NULL UNIQUE,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meter_readings_recorded_at ON meter_readings(recorded_at);
CREATE TABLE IF NOT EXISTS appliances (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other',
  watts         REAL NOT NULL,
  hours         REAL NOT NULL,
  pattern       TEXT NOT NULL DEFAULT 'Daily',
  brand         TEXT,
  model         TEXT,
  sample        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  rated_watts   REAL,
  hours_per_day REAL,
  usage_pattern TEXT
);
CREATE INDEX IF NOT EXISTS idx_appliances_name ON appliances(name);
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
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
export function openDb(file = process.env.KURYENTE_DB || DEFAULT_DB) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  migrateAlerts(db)
  migrateAppliances(db)
  // Databases created before the replaced-meter option do not have this column yet.
  if (!db.prepare('PRAGMA table_info(meter_readings)').all().some(c => c.name === 'is_reset')) db.exec('ALTER TABLE meter_readings ADD COLUMN is_reset INTEGER NOT NULL DEFAULT 0')
  // Databases created before AI explanations do not have these columns yet.
  const alertCols = db.prepare('PRAGMA table_info(alerts)').all().map(c => c.name)
  if (!alertCols.includes('ai_explanation')) db.exec('ALTER TABLE alerts ADD COLUMN ai_explanation TEXT')
  if (!alertCols.includes('ai_model')) db.exec('ALTER TABLE alerts ADD COLUMN ai_model TEXT')
  return db
}

function migrateAlerts(db) {
  const columns = new Set(db.pragma('table_info(alerts)').map(column => column.name))
  if (!columns.has('title')) db.exec('ALTER TABLE alerts ADD COLUMN title TEXT')
  if (!columns.has('message')) db.exec('ALTER TABLE alerts ADD COLUMN message TEXT')
  if (!columns.has('is_read')) db.exec('ALTER TABLE alerts ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0')
  if (columns.has('read')) db.exec('UPDATE alerts SET is_read = read WHERE is_read != read')
}

function migrateAppliances(db) {
  const columns = new Set(db.pragma('table_info(appliances)').map(column => column.name))
  if (!columns.has('rated_watts')) db.exec('ALTER TABLE appliances ADD COLUMN rated_watts REAL')
  if (!columns.has('hours_per_day')) db.exec('ALTER TABLE appliances ADD COLUMN hours_per_day REAL')
  if (!columns.has('usage_pattern')) db.exec('ALTER TABLE appliances ADD COLUMN usage_pattern TEXT')

  const refreshed = new Set(db.pragma('table_info(appliances)').map(column => column.name))
  if (refreshed.has('watts')) db.exec('UPDATE appliances SET rated_watts = watts WHERE rated_watts IS NULL')
  if (refreshed.has('hours')) db.exec('UPDATE appliances SET hours_per_day = hours WHERE hours_per_day IS NULL')
  if (refreshed.has('pattern')) db.exec('UPDATE appliances SET usage_pattern = pattern WHERE usage_pattern IS NULL')

  if (!db.prepare('SELECT 1 FROM app_settings WHERE key = ?').get('ratePerKwh')) {
    const legacyRate = db.prepare('SELECT value FROM settings WHERE key = ?').get('rate')
    if (legacyRate) {
      try {
        const value = JSON.parse(legacyRate.value)
        if (Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1000) {
          db.prepare('INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)')
            .run('ratePerKwh', JSON.stringify(Number(value)), new Date().toISOString())
        }
      } catch {
        console.warn('Skipped an unreadable legacy electricity-rate setting; the new default will be used.')
      }
    }
  }
}