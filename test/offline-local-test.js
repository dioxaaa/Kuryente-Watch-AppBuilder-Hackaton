import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractMeterReading } from '../src/utils/offline-ocr.js'
import { estimateDailyKwh, formatPeso } from '../src/utils/energy-utils.js'
import { localApi } from '../src/local-api.js'
import { api, isLocalMode, recheckServer, resetLocalMode } from '../src/api.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const html = () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })

test('meter OCR text: the longest digit run wins and keeps its decimal part', () => {
  assert.deepEqual(extractMeterReading('No 12\n01234.5\n230V'), { kwh: 1234.5, digits: '01234.5' })
  assert.deepEqual(extractMeterReading('kWh 4 5 004821'), { kwh: 4821, digits: '004821' })
  assert.equal(extractMeterReading('3,5').kwh, 3.5)
  assert.equal(extractMeterReading(''), null)
  assert.equal(extractMeterReading('7 . .'), null)
  assert.equal(extractMeterReading('0000'), null)
})

test('appliance estimates match watts × hours and retain centavo precision', () => {
  const dailyKwh = estimateDailyKwh({ watts: 60, hours: 8 })
  assert.equal(dailyKwh, 0.48)
  assert.equal(Number((dailyKwh * 30).toFixed(2)), 14.4)
  assert.equal(formatPeso(dailyKwh * 30 * 12), '₱172.80')
})

test('local assistant status and chat answer from IndexedDB records', async () => {
  const status = await localApi('/assistant/status')
  assert.deepEqual(status, { available: true, local: true, models: ['Built-in assistant'], defaultModel: 'Built-in assistant' })

  await localApi('/readings', { method: 'POST', body: { readingKwh: 1000, recordedAt: '2026-10-01T00:00:00Z' } })
  await localApi('/readings', { method: 'POST', body: { readingKwh: 1100, recordedAt: '2026-10-11T00:00:00Z' } })
  const { reply, model } = await localApi('/assistant/chat', { method: 'POST', body: { message: 'Which appliance uses the most?', model: 'Built-in assistant', history: [] } })
  assert.equal(model, 'Built-in assistant')
  assert.match(reply, /Bedroom air conditioner is the biggest/)
  assert.match((await localApi('/assistant/chat', { method: 'POST', body: { message: 'How much do I use?' } })).reply, /10 kWh a day/)
  await assert.rejects(localApi('/assistant/chat', { method: 'POST', body: { message: '  ' } }), /Message is required/)
})

test('api switches to on-device mode when /api is a static host, and back when the server returns', async t => {
  const realFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = realFetch })

  globalThis.fetch = async () => html()
  assert.deepEqual(await api('/health'), { ok: true, local: true, database: 'browser' })
  assert.equal(isLocalMode(), true)
  assert.equal((await api('/assistant/status')).local, true)

  globalThis.fetch = async url => (url === '/api/health' ? json({ ok: true, local: true, database: 'ready' }) : json([]))
  assert.equal(await recheckServer(), true)
  assert.equal(isLocalMode(), false)
  assert.deepEqual(await api('/readings'), [])

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  assert.equal((await api('/readings')).length, 2)
  assert.equal(isLocalMode(), true)
})

test('server health answers that are not KuryenteWatch payloads count as on-device mode', async t => {
  const realFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = realFetch })
  globalThis.fetch = async () => json({ ok: true })
  await recheckServer()
  assert.equal(isLocalMode(), false)
  globalThis.fetch = async () => json({ error: 'Not found' }, 404)
  await api('/health')
  assert.equal(isLocalMode(), true)
})

test('server mode: no Ollama models means the built-in assistant answers from server records', async t => {
  const realFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = realFetch })
  const routes = {
    '/api/health': { ok: true, local: true, database: 'ready' },
    '/api/assistant/status': { available: false, models: [], error: 'Ollama is offline.' },
    '/api/readings': [],
    '/api/appliances': [{ name: 'Server fridge', category: 'Refrigerator', ratedWatts: 200, hoursPerDay: 24 }],
    '/api/alerts': [],
    '/api/settings': { ratePerKwh: 10 },
  }
  globalThis.fetch = async url => json(routes[url])
  await recheckServer()
  const status = await api('/assistant/status')
  assert.deepEqual(status.models, ['Built-in assistant'])
  assert.equal(status.error, 'Ollama is offline.')
  const { reply } = await api.post('/assistant/chat', { message: 'Which appliance uses the most?', model: 'Built-in assistant' })
  assert.match(reply, /Server fridge is the biggest/)
})

test('dashboard assistant answers from its saved-data context when Ollama is unavailable', async t => {
  const realFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = realFetch
    resetLocalMode()
  })
  resetLocalMode()
  globalThis.fetch = async () => json({ error: 'Ollama is offline.' }, 503)
  const { reply } = await api.post('/assistant', {
    question: 'Which appliance uses the most?',
    context: {
      rate: 12.5,
      appliances: [{ name: 'Kitchen fan', category: 'Electric fan', watts: 60, hoursPerDay: 8, monthlyKwh: 14.4 }],
    },
  })
  assert.match(reply, /Kitchen fan is the biggest on your list/)
})

test('an unreadable server scan retries with on-device OCR', async t => {
  const realFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = realFetch
    resetLocalMode()
  })
  resetLocalMode()
  globalThis.fetch = async () => json({ error: 'Could not read a kWh number from this photo.' }, 422)
  await assert.rejects(
    api.post('/meter-readings/read-photo', { image: 'data:image/jpeg;base64,AA==' }),
    error => error.status === 503 && /This device could not read the photo/.test(error.message),
  )
})

test('local meter reset starts a new cumulative sequence without a false usage delta', async () => {
  await localApi('/readings', { method: 'POST', body: { readingKwh: 1200, recordedAt: '2026-10-12T00:00:00Z' } })
  const reset = await localApi('/readings', { method: 'POST', body: { readingKwh: 10, recordedAt: '2026-10-13T00:00:00Z', reset: true } })
  assert.equal(reset.reading.usageKwh, null)
  assert.equal(reset.reading.reset, true)
  const next = await localApi('/readings', { method: 'POST', body: { readingKwh: 15, recordedAt: '2026-10-14T00:00:00Z' } })
  assert.equal(next.reading.usageKwh, 5)
  await assert.rejects(
    localApi('/readings', { method: 'POST', body: { readingKwh: 8, recordedAt: '2026-10-15T00:00:00Z' } }),
    /preceding meter value/,
  )
  const rows = await localApi('/readings')
  assert.equal(rows.at(-2).usageKwh, null)
  assert.equal(rows.at(-1).usageKwh, 5)
})
