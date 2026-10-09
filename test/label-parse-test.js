import test from 'node:test'
import assert from 'node:assert/strict'
import { parseApplianceLabel, hasLabelDetails } from '../src/utils/label-parse.js'

test('reads printed watts, brand and model from a label', () => {
  const found = parseApplianceLabel('SAMSUNG Model: EP-TA800 INPUT: 100-240V ~ 50/60Hz 1.5A OUTPUT: 25W')
  assert.equal(found.watts, 25)
  assert.equal(found.source, 'label')
  assert.equal(found.brand, 'Samsung')
  assert.equal(found.model, 'EP-TA800')
  assert.equal(found.volts, 230)
  assert.equal(found.amps, 1.5)
})

test('computes watts from volts × amps when no wattage is printed', () => {
  const found = parseApplianceLabel('220V~ 60Hz 2.5A')
  assert.equal(found.watts, 550)
  assert.equal(found.source, 'computed')
})

test('kW is converted and Wh is not mistaken for watts', () => {
  assert.equal(parseApplianceLabel('Rated power 1.2kW').watts, 1200)
  assert.equal(parseApplianceLabel('Battery 50Wh').watts, null)
})

test('prefers a wattage labelled as power or input and reports the others', () => {
  const found = parseApplianceLabel('Standby 2W Rated power 150W')
  assert.equal(found.watts, 150)
  assert.deepEqual(found.otherWatts, [2])
})

test('returns nothing for unreadable text', () => {
  assert.equal(hasLabelDetails(parseApplianceLabel('')), false)
  assert.equal(hasLabelDetails(parseApplianceLabel('lorem ipsum')), false)
})