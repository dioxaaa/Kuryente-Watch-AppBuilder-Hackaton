import test from 'node:test'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.js'
import * as repo from '../server/repository.js'
import { createApp } from '../server/app.js'

const db = openDb(':memory:')
test.beforeEach(() => repo.clearAllData(db))

async function withApi(fn) {
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(base + path, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: res.status, body: await res.json() }
  }
  try { await fn(call) } finally { server.closeAllConnections(); server.close() }
}

test('meter readings are saved, listed oldest first, and survive across requests', async () => {
  await withApi(async call => {
    assert.deepEqual((await call('/meter-readings')).body, [])
    await call('/meter-readings', 'POST', { kwh: '3012.5', date: '2026-10-09T09:00:00.000Z' })
    await call('/meter-readings', 'POST', { kwh: 2967, date: '2026-10-02T09:00:00.000Z' })
    const list = (await call('/meter-readings')).body
    assert.deepEqual(list.map(r => r.kwh), [2967, 3012.5])
    assert.equal(list[0].source, 'Manual entry')
  })
})

test('a bad meter reading is rejected with a readable message', async () => {
  await withApi(async call => {
    for (const bad of [{ kwh: 0, date: '2026-10-09' }, { kwh: 'abc', date: '2026-10-09' }, { kwh: 10, date: 'nope' }]) {
      const r = await call('/meter-readings', 'POST', bad)
      assert.equal(r.status, 400)
      assert.ok(r.body.error)
    }
    assert.equal((await call('/meter-readings')).body.length, 0)
  })
})

test('re-sending the same reading id does not duplicate it (one-time browser import is safe to retry)', async () => {
  await withApi(async call => {
    const body = { id: 'entry-1', kwh: 100, date: '2026-10-01T00:00:00.000Z' }
    await call('/meter-readings', 'POST', body)
    await call('/meter-readings', 'POST', body)
    assert.equal((await call('/meter-readings')).body.length, 1)
  })
})

test('settings are stored in the database', async () => {
  await withApi(async call => {
    assert.equal((await call('/settings/preferences')).body.value, null)
    await call('/settings/preferences', 'PUT', { value: { rate: 11.2, household: 'Dela Cruz' } })
    assert.deepEqual((await call('/settings/preferences')).body.value, { rate: 11.2, household: 'Dela Cruz' })
  })
})

test('a reading must fit between the readings before and after its date', async () => {
  await withApi(async call => {
    await call('/meter-readings', 'POST', { kwh: 3000, date: '2026-10-02T09:00:00.000Z' })
    await call('/meter-readings', 'POST', { kwh: 3050, date: '2026-10-09T09:00:00.000Z' })
    const lower = await call('/meter-readings', 'POST', { kwh: 2990, date: '2026-10-10T09:00:00.000Z' })
    assert.equal(lower.status, 400)
    assert.match(lower.body.error, /lower than your earlier reading/)
    // backdated reading that fits in between is allowed, even though it is lower than the newest one
    assert.equal((await call('/meter-readings', 'POST', { kwh: 3020, date: '2026-10-05T09:00:00.000Z' })).status, 200)
    // backdated reading that is higher than a later one is not
    const tooHigh = await call('/meter-readings', 'POST', { kwh: 3100, date: '2026-10-06T09:00:00.000Z' })
    assert.equal(tooHigh.status, 400)
    assert.match(tooHigh.body.error, /higher than your later reading/)
    assert.equal((await call('/meter-readings')).body.length, 3)
  })
})

test('a new or replaced meter can start lower, and later readings compare with it', async () => {
  await withApi(async call => {
    await call('/meter-readings', 'POST', { kwh: 9000, date: '2026-10-01T09:00:00.000Z' })
    assert.equal((await call('/meter-readings', 'POST', { kwh: 5, date: '2026-10-08T09:00:00.000Z', reset: true })).body.reset, true)
    assert.equal((await call('/meter-readings', 'POST', { kwh: 30, date: '2026-10-09T09:00:00.000Z' })).status, 200)
    assert.equal((await call('/meter-readings', 'POST', { kwh: 20, date: '2026-10-10T09:00:00.000Z' })).status, 400)
  })
})

test('a database made before the replaced-meter option is upgraded without losing readings', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kw-')), 'old.db')
  const old = new DatabaseSync(file)
  old.exec("CREATE TABLE meter_readings (id TEXT PRIMARY KEY, kwh REAL NOT NULL, recorded_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'Manual entry', created_at TEXT NOT NULL)")
  old.prepare("INSERT INTO meter_readings VALUES ('a', 100, '2026-10-01T00:00:00.000Z', 'Manual entry', 'x')").run()
  old.close()
  const upgraded = openDb(file)
  assert.deepEqual(repo.listMeterReadings(upgraded).map(r => [r.kwh, r.reset]), [[100, false]])
})