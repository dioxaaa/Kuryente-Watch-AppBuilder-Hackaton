import test from 'node:test'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.js'
import * as repo from '../server/repository.js'
import { createApp } from '../server/app.js'
import { seedDefaultAppliances, DEFAULT_APPLIANCES } from '../server/default-appliances.js'

const db = openDb(':memory:')
test.beforeEach(() => repo.clearAllData(db))

async function withApi(fn) {
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(base + path, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: res.status, body: await res.json() }
  }
  try { await fn(call) } finally { server.closeAllConnections(); server.close() }
}

test('built-in examples load once, are flagged as samples, and stay deleted', () => {
  assert.equal(seedDefaultAppliances(db), DEFAULT_APPLIANCES.length)
  assert.equal(seedDefaultAppliances(db), 0, 'second call adds nothing')
  const list = repo.listAppliances(db)
  assert.equal(list.length, 4)
  assert.ok(list.every(a => a.sample))
  assert.deepEqual(list.map(a => a.name), DEFAULT_APPLIANCES.map(a => a.name), 'order is stable')
  for (const a of list) repo.deleteAppliance(db, a.id)
  assert.equal(seedDefaultAppliances(db), 0)
  assert.equal(repo.listAppliances(db).length, 0)
})

test('API: add, list, edit, delete an appliance (data survives across requests)', async () => {
  await withApi(async call => {
    const created = await call('/appliances', 'POST', { name: '  Kitchen fridge ', category: 'Refrigerator', watts: '150', hours: 24, brand: 'LG', model: 'LRBC1204S' })
    assert.equal(created.status, 200)
    assert.equal(created.body.name, 'Kitchen fridge')
    assert.equal(created.body.watts, 150)
    assert.equal(created.body.sample, false)
    assert.match(created.body.id, /^[0-9a-f-]{36}$/)

    const list = (await call('/appliances')).body
    assert.equal(list.length, 1)
    assert.equal(list[0].brand, 'LG')

    const edited = await call(`/appliances/${created.body.id}`, 'PUT', { ...created.body, hours: 20, brand: '' })
    assert.equal(edited.body.hours, 20)
    assert.equal(edited.body.brand, '')
    assert.equal((await call('/appliances/nope', 'PUT', { name: 'x', watts: 1, hours: 1 })).status, 404)

    assert.equal((await call(`/appliances/${created.body.id}`, 'DELETE')).body.deleted, true)
    assert.equal((await call('/appliances')).body.length, 0)
  })
})

test('API: bad appliance input is rejected with a readable message', async () => {
  await withApi(async call => {
    const ok = { name: 'Fan', category: 'Electric fan', watts: 60, hours: 8 }
    for (const bad of [{ name: '' }, { name: 'x'.repeat(81) }, { category: 'Toaster' }, { watts: 0 }, { watts: 'lots' }, { watts: 99999 }, { hours: 25 }, { hours: -1 }, { pattern: 'Sometimes' }, { brand: 'b'.repeat(61) }]) {
      const r = await call('/appliances', 'POST', { ...ok, ...bad })
      assert.equal(r.status, 400, JSON.stringify(bad))
      assert.ok(r.body.error.length > 10)
    }
    assert.equal((await call('/appliances', 'POST')).status, 400)
    assert.equal((await call('/appliances')).body.length, 0)
  })
})

test('editing a sample makes it the user\'s own; wipe clears appliances', async () => {
  seedDefaultAppliances(db)
  await withApi(async call => {
    const [first] = (await call('/appliances')).body
    assert.equal(first.sample, true)
    const edited = await call(`/appliances/${first.id}`, 'PUT', { ...first, watts: 170 })
    assert.equal(edited.body.sample, false)
    await call('/data', 'DELETE')
    assert.equal((await call('/appliances')).body.length, 0)
  })
})