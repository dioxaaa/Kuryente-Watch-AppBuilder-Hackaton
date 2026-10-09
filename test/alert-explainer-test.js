import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { openDb } from '../server/db.js'
import * as repo from '../server/repository.js'
import { trainDevice, scanDevice } from '../server/service.js'
import { explainAlert } from '../server/alert-explainer.js'
import { toViewAlert } from '../src/utils/alerts.js'
import { generateFridgeReadings, injectAnomaly } from '../src/engine/index.js'

const db = openDb(':memory:')
test.beforeEach(() => repo.clearAllData(db))

// One real alert from the real detector: a fridge that kept running for 90 minutes.
function seedAlert() {
  repo.saveDevice(db, { name: 'refrigerator', label: 'Family fridge', ratedWatts: 140 })
  repo.saveReadings(db, generateFridgeReadings({ days: 7, seed: 42 }))
  trainDevice(db, 'refrigerator')
  const fresh = generateFridgeReadings({ days: 2, seed: 99, start: '2026-10-08T00:00:00' })
  repo.saveReadings(db, injectAnomaly(fresh, { type: 'sustained', startIndex: 300, lengthSamples: 18 }))
  const range = { from: '2026-10-08T00:00:00' }
  scanDevice(db, 'refrigerator', range)
  return { alert: repo.listAlerts(db)[0], range }
}

function fakeChat(reply = 'The fridge ran longer than usual. Check the door seal.') {
  const calls = []
  const chat = async (messages, options) => { calls.push({ messages, options }); return { reply, model: 'test-model' } }
  return { chat, calls }
}

test('explainAlert asks the model once, then serves the saved explanation', async () => {
  const { alert } = seedAlert()
  const { chat, calls } = fakeChat()

  const first = await explainAlert(db, alert.id, { chat })
  assert.deepEqual(first, { explanation: 'The fridge ran longer than usual. Check the door seal.', model: 'test-model', cached: false })

  const prompt = calls[0].messages.map(m => m.content).join('\n')
  assert.match(prompt, /Family fridge/)
  assert.match(prompt, /power stayed higher than normal/)
  assert.ok(prompt.includes(`${Math.round(alert.observedWatts)} W`), 'prompt carries the detector numbers')

  const second = await explainAlert(db, alert.id, { chat })
  assert.equal(second.cached, true)
  assert.equal(calls.length, 1)
  assert.equal(repo.getAlert(db, alert.id).aiExplanation, first.explanation)
  assert.equal(repo.listAlerts(db)[0].aiModel, 'test-model')

  await explainAlert(db, alert.id, { chat, refresh: true })
  assert.equal(calls.length, 2)
})

test('the prompt includes an estimated cost only when a rate is saved', async () => {
  const { alert } = seedAlert()
  assert.ok(alert.excessKwh > 0)
  const noRate = fakeChat()
  await explainAlert(db, alert.id, { chat: noRate.chat })
  assert.doesNotMatch(noRate.calls[0].messages[1].content, /Estimated extra cost/)

  repo.setSetting(db, 'preferences', { rate: 12.5 })
  const withRate = fakeChat()
  await explainAlert(db, alert.id, { chat: withRate.chat, refresh: true })
  assert.match(withRate.calls[0].messages[1].content, /Estimated extra cost: about PHP .* at PHP 12.5 per kWh/)
})

test('the prompt tells the model not to diagnose and to stick to the facts', async () => {
  const { alert } = seedAlert()
  const { chat, calls } = fakeChat()
  await explainAlert(db, alert.id, { chat })
  assert.match(calls[0].messages[0].content, /Never say the appliance is broken/)
  assert.match(calls[0].messages[0].content, /Do not invent numbers/)
})

test('a re-scan keeps the explanation when the event is unchanged and drops it when the event changed', async () => {
  const { alert, range } = seedAlert()
  await explainAlert(db, alert.id, { chat: fakeChat().chat })

  scanDevice(db, 'refrigerator', range)
  assert.ok(repo.getAlert(db, alert.id).aiExplanation, 'same event: explanation kept')

  const stored = repo.getAlert(db, alert.id)
  const { id, device, createdAt, read, dismissed, aiExplanation, aiModel, ...event } = stored
  repo.saveAlerts(db, device, [{ ...event, durationMin: event.durationMin + 30 }])
  const after = repo.getAlert(db, alert.id)
  assert.equal(after.aiExplanation, null)
  assert.equal(after.aiModel, null)
})

test('unknown alert gives 404 and an offline model gives 503 without saving anything', async () => {
  await assert.rejects(explainAlert(db, 'nope|spike|x', { chat: fakeChat().chat }), err => err.status === 404)

  const { alert } = seedAlert()
  const offline = async () => { throw Object.assign(new Error('The AI assistant is offline.'), { status: 503 }) }
  await assert.rejects(explainAlert(db, alert.id, { chat: offline }), err => err.status === 503)
  assert.equal(repo.getAlert(db, alert.id).aiExplanation, null)
})

test('a database made before AI explanations gets the new columns', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kw-')), 'old.db')
  const old = new Database(file)
  old.exec(`CREATE TABLE devices (name TEXT PRIMARY KEY, label TEXT, category TEXT, rated_watts REAL, created_at TEXT NOT NULL);
    CREATE TABLE alerts (id TEXT PRIMARY KEY, device TEXT NOT NULL, type TEXT NOT NULL, severity TEXT, start TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, dismissed INTEGER NOT NULL DEFAULT 0);
    INSERT INTO devices VALUES ('fan', NULL, NULL, NULL, 'x');
    INSERT INTO alerts (id, device, type, severity, start, data, created_at) VALUES ('fan|spike|1', 'fan', 'spike', 'warning', '1', '{"type":"spike","start":"1"}', 'x');`)
  old.close()
  const migrated = openDb(file)
  assert.equal(repo.getAlert(migrated, 'fan|spike|1').aiExplanation, null)
  assert.equal(repo.saveAlertExplanation(migrated, 'fan|spike|1', 'ok', 'm'), true)
  assert.equal(repo.getAlert(migrated, 'fan|spike|1').aiExplanation, 'ok')
})

test('toViewAlert gives the page a title, context, severity and the detector explanation', () => {
  const { alert } = seedAlert()
  const view = toViewAlert(alert, repo.listDevices(db))
  assert.equal(view.id, alert.id)
  assert.equal(view.title, 'Family fridge stayed above its normal draw')
  assert.match(view.context, /^Family fridge · [A-Z][a-z]{2} \d+, \d+:\d\d\s[AP]M · (\d+ min|\d+ h( \d+ min)?)$/)
  assert.equal(view.description, alert.explanation)
  assert.match(view.description, /unusual compared with the readings stored on this device/)
  assert.ok(['high', 'warning'].includes(view.severity))
  assert.ok(view.happenedAt instanceof Date && !Number.isNaN(view.happenedAt.getTime()))
  assert.equal(view.read, false)
  assert.equal(view.aiExplanation, null)

  const spike = toViewAlert({ id: 's', device: 'living-room-fan', type: 'spike', severity: 'warning', start: '2026-10-08T01:00:00', explanation: 'x' })
  assert.equal(spike.title, 'Sudden power spike on living room fan')
})