import test from 'node:test'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.js'
import * as repo from '../server/repository.js'
import { trainDevice, scanDevice, deviceChart } from '../server/service.js'
import { createApp } from '../server/app.js'
import { generateFridgeReadings, injectAnomaly } from '../src/engine/index.js'

const db = openDb(':memory:')
test.beforeEach(() => repo.clearAllData(db))

// 7 normal days to learn from, then a day with a sustained problem, scanned into a real alert.
function seed() {
  repo.saveDevice(db, { name: 'refrigerator', label: 'Family refrigerator', category: 'Refrigerator', ratedWatts: 140 })
  repo.saveReadings(db, generateFridgeReadings({ days: 7, seed: 42, start: '2026-10-01T00:00:00' }))
  trainDevice(db, 'refrigerator')
  const today = generateFridgeReadings({ days: 1, seed: 99, start: '2026-10-08T00:00:00' })
  repo.saveReadings(db, injectAnomaly(today, { type: 'sustained', startIndex: 150, lengthSamples: 18 }))
  scanDevice(db, 'refrigerator', { from: '2026-10-08T00:00:00' })
  return repo.listAlerts(db)[0]
}

test('chart around an alert has the band, flags the alert window and finds the same event', () => {
  const alert = seed()
  const chart = deviceChart(db, 'refrigerator', { alertId: alert.id })
  assert.equal(chart.label, 'Family refrigerator')
  assert.equal(chart.focus.id, alert.id)
  assert.ok(chart.points.length > 50)
  assert.ok(chart.points.every(p => p.low >= 0 && p.high > p.low), 'every point has a usable normal band')
  assert.ok(chart.points[0].t >= chart.from && chart.points.at(-1).t <= chart.to)
  const event = chart.events.find(e => e.id === alert.id)
  assert.ok(event, 'the chart finds the stored alert')
  const flagged = chart.points.filter(p => p.state === 'high')
  assert.ok(flagged.length > 0 && flagged.every(p => p.t >= event.start && p.t <= event.end), 'flagged points sit inside the alert')
  const inside = chart.points.filter(p => p.t >= event.start && p.t <= event.end)
  assert.ok(inside.every(p => p.avg > p.high), 'during the alert the average is above the normal band')
})

test('the 1-hour average is warmed up at the left edge of the window', () => {
  const alert = seed()
  const { points, windowMin } = deviceChart(db, 'refrigerator', { alertId: alert.id })
  assert.ok(windowMin >= 60)
  assert.ok(points[0].avg > 10 && points[0].avg < 120, `first average ${points[0].avg} should be a real 1-hour mean, not a ramp from zero`)
})

test('without an alert it shows the latest hours; a quiet window has no events', () => {
  seed()
  const chart = deviceChart(db, 'refrigerator', { hours: 3, to: '2026-10-05T12:00:00' })
  assert.equal(chart.events.length, 0)
  assert.equal(chart.to, '2026-10-05T12:00:00')
  assert.equal(chart.points.length, 3 * 12 + 1)
  const latest = deviceChart(db, 'refrigerator')
  assert.equal(latest.to, repo.latestReadingTime(db, 'refrigerator'))
})

test('chart errors are clear: no baseline, unknown alert', () => {
  assert.throws(() => deviceChart(db, 'nothing'), err => err.status === 404 && /Train it first/.test(err.message))
  seed()
  assert.throws(() => deviceChart(db, 'refrigerator', { alertId: 'nope' }), err => err.status === 404 && /Alert not found/.test(err.message))
})

test('HTTP: GET /api/devices/:name/chart', async () => {
  const alert = seed()
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  try {
    const ok = await fetch(`${base}/devices/refrigerator/chart?alertId=${encodeURIComponent(alert.id)}`)
    assert.equal(ok.status, 200)
    const body = await ok.json()
    assert.ok(body.points.length > 0 && body.events.some(e => e.id === alert.id))
    const missing = await fetch(`${base}/devices/ghost/chart`)
    assert.equal(missing.status, 404)
    assert.match((await missing.json()).error, /No baseline/)
  } finally { server.closeAllConnections(); server.close() }
})
