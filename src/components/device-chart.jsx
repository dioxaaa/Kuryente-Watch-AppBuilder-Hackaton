import { useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { duration } from '../utils/alerts'

// Reading times are wall-clock text with no time zone. They are read and shown in UTC so every computer draws the same hours.
const wallMs = text => Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`)
const hourFormat = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', timeZone: 'UTC' })
const dayHourFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'UTC' })
const fullFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

// A tick every few whole hours, never more than about six of them.
function hourTicks(min, max) {
  const hour = 3600000
  const step = [1, 2, 3, 4, 6, 12, 24].find(s => (max - min) / hour / s <= 6) || 24
  const ticks = []
  for (let t = Math.ceil(min / (step * hour)) * step * hour; t <= max; t += step * hour) ticks.push(t)
  return ticks
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="device-tooltip">
      <strong>{fullFormat.format(p.x)}</strong>
      <span>1-hour average <b>{Math.round(p.avg)} W</b></span>
      <span>Normal for this hour <b>{Math.round(p.low)}–{Math.round(p.high)} W</b></span>
      <span>Reading <b>{Math.round(p.watts)} W</b></span>
      {p.state !== 'normal' && <em className={`device-tooltip-flag flag-${p.state}`}>{p.state === 'high' ? 'Above normal' : p.state === 'low' ? 'Below normal' : 'Spike'}</em>}
    </div>
  )
}

// Shows one device's power over time against the band the detector learned as normal for each hour,
// with flagged stretches highlighted. Give it `alertId` to centre it on one alert; otherwise it shows the latest 24 hours.
export function DeviceChart({ device, alertId, heading = false, compact = false }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: '' }))
    ;(async () => {
      try {
        let name = device
        if (!name) {
          const devices = await api.get('/devices')
          name = devices[0]?.name
          if (!name) throw new Error('No device readings yet. Once a device sends readings, its chart will appear here.')
        }
        const data = await api.get(`/devices/${encodeURIComponent(name)}/chart${alertId ? `?alertId=${encodeURIComponent(alertId)}` : ''}`)
        if (!cancelled) setState({ loading: false, error: '', data })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: /baseline/i.test(err.message) ? 'This device is still learning what is normal for it. Its chart appears after the first training.' : err.message, data: null })
      }
    })()
    return () => { cancelled = true }
  }, [device, alertId])

  const { data } = state
  const rows = useMemo(() => (data?.points ?? []).map(p => ({
    ...p, x: wallMs(p.t), span: Math.max(0, p.high - p.low), flagged: p.state === 'normal' ? null : p.avg,
  })), [data])
  const events = useMemo(() => (data?.events ?? []).map(e => ({ ...e, x1: wallMs(e.start), x2: wallMs(e.end) })), [data])
  const focusEvent = events.find(e => e.id === data?.focus?.id) ?? events[0]
  const ticks = useMemo(() => (rows.length ? hourTicks(rows[0].x, rows[rows.length - 1].x) : []), [rows])
  const spansDays = rows.length > 1 && rows[rows.length - 1].x - rows[0].x > 30 * 3600000

  const summary = !data ? '' : focusEvent
    ? focusEvent.type === 'spike'
      ? `A reading of ${Math.round(focusEvent.peakWatts)} W was far above anything this device has drawn before.`
      : `For ${duration(focusEvent.durationMin)} the 1-hour average was ${Math.round(focusEvent.observedWatts)} W, against about ${Math.round(focusEvent.expectedWatts)} W normal for that time of day (${focusEvent.ratio}×).`
    : 'Everything in this window stayed inside the normal range.'

  let body
  if (state.loading && !data) body = <div className="device-chart-note" role="status">Loading readings…</div>
  else if (state.error) body = <div className="device-chart-note" role="alert">{state.error}</div>
  else if (!rows.length) body = <div className="device-chart-note">No readings in this time window yet.</div>
  else body = (
    <>
      <div className={`device-chart-plot ${compact ? 'device-chart-compact' : ''}`} role="img" aria-label={`Power over time for ${data.label}, compared with its normal range. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 14, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e3ebe5" strokeDasharray="3 5" />
            <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={ticks} axisLine={false} tickLine={false} tick={{ fill: '#86948b', fontSize: 10 }} dy={8} tickFormatter={v => (spansDays ? dayHourFormat : hourFormat).format(v)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#86948b', fontSize: 10 }} domain={[0, 'auto']} tickFormatter={v => `${Math.round(v)}`} width={46} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#b3c7ba', strokeDasharray: '3 3' }} />
            {events.map(e => (
              <ReferenceArea key={e.id} x1={e.x1} x2={e.x2} fill="#d9534f" fillOpacity={e.id === focusEvent?.id ? 0.14 : 0.08} stroke="#d9534f" strokeOpacity={e.id === focusEvent?.id ? 0.35 : 0.2} ifOverflow="visible"
                label={e.id === focusEvent?.id ? { value: 'Alert', position: 'insideTop', fill: '#b84b46', fontSize: 10, fontWeight: 700 } : undefined} />
            ))}
            {/* The learned normal band: an invisible base area up to the low edge, then a tinted area for its width. */}
            <Area dataKey="low" stackId="band" type="stepAfter" stroke="none" fill="transparent" isAnimationActive={false} activeDot={false} legendType="none" />
            <Area dataKey="span" stackId="band" type="stepAfter" stroke="none" fill="#2f9e5d" fillOpacity={0.16} isAnimationActive={false} activeDot={false} legendType="none" />
            <Line dataKey="watts" type="stepAfter" stroke="#98a1b5" strokeOpacity={0.3} strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
            <Line dataKey="avg" type="monotone" stroke="#1a6e3f" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="flagged" type="monotone" stroke="#d9534f" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="device-legend" aria-hidden="true">
        <li><i className="legend-band" /> Normal range for the 1-hour average</li>
        <li><i className="legend-avg" /> 1-hour average</li>
        <li><i className="legend-flag" /> Flagged</li>
        <li><i className="legend-raw" /> Raw 5-minute reading</li>
      </ul>
      <p className="device-summary">{summary}</p>
    </>
  )

  return (
    <div className="device-chart">
      {heading && (
        <div className="panel-heading device-chart-heading">
          <div>
            <h2>{data ? `${data.label}: power vs. normal` : 'Device power vs. normal'}</h2>
            <p>{focusEvent ? 'The latest alert, shown against what this device normally does at each hour' : 'Watts over time against what this device normally does at each hour'}</p>
          </div>
          {data && <span className="badge badge-neutral">Learned from its own history</span>}
        </div>
      )}
      {body}
    </div>
  )
}