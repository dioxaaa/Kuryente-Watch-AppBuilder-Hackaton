const MIN_SAMPLES_PER_BUCKET = 12
export const DEFAULT_Z_THRESHOLD = 3.5 // shared with the chart so the drawn normal band matches what the detector flags

export const median = arr => {
  if (!arr.length) return NaN
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const mad = (arr, med = median(arr)) => median(arr.map(x => Math.abs(x - med)))

export function inferIntervalMin(readings) {
  const gaps = []
  for (let i = 1; i < readings.length; i++) gaps.push((new Date(readings[i].timestamp) - new Date(readings[i - 1].timestamp)) / 60000)
  return median(gaps) || 5
}


export function rollingMean(values, window) {
  const out = new Array(values.length)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    out[i] = sum / Math.min(i + 1, window)
  }
  return out
}

const hourOf = ts => new Date(ts).getHours()


export function learnBaseline(readings, { windowMin = 60 } = {}) {
  if (readings.length < 24) throw new Error('Need more readings to learn a baseline (at least 24).')
  const intervalMin = inferIntervalMin(readings)
  const window = Math.max(1, Math.round(windowMin / intervalMin))
  const watts = readings.map(r => r.watts)
  const smooth = rollingMean(watts, window)

  const buckets = Array.from({ length: 24 }, () => [])
  readings.forEach((r, i) => { if (i >= window - 1) buckets[hourOf(r.timestamp)].push(smooth[i]) })
  const valid = smooth.slice(window - 1)
  const globalMed = median(valid)
  const globalMad = mad(valid, globalMed)

  const stat = vals => {
    const useGlobal = vals.length < MIN_SAMPLES_PER_BUCKET
    const med = useGlobal ? globalMed : median(vals)
    const m = useGlobal ? globalMad : mad(vals, med)
    return { median: med, mad: Math.max(m, 0.05 * med, 1) }
  }
  return {
    version: 1,
    device: readings[0].device,
    intervalMin,
    windowMin: window * intervalMin,
    trainedOn: { samples: readings.length, from: readings[0].timestamp, to: readings[readings.length - 1].timestamp },
    global: stat(valid),
    hourly: buckets.map(stat),
    maxWatts: Math.max(...watts),
    minSmoothed: Math.min(...valid), 
  }
}

export function detect(readings, baseline, { zThreshold = DEFAULT_Z_THRESHOLD, minSustainedMin = 30, spikeFactor = 1.5 } = {}) {
  const { intervalMin } = baseline
  const window = Math.max(1, Math.round(baseline.windowMin / intervalMin))
  const smooth = rollingMean(readings.map(r => r.watts), window)

  const points = readings.map((r, i) => {
    const full = i >= window - 1
    const b = baseline.hourly[hourOf(r.timestamp)]
    const z = full ? (0.6745 * (smooth[i] - b.median)) / b.mad : 0
    const isSpike = r.watts > baseline.maxWatts * spikeFactor
    const belowAnythingSeen = full && smooth[i] < baseline.minSmoothed * 0.5
    const state = isSpike ? 'spike' : z > zThreshold ? 'high' : z < -zThreshold || belowAnythingSeen ? 'low' : 'normal'
    return { index: i, timestamp: r.timestamp, watts: r.watts, smoothed: smooth[i], z, state, baseline: b.median }
  })

  const events = []
  let cur = null
  for (const p of points) {
    if (p.state === 'normal') { if (cur) { events.push(cur); cur = null } continue }
    if (cur && cur.state === p.state) cur.pts.push(p)
    else { if (cur) events.push(cur); cur = { state: p.state, pts: [p] } }
  }
  if (cur) events.push(cur)

  const result = events.map(e => buildEvent(e, baseline)).filter(ev => ev.type !== 'minor')
  return { points, events: result.filter(ev => ev.type === 'spike' || ev.durationMin >= minSustainedMin) }
}

function buildEvent({ state, pts }, baseline) {
  const first = pts[0], last = pts[pts.length - 1]
  const durationMin = pts.length * baseline.intervalMin
  const observed = pts.reduce((s, p) => s + p.smoothed, 0) / pts.length
  const expected = pts.reduce((s, p) => s + p.baseline, 0) / pts.length
  const peakWatts = Math.max(...pts.map(p => p.watts))
  const peakZ = pts.reduce((m, p) => (Math.abs(p.z) > Math.abs(m) ? p.z : m), 0)
  const ratio = expected > 0 ? observed / expected : 0
  const type = state === 'spike' ? 'spike' : state === 'high' ? 'sustained-high' : 'sustained-low'
  const severity = type === 'spike' ? 'warning' : Math.abs(peakZ) > 8 || durationMin >= 60 ? 'high' : 'warning'
  const excessKwh = type === 'sustained-high' ? Math.max(0, (observed - expected) * (durationMin / 60)) / 1000 : 0
  return {
    type, severity,
    start: first.timestamp, end: last.timestamp,
    durationMin, observedWatts: round(observed), expectedWatts: round(expected), peakWatts: round(peakWatts),
    ratio: round(ratio, 2), peakZ: round(peakZ, 1), excessKwh: round(excessKwh, 3),
    explanation: explain(type, { durationMin, observed, expected, peakWatts, ratio }),
  }
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d

function explain(type, { durationMin, observed, expected, peakWatts, ratio }) {
  if (type === 'spike')
    return `A reading of ${round(peakWatts, 0)} W is far above anything seen in this device's learned history. Suggested action: check what was running at that time.`
  if (type === 'sustained-high')
    return `Power stayed around ${round(observed, 0)} W for ${durationMin} consecutive minutes, about ${round(ratio, 1)}x the learned baseline of ${round(expected, 0)} W for this time of day. This is unusual compared with the readings stored on this device. Suggested action: check the appliance and its operating conditions.`
  return `Power stayed around ${round(observed, 0)} W for ${durationMin} consecutive minutes, well below the learned baseline of ${round(expected, 0)} W for this time of day. Suggested action: confirm the appliance is powered and operating.`
}