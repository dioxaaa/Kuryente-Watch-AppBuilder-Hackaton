import test from 'node:test'
import assert from 'node:assert/strict'
import { generateFridgeReadings, injectAnomaly, learnBaseline, detect } from '../src/engine/index.js'

const normal = generateFridgeReadings({ days: 7, seed: 42 })
const baseline = learnBaseline(normal)
const fresh = () => generateFridgeReadings({ days: 2, seed: 99, start: '2026-10-08T00:00:00' })

test('no false alerts on fresh normal data (5 different seeds)', () => {
  for (const seed of [99, 100, 101, 102, 103]) {
    const { events } = detect(generateFridgeReadings({ days: 2, seed, start: '2026-10-08T00:00:00' }), baseline)
    assert.equal(events.length, 0, `seed ${seed}: ${JSON.stringify(events)}`)
  }
})

test('detects sustained high draw (compressor never rests)', () => {
  const data = injectAnomaly(fresh(), { type: 'sustained', startIndex: 12 * 24, lengthSamples: 18 }) // 90 min
  const { events } = detect(data, baseline)
  const ev = events.find(e => e.type === 'sustained-high')
  assert.ok(ev, 'expected sustained-high event')
  assert.ok(ev.durationMin >= 20)
  assert.match(ev.explanation, /unusual compared with the readings stored on this device/)
})

test('detects spike', () => {
  const data = injectAnomaly(fresh(), { type: 'spike', startIndex: 300, lengthSamples: 1 })
  assert.ok(detect(data, baseline).events.some(e => e.type === 'spike'))
})

test('detects stuck-off flatline', () => {
  const data = injectAnomaly(fresh(), { type: 'stuck-off', startIndex: 12 * 24, lengthSamples: 24 })
  assert.ok(detect(data, baseline).events.some(e => e.type === 'sustained-low'))
})

test('baseline is JSON-serializable', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(baseline)), baseline)
})
test('simulated timestamps are the same wall-clock text on every computer, whatever its time zone', () => {
  const original = process.env.TZ
  try {
    for (const tz of ['UTC', 'Asia/Manila', 'America/New_York']) {
      process.env.TZ = tz
      const r = generateFridgeReadings({ days: 1, start: '2026-10-08T00:00:00', seed: 99 })
      assert.equal(r[0].timestamp, '2026-10-08T00:00:00', tz)
      assert.equal(r[r.length - 1].timestamp, '2026-10-08T23:55:00', tz)
      assert.equal(r.length, 288, tz)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

test('the fridge works harder in the afternoon than in the early morning (cycle follows the clock on the label)', () => {
  const day = generateFridgeReadings({ days: 7, seed: 42 })
  const avg = hours => {
    const rows = day.filter(r => hours.includes(Number(r.timestamp.slice(11, 13))))
    return rows.reduce((s, r) => s + r.watts, 0) / rows.length
  }
  assert.ok(avg([14, 15, 16]) > avg([2, 3, 4]) * 1.2, `${avg([14, 15, 16])} vs ${avg([2, 3, 4])}`)
})