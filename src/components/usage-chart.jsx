import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const shortDate = value => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(value))
const spanText = days => (days >= 1.5 ? `${Math.round(days * 10) / 10} days` : days >= 0.95 ? '1 day' : `${Math.round(days * 24)} hours`)

// Each bar is the average kWh per day between two readings; the tooltip shows the real dates and the total.
function UsageTooltip({ active, payload }) {
  const point = active && payload?.[0]?.payload
  if (!point) return null
  return (
    <div style={{ padding: '10px 12px', border: '1px solid #dfe8e2', borderRadius: 12, background: '#fff', color: '#1f2d25', boxShadow: '0 8px 24px #10182817', fontSize: 12, lineHeight: 1.5 }}>
      {point.from && <div style={{ color: '#6b7a70' }}>{shortDate(point.from)} → {shortDate(point.to)} · {spanText(point.days)}</div>}
      <strong>{point.usage} kWh/day</strong>
      {point.kwh != null && <div style={{ color: '#6b7a70' }}>{Number(point.kwh).toFixed(1)} kWh in total</div>}
    </div>
  )
}

export function UsageChart({ data, compact = false }) {
  return (
    <div className={`chart-wrap ${compact ? 'chart-compact' : ''}`} role="img" aria-label="Average daily electricity use between meter readings in kilowatt-hours per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e3ebe5" strokeDasharray="3 5" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#86948b', fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#86948b', fontSize: 12 }} tickFormatter={value => `${value}`} />
          <Tooltip cursor={{ fill: '#eef6f1' }} content={<UsageTooltip />} />
          <Bar dataKey="usage" radius={[8, 8, 3, 3]} maxBarSize={40}>
            {data.map((entry, index) => <Cell key={entry.id ?? index} fill={index === data.length - 1 ? '#1f8a4c' : '#9fd6b2'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}