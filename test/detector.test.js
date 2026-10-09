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