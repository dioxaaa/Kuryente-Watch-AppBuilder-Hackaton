import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function UsageChart({ data, compact = false }) {
  return (
    <div className={`chart-wrap ${compact ? 'chart-compact' : ''}`} role="img" aria-label="Electricity usage between meter readings in kilowatt-hours">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e3ebe5" strokeDasharray="3 5" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#86948b', fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#86948b', fontSize: 12 }} tickFormatter={value => `${value}`} />
          <Tooltip cursor={{ fill: '#eef6f1' }} contentStyle={{ border: '1px solid #dfe8e2', borderRadius: 12, boxShadow: '0 8px 24px #10182817' }} formatter={value => [`${value} kWh`, 'Meter usage']} />
          <Bar dataKey="usage" radius={[8, 8, 3, 3]} maxBarSize={40}>
            {data.map((entry, index) => <Cell key={entry.day} fill={index === data.length - 1 ? '#1f8a4c' : '#9fd6b2'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
