import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractMeterReading } from '../src/utils/offline-ocr.js'
import { localApi } from '../src/local-api.js'
import { api, isLocalMode, recheckServer } from '../src/api.js'

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
