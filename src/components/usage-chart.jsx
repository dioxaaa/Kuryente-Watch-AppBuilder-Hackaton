import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function UsageChart({ data, compact = false }) {
  return (
    <div className={`chart-wrap ${compact ? 'chart-compact' : ''}`} role="img" aria-label="Electricity usage between meter readings in kilowatt-hours">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 5" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8a958e', fontSize: 11 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a958e', fontSize: 11 }} tickFormatter={value => `${value}`} />
          <Tooltip cursor={{ fill: '#f0f5ef' }} contentStyle={{ border: '1px solid #e6ebe6', borderRadius: 12, boxShadow: '0 8px 24px #102c1917' }} formatter={value => [`${value} kWh`, 'Meter usage']} />
          <Bar dataKey="usage" fill="#27a36b" radius={[5, 5, 1, 1]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}