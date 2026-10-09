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