import test from 'node:test'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.js'
import * as repo from '../server/repository.js'
import { trainDevice, scanDevice } from '../server/service.js'
import { createApp } from '../server/app.js'
import { generateFridgeReadings, injectAnomaly } from '../src/engine/index.js'

const db = openDb(':memory:')
test.beforeEach(() => repo.clearAllData(db))

test('readings persist, sort by time, and re-import does not duplicate', () => {
  const r = generateFridgeReadings({ days: 1, seed: 1 })
  repo.saveReadings(db, r.slice().reverse())
  repo.saveReadings(db, r)
  assert.equal(repo.countReadings(db, 'refrigerator'), r.length)
  assert.deepEqual(repo.getReadings(db, 'refrigerator').map(x => x.timestamp), r.map(x => x.timestamp))
})

test('getReadings filters by date range and limit', () => {
  repo.saveReadings(db, generateFridgeReadings({ days: 2, seed: 1, start: '2026-10-01T00:00:00' }))
  const day2 = repo.getReadings(db, 'refrigerator', { from: '2026-10-02T00:00:00', to: '2026-10-02T23:59:59' })
  assert.ok(day2.length > 0 && day2.every(x => x.timestamp.startsWith('2026-10-02')))
  assert.equal(repo.getReadings(db, 'refrigerator', { limit: 10 }).length, 10)
})

test('train -> inject anomaly -> scan stores alerts; rescan keeps read state, no duplicates', () => {
  repo.saveDevice(db, { name: 'refrigerator', label: 'Family fridge' })
  repo.saveReadings(db, generateFridgeReadings({ days: 7, seed: 42 }))
  trainDevice(db, 'refrigerator')
  assert.equal(repo.getBaseline(db, 'refrigerator').device, 'refrigerator')

  const fresh = generateFridgeReadings({ days: 2, seed: 99, start: '2026-10-08T00:00:00' })
  repo.saveReadings(db, injectAnomaly(fresh, { type: 'sustained', startIndex: 300, lengthSamples: 18 }))
  const range = { from: '2026-10-08T00:00:00' }
  const first = scanDevice(db, 'refrigerator', range)
  assert.ok(first.newAlerts >= 1)

  const [alert] = repo.listAlerts(db)
  assert.match(alert.explanation, /unusual compared with the readings stored on this device/)
  repo.updateAlert(db, alert.id, { read: true })
  assert.equal(scanDevice(db, 'refrigerator', range).newAlerts, 0)
  assert.equal(repo.listAlerts(db).length, first.events.length)
  assert.equal(repo.listAlerts(db)[0].read, true)
  assert.equal(repo.unreadAlertCount(db), first.events.length - 1)
})

test('scan without a baseline gives a clear error', () => {
  assert.throws(() => scanDevice(db, 'nothing'), /Train it first/)
})

test('dismissed alerts hidden by default; deleteDevice cascades', () => {
  repo.saveReadings(db, generateFridgeReadings({ days: 7, seed: 5, device: 'fan' }))
  trainDevice(db, 'fan')
  repo.saveAlerts(db, 'fan', [{ type: 'spike', start: '2026-10-01T01:00:00' }])
  const [a] = repo.listAlerts(db)
  repo.updateAlert(db, a.id, { dismissed: true })
  assert.equal(repo.listAlerts(db).length, 0)
  assert.equal(repo.listAlerts(db, { includeDismissed: true }).length, 1)
  assert.equal(repo.deleteDevice(db, 'fan'), true)
  assert.equal(repo.countReadings(db, 'fan'), 0)
  assert.equal(repo.getBaseline(db, 'fan'), undefined)
  assert.equal(repo.listAlerts(db, { includeDismissed: true }).length, 0)
})

test('settings round-trip with fallback', () => {
  assert.equal(repo.getSetting(db, 'rate', 12.5), 12.5)
  repo.setSetting(db, 'rate', 13.2)
  assert.equal(repo.getSetting(db, 'rate', 12.5), 13.2)
})

test('HTTP API: import -> train -> scan -> alerts -> mark read', async () => {
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })
    return { status: res.status, body: await res.json() }
  }
  try {
    assert.equal((await call('/health')).body.local, true)
    assert.equal((await call('/readings', 'POST', generateFridgeReadings({ days: 7, seed: 42 }))).body.saved, 2016)
    assert.equal((await call('/devices/refrigerator/train', 'POST')).status, 200)
    const fresh = injectAnomaly(generateFridgeReadings({ days: 2, seed: 99, start: '2026-10-08T00:00:00' }), { type: 'sustained', startIndex: 300, lengthSamples: 18 })
    await call('/readings', 'POST', fresh)
    const scan = await call('/devices/refrigerator/scan', 'POST', { from: '2026-10-08T00:00:00' })
    assert.ok(scan.body.newAlerts >= 1)
    const alerts = (await call('/alerts')).body
    assert.ok(alerts.length >= 1)
    await call(`/alerts/${encodeURIComponent(alerts[0].id)}`, 'PATCH', { read: true })
    assert.equal((await call('/alerts/unread-count')).body.count, alerts.length - 1)
    // validation + error paths
    assert.equal((await call('/readings', 'POST', [{ device: 'x' }])).status, 400)
    assert.equal((await call('/devices/ghost/scan', 'POST')).status, 400)
    assert.equal((await call('/devices/ghost/baseline')).status, 404)
  } finally { server.closeAllConnections(); server.close() }
})