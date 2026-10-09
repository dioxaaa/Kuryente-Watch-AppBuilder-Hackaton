import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { openDb } from '../server/db.js'
import { createApp } from '../server/app.js'

function fakeChat(reply = 'Unplug it when idle. Run it at night.') {
  const calls = []
  const chat = async (messages, options) => { calls.push({ messages, options }); return { reply, model: 'test-model' } }
  return { chat, calls }
}

async function withApi(chat, callback) {
  const db = openDb(':memory:')
  const server = createApp(db, { chat }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const post = async (route, body) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  try {
    await callback(post)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    db.close()
  }
}

test('POST /api/ai/recommendation returns the local AI tip with daily kWh in the prompt', async () => {
  const { chat, calls } = fakeChat()
  await withApi(chat, async post => {
    const res = await post('/ai/recommendation', { applianceName: 'Aircon', ratedWatts: 1000, hoursPerDay: 8 })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { success: true, appliance: 'Aircon', insight: 'Unplug it when idle. Run it at night.' })
    assert.equal(calls.length, 1)
    assert.match(calls[0].messages[0].content, /Aircon/)
    assert.match(calls[0].messages[0].content, /8\.00 kWh\/day/)
    assert.match(calls[0].messages[0].content, /2-sentence tip/)
  })
})

test('POST /api/ai/recommendation rejects missing appliance name or rated watts', async () => {
  const { chat, calls } = fakeChat()
  await withApi(chat, async post => {
    assert.equal((await post('/ai/recommendation', { ratedWatts: 100 })).status, 400)
    assert.equal((await post('/ai/recommendation', { applianceName: 'Fan' })).status, 400)
    assert.equal(calls.length, 0)
  })
})

test('POST /api/ai/recommendation falls back to a fixed tip when Ollama fails', async () => {
  const offline = async () => { throw Object.assign(new Error('offline'), { status: 503 }) }
  await withApi(offline, async post => {
    const res = await post('/ai/recommendation', { applianceName: 'Rice cooker', ratedWatts: 700 })
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.appliance, 'Rice cooker')
    assert.match(res.body.insight, /^For your Rice cooker, consider unplugging it when idle/)
  })
})

test('POST /api/assistant answers with the local AI using the server-built prompt', async () => {
  const { chat, calls } = fakeChat('Your aircon is the biggest driver.')
  await withApi(chat, async post => {
    const res = await post('/assistant', {
      question: 'Why is my bill high?',
      history: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }],
      context: { rate: 12.5, appliances: [{ name: 'Aircon', category: 'Air conditioner', watts: 1000, hoursPerDay: 8, monthlyKwh: 240 }] },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.reply, 'Your aircon is the biggest driver.')
    const { messages } = calls[0]
    assert.equal(messages[0].role, 'system')
    assert.match(messages[0].content, /PHP 12\.5 per kWh/)
    assert.match(messages[0].content, /Aircon/)
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'Why is my bill high?' },
    ])
    assert.equal((await post('/assistant', { question: '  ' })).status, 400)
  })
})
