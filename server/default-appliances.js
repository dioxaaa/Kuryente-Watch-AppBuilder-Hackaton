// Example appliances loaded into a brand-new database so the app is not empty on first run.
// They are flagged as samples; they load only once, so deleting them keeps them deleted.
import { addAppliance, getSetting, setSetting } from './repository.js'

export const DEFAULT_APPLIANCES = [
  { name: 'Family refrigerator', category: 'Refrigerator', watts: 180, hours: 24, pattern: 'Daily' },
  { name: 'Living room fan', category: 'Electric fan', watts: 60, hours: 10, pattern: 'Daily' },
  { name: 'Bedroom air conditioner', category: 'Air conditioner', watts: 900, hours: 6, pattern: 'Daily' },
  { name: 'Rice cooker', category: 'Rice cooker', watts: 600, hours: 1.5, pattern: 'Daily' },
]

export function seedDefaultAppliances(db) {
  if (getSetting(db, 'appliancesSeeded', false)) return 0
  for (const a of DEFAULT_APPLIANCES) addAppliance(db, a, { sample: true })
  setSetting(db, 'appliancesSeeded', true)
  return DEFAULT_APPLIANCES.length
}