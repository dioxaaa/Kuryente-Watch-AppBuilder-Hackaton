import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import Database from 'better-sqlite3'
import { openDb } from '../server/db.js'
import * as appRepo from '../server/app-repository.js'
import { createApp } from '../server/app.js'

async function withApi(db, callback) {
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const call = async (route, method = 'GET', body) => {
    const response = await fetch(base + route, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    await callback(call)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}

test('local API creates and updates the installation profile and household', async () => {
  const db = openDb(':memory:')
  try {
    await withApi(db, async call => {
      assert.deepEqual((await call('/health')).body, { ok: true, local: true, database: 'ready' })
      assert.deepEqual((await call('/profile')).body, { profile: null })
      assert.equal((await call('/profile', 'POST', { userName: ' ', householdName: 'Home' })).status, 400)
      const created = await call('/profile', 'POST', { userName: '  Ana Cruz ', householdName: '  Casa Cruz ' })
      assert.equal(created.status, 200)
      assert.equal(created.body.profile.userName, 'Ana Cruz')
      assert.equal(created.body.profile.householdName, 'Casa Cruz')
      assert.equal((await call('/profile', 'POST', { userName: 'Second', householdName: 'Home' })).status, 409)
      const updated = await call('/profile', 'PUT', { userName: 'Ana Santos', householdName: 'New Home' })
      assert.equal(updated.body.profile.userName, 'Ana Santos')
      assert.equal(updated.body.profile.householdName, 'New Home')
    })
  } finally {
    db.close()
  }
})

test('cumulative household readings calculate positive deltas and reject decreasing values', async () => {
  const db = openDb(':memory:')
  try {
    await withApi(db, async call => {
      const first = await call('/readings', 'POST', { readingKwh: 100, recordedAt: '2026-10-01T09:00:00.000Z' })
      assert.equal(first.status, 201)
      assert.equal(first.body.reading.usageKwh, null)
      const second = await call('/readings', 'POST', { readingKwh: 145.5, recordedAt: '2026-10-08T09:00:00.000Z' })
      assert.equal(second.status, 201)
      assert.equal(second.body.reading.usageKwh, 45.5)
      assert.equal((await call('/readings')).body[1].usageKwh, 45.5)
      assert.equal((await call('/readings', 'POST', { readingKwh: 140, recordedAt: '2026-10-09T09:00:00.000Z' })).status, 400)
      assert.equal((await call('/readings', 'POST', { readingKwh: 0, recordedAt: '2026-10-09T09:00:00.000Z' })).status, 400)
    })
  } finally {
    db.close()
  }
})

test('appliance CRUD validates fields and returns not found for missing IDs', async () => {
  const db = openDb(':memory:')
  try {
    await withApi(db, async call => {
      assert.equal((await call('/appliances', 'POST', { name: '', ratedWatts: -1, hoursPerDay: 30 })).status, 400)
      const created = await call('/appliances', 'POST', {
        name: 'Desk fan', category: 'Electric fan', ratedWatts: 55, hoursPerDay: 8,
      })
      assert.equal(created.status, 201)
      const id = created.body.appliance.id
      assert.equal(created.body.appliance.ratedWatts, 55)
      const updated = await call(`/appliances/${id}`, 'PUT', {
        name: 'Study fan', category: 'Electric fan', ratedWatts: 60, hoursPerDay: 6,
      })
      assert.equal(updated.body.appliance.name, 'Study fan')
      assert.equal((await call(`/appliances/${id}`, 'DELETE')).body.deleted, true)
      assert.equal((await call(`/appliances/${id}`, 'DELETE')).status, 404)
    })
  } finally {
    db.close()
  }
})

test('settings persist through reopening the SQLite file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kuryentewatch-api-'))
  const filename = path.join(directory, 'test.db')
  let db = openDb(filename)
  try {
    await withApi(db, async call => {
      const updated = await call('/settings', 'PUT', { ratePerKwh: 14.25, compact: true })
      assert.equal(updated.body.settings.ratePerKwh, 14.25)
      assert.equal(updated.body.settings.compact, true)
      assert.equal((await call('/settings', 'PUT', { ratePerKwh: -3 })).status, 400)
    })
    db.close()
    db = openDb(filename)
    assert.equal(appRepo.getAppSettings(db).ratePerKwh, 14.25)
    assert.equal(appRepo.getAppSettings(db).compact, true)
  } finally {
    db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('profile reset does not delete meter or appliance records', async () => {
  const db = openDb(':memory:')
  try {
    appRepo.createProfile(db, { userName: 'Test', householdName: 'House' })
    appRepo.createMeterReading(db, { readingKwh: 10, recordedAt: '2026-10-01T00:00:00.000Z', notes: '' })
    appRepo.createAppliance(db, { name: 'Fan', category: 'Electric fan', ratedWatts: 30, hoursPerDay: 2, usagePattern: 'Daily', brand: '', model: '' })
    await withApi(db, async call => {
      assert.equal((await call('/profile', 'DELETE')).body.retainedRecords, true)
      assert.deepEqual((await call('/profile')).body, { profile: null })
      assert.equal((await call('/readings')).body.length, 1)
      assert.equal((await call('/appliances')).body.length, 1)
    })
  } finally {
    db.close()
  }
})

test('schema migration preserves existing appliance rows and imports legacy energy rate', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kuryentewatch-migration-'))
  const filename = path.join(directory, 'legacy.db')
  const legacyDb = new Database(filename)
  legacyDb.exec(`
    CREATE TABLE appliances (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other',
      watts REAL NOT NULL, hours REAL NOT NULL, pattern TEXT NOT NULL DEFAULT 'Daily',
      brand TEXT, model TEXT, sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO appliances VALUES ('existing-sample', 'Existing sample fan', 'Electric fan', 50, 8, 'Daily', NULL, NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    INSERT INTO settings VALUES ('rate', '14.75');
  `)
  legacyDb.close()
  const migrated = openDb(filename)
  try {
    const [appliance] = appRepo.listAppliances(migrated)
    assert.equal(appliance.id, 'existing-sample')
    assert.equal(appliance.ratedWatts, 50)
    assert.equal(appliance.hoursPerDay, 8)
    assert.equal(appliance.usagePattern, 'Daily')
    assert.equal(appliance.isSample, 1)
    assert.equal(appRepo.getAppSettings(migrated).ratePerKwh, 14.75)
  } finally {
    migrated.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
