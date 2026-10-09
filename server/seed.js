// Loads simulated fridge data (7 normal days + 1 day with an injected anomaly) so you can demo right away.
import { openDb } from './db.js'
import * as repo from './repository.js'
import { trainDevice, scanDevice } from './service.js'
import { generateFridgeReadings, injectAnomaly } from '../src/engine/index.js'

const db = openDb()
repo.saveDevice(db, { name: 'refrigerator', label: 'Family refrigerator', category: 'Refrigerator', ratedWatts: 140 })
repo.saveReadings(db, generateFridgeReadings({ days: 7, seed: 42, start: '2026-10-01T00:00:00' }))
trainDevice(db, 'refrigerator')
const today = generateFridgeReadings({ days: 1, seed: 99, start: '2026-10-08T00:00:00' })
repo.saveReadings(db, injectAnomaly(today, { type: 'sustained', startIndex: 150, lengthSamples: 18 }))
const { events, newAlerts } = scanDevice(db, 'refrigerator', { from: '2026-10-08T00:00:00' })
console.log(`Seeded. ${events.length} anomaly event(s), ${newAlerts} new alert(s).`)