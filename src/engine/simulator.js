export function createRng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Reading timestamps are wall-clock text with no time zone (like 2026-10-01T13:10:00). The clock is built in UTC
// so the same text comes out on every computer; using local time here shifted every reading by the machine's UTC offset.
const parseWallClock = text => Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text.includes('T') ? text : `${text}T00:00:00`}Z`)

export function generateFridgeReadings({ days = 7, intervalMin = 5, start = '2026-10-01T00:00:00', seed = 42, device = 'refrigerator' } = {}) {
  const rng = createRng(seed)
  const t0 = parseWallClock(start)
  const total = Math.floor((days * 24 * 60) / intervalMin)
  const out = []
  let on = false
  let remaining = 0 // samples left in current ON/OFF phase
  for (let i = 0; i < total; i++) {
    const ts = new Date(t0 + i * intervalMin * 60000)
    const hour = ts.getUTCHours() + ts.getUTCMinutes() / 60
    const duty = 0.33 + 0.1 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) // ~0.23-0.43
    if (remaining <= 0) {
      on = !on
      const cycleSamples = 40 / intervalMin // ~40 min full cycle
      const mean = on ? cycleSamples * duty : cycleSamples * (1 - duty)
      remaining = Math.max(1, Math.round(mean * (0.8 + 0.4 * rng())))
    }
    remaining--
    const watts = on ? 135 + (rng() - 0.5) * 20 : 5 + (rng() - 0.5) * 2
    out.push({ timestamp: ts.toISOString().slice(0, 19), device, watts: Math.round(watts * 10) / 10 })
  }
  return out
}

export function injectAnomaly(readings, { type = 'sustained', startIndex, lengthSamples = 8, seed = 7 } = {}) {
  const rng = createRng(seed)
  const out = readings.map(r => ({ ...r }))
  const end = Math.min(out.length, startIndex + lengthSamples)
  for (let i = startIndex; i < end; i++) {
    if (type === 'sustained') out[i].watts = Math.round((150 + rng() * 15) * 10) / 10
    else if (type === 'spike') out[i].watts = Math.round((380 + rng() * 60) * 10) / 10
    else if (type === 'stuck-off') out[i].watts = Math.round((0.5 + rng()) * 10) / 10
  }
  return out
}