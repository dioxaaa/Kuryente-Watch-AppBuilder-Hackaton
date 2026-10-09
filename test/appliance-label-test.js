import test from 'node:test'
import assert from 'node:assert/strict'
import { findModels, findWatts, parseLabelTexts } from '../src/utils/appliance-label.js'
import { parseLabelReply, readApplianceLabel } from '../server/appliance-label.js'

test('watts: W, watts, kW and thousands separators; volts, hertz and kWh are ignored', () => {
  assert.deepEqual(findWatts('220V~ 60Hz 23W'), [23])
  assert.deepEqual(findWatts('Rated power: 1,200 W'), [1200])
  assert.deepEqual(findWatts('Input 1.2kW'), [1200])
  assert.deepEqual(findWatts('900 watts'), [900])
  assert.deepEqual(findWatts('Energy 300 kWh/year 220V 60Hz'), [])
})

test('model numbers need letters and digits, and skip ratings like 60HZ', () => {
  assert.deepEqual(findModels('ML-AJ580-5 60HZ 23W'), ['ML-AJ580-5'])
  assert.deepEqual(findModels('MODEL NO.: HRF210NM'), ['HRF210NM'])
  assert.deepEqual(findModels('AC-220 IP-44'), ['AC-220', 'IP-44'])
  assert.deepEqual(findModels('ML- 60Hz'), [])
})

test('several noisy OCR readings of one sideways label are combined by vote', () => {
  const readings = [
    'Vv J ER of ABE 5 S0riz 23W Ws / Bd x',
    ': KAM pr E . 5 : \\ ML-AJ580- 5 60HZ 23W n- _mell',
    'Ne h ~~ " FeiCAT = : ML-AJ580-5 gOHz 23W - - =',
    'N\\E LM 08 g 08SIYe W DIS',
    'Vv IW CN = ML- LASS got: 2 / TS',
  ]
  assert.deepEqual(parseLabelTexts(readings), { category: 'Other', brand: '', model: 'ML-AJ580-5', watts: 23, name: 'Appliance (ML-AJ580-5)' })
  assert.deepEqual(parseLabelTexts(['Hanabishi electric fan HEF-1600 50W', 'stand fan 50 W']), { category: 'Electric fan', brand: 'Hanabishi', model: 'HEF-1600', watts: 50, name: 'Hanabishi electric fan (HEF-1600)' })
  assert.equal(parseLabelTexts(['220V 60Hz', '']), null)
})

test('vision reply is checked and normalized', () => {
  assert.deepEqual(parseLabelReply('{"name":"Desk clip fan","category":"Electric fan","brand":"Sycat","model":"ML-AJ580-5","watts":"23W"}'),
    { category: 'Electric fan', brand: 'Sycat', model: 'ML-AJ580-5', watts: 23, name: 'Desk clip fan' })
  assert.equal(parseLabelReply('{"category":"Toaster","watts":800}').category, 'Other')
  for (const bad of ['{"name":"fan","watts":null}', '{"watts":999999}', 'not json', '[]']) assert.equal(parseLabelReply(bad), null, bad)
})

test('readApplianceLabel sends the photo to the vision model and returns the suggestion', async () => {
  const calls = []
  const chat = async (messages, options) => { calls.push({ messages, options }); return { reply: '{"name":"Clip fan","category":"Electric fan","model":"ML-AJ580-5","watts":23}', model: 'vision-test' } }
  const photo = Buffer.from('jpeg').toString('base64')
  const result = await readApplianceLabel(`data:image/jpeg;base64,${photo}`, { chat })
  assert.equal(result.engine, 'vision-test')
  assert.equal(result.watts, 23)
  assert.deepEqual(calls[0].messages[0].images, [photo])
  assert.equal(calls[0].options.format, 'json')
  await assert.rejects(readApplianceLabel('', { chat }), err => err.status === 400)
  await assert.rejects(readApplianceLabel(photo, { chat: async () => ({ reply: '{"watts":null}', model: 'm' }) }), err => err.status === 422 && /type the details/.test(err.message))
})
