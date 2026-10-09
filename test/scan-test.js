import test from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.js'
import * as repo from '../server/repository.js'
import { trainDevice, scanAllDevices } from '../server/service.js'
import { generateFridgeReadings, injectAnomaly } from '../src/engine/index.js'

const db = openDb(':memory:')
test.beforeEach(() => repo.clearAllData(db))

function trainedFridge(device = 'refrigerator') {
  repo.saveDevice(db, { name: device, label: 'Family fridge' })
  repo.saveReadings(db, generateFridgeReadings({ days: 7, seed: 42, device }))
  trainDevice(db, device)
}

test('scan all finds a problem in readings newer than the baseline, and a second scan adds nothing', () => {
  trainedFridge()
  const fresh = generateFridgeReadings({ days: 2, seed: 99, start: '2026-10-08T00:00:00' })
  repo.saveReadings(db, injectAnomaly(fresh, { type: 'sustained', startIndex: 300, lengthSamples: 18 }))

  const first = scanAllDevices(db)
  assert.equal(first.scanned, 1)
  assert.ok(first.newAlerts >= 1)
  assert.equal(repo.listAlerts(db).length, first.newAlerts)

  const second = scanAllDevices(db)
  assert.equal(second.newAlerts, 0)
  assert.equal(repo.listAlerts(db).length, first.newAlerts)
})

test('scan all raises nothing for normal new readings', () => {
  trainedFridge()
  repo.saveReadings(db, generateFridgeReadings({ days: 2, seed: 100, start: '2026-10-08T00:00:00' }))
  const result = scanAllDevices(db)
  assert.equal(result.scanned, 1)
  assert.equal(result.newAlerts, 0)
})

test('devices without a baseline are skipped, not trained', () => {
  repo.saveDevice(db, { name: 'fan' })
  repo.saveReadings(db, generateFridgeReadings({ days: 2, seed: 5, device: 'fan' }))
  const result = scanAllDevices(db)
  assert.equal(result.scanned, 0)
  assert.deepEqual(result.skipped, [{ device: 'fan', reason: 'No baseline yet' }])
  assert.equal(repo.getBaseline(db, 'fan'), undefined)
})