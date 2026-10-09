import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMeterReply, readMeterPhoto } from '../server/meter-ocr.js'

const PHOTO = Buffer.from('not really a jpeg but valid base64').toString('base64')
const fakeChat = reply => {
  const calls = []
  return { calls, chat: async (messages, options) => { calls.push({ messages, options }); return { reply, model: 'vision-test' } } }
}

test('parseMeterReply accepts numbers and number-like text, and rounds to 2 decimals', () => {
  assert.deepEqual(parseMeterReply('{"kwh": 3012.5, "digits": "03012.5"}'), { kwh: 3012.5, digits: '03012.5' })
  assert.equal(parseMeterReply('{"kwh": "3,012.50"}').kwh, 3012.5)
  assert.equal(parseMeterReply('```json\n{"kwh": 41}\n```').kwh, 41)
  assert.equal(parseMeterReply('{"kwh": 12.3456}').kwh, 12.35)
})

test('parseMeterReply rejects anything it cannot trust', () => {
  for (const bad of ['{"kwh": null}', '{"kwh": 0}', '{"kwh": -5}', '{"kwh": "abc"}', '{"kwh": 99999999}', '{}', 'I think it says 3012', '', '{"kwh":']) {
    assert.equal(parseMeterReply(bad), null, bad)
  }
})

test('readMeterPhoto sends the photo to the vision model as plain base64 and returns the value', async () => {
  const { chat, calls } = fakeChat('{"kwh": 3012.5, "digits": "03012.5"}')
  const result = await readMeterPhoto(`data:image/jpeg;base64,${PHOTO}`, { chat })
  assert.deepEqual(result, { kwh: 3012.5, digits: '03012.5', model: 'vision-test' })
  assert.deepEqual(calls[0].messages[0].images, [PHOTO])
  assert.match(calls[0].messages[0].content, /Do not guess/)
  assert.equal(calls[0].options.format, 'json')
  assert.equal(calls[0].options.temperature, 0)
  assert.ok(calls[0].options.model && calls[0].options.timeoutMs >= 60000)
})

test('an unreadable photo gives a 422 with a helpful message', async () => {
  await assert.rejects(readMeterPhoto(PHOTO, { chat: fakeChat('{"kwh": null}').chat }), err => err.status === 422 && /type the value in/.test(err.message))
})

test('bad input is rejected before the model is called', async () => {
  const { chat, calls } = fakeChat('{"kwh": 1}')
  for (const bad of [undefined, '', 'data:image/png;base64,', 'not base64 !!!']) {
    await assert.rejects(readMeterPhoto(bad, { chat }), err => err.status === 400, String(bad))
  }
  await assert.rejects(readMeterPhoto('A'.repeat(8_000_001), { chat }), err => err.status === 400)
  assert.equal(calls.length, 0)
})

test('an offline or missing model passes its status through', async () => {
  const offline = async () => { throw Object.assign(new Error('offline'), { status: 503 }) }
  await assert.rejects(readMeterPhoto(PHOTO, { chat: offline }), err => err.status === 503)
})