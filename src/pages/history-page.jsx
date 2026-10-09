import { useMemo, useState } from 'react'
import { CalendarDays, Download, TrendingUp, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { EmptyState } from '../components/empty-state'
import { UsageChart } from '../components/usage-chart'
import { formatDate } from '../utils/energy-utils'

const sampleDays = [
  { day: 'Mon', usage: 8.1, offset: -6 },
  { day: 'Tue', usage: 6.9, offset: -5 },
  { day: 'Wed', usage: 7.6, offset: -4 },
  { day: 'Thu', usage: 9.4, offset: -3 },
  { day: 'Fri', usage: 7.2, offset: -2 },
  { day: 'Sat', usage: 10.1, offset: -1 },
  { day: 'Sun', usage: 8.7, offset: 0 },
]

export function HistoryPage({ readings, onToast }) {
  const [range, setRange] = useState('7 days')
  const rangeDays = range === '7 days' ? 7 : range === '30 days' ? 30 : 90
  const chartData = useMemo(() => {
    if (rangeDays === 7) return sampleDays
    const count = rangeDays === 30 ? 10 : 12
    return Array.from({ length: count }, (_, index) => {
      const factor = rangeDays === 30 ? 1.5 : 3
      const label = rangeDays === 30 ? `D${String(index * 3 + 1).padStart(2, '0')}` : `W${index + 1}`
      return { day: label, usage: Number((6.4 + ((index * 17 + 9) % 38) / 10 * factor / 2).toFixed(1)) }
    })
  }, [rangeDays])
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000
  const visibleReadings = readings.filter(reading => new Date(reading.date).getTime() >= cutoff)
  const average = chartData.reduce((sum, item) => sum + item.usage, 0) / chartData.length
  return (
    <>
      <PageTitle eyebrow="TRACK YOUR USAGE" title="Energy history" description="Explore household meter readings and sample usage over time." action={<button className="button button-secondary" onClick={() => onToast('Export is a prototype preview; no file is generated.')}><Download size={16} /> Export</button>} />
      <div className="demo-banner"><CalendarDays size={16} /><span><strong>Sample chart data.</strong> Meter entries below are labeled by source; daily/weekly chart values are demo illustrations.</span></div>
      <section className="panel history-chart-panel">
        <div className="panel-heading history-heading"><div><h2>Electricity usage</h2><p>Household consumption · kWh</p></div><div className="range-selector" role="group" aria-label="Chart date range">{['7 days', '30 days', '90 days'].map(item => <button key={item} className={range === item ? 'range-active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div>
        <div className="history-summary"><div><span>Average daily use</span><strong>{average.toFixed(1)} <small>kWh</small></strong></div><div><span>Highest sample period</span><strong>{Math.max(...chartData.map(item => item.usage)).toFixed(1)} <small>kWh</small></strong></div><div><span>Period selected</span><strong>{range}</strong></div></div>
        <UsageChart data={chartData} />
        <p className="chart-disclaimer"><span className="legend-circle" /> Demo illustration only · chart is not derived from live meter data</p>
      </section>
      <section className="panel reading-history-panel">
        <div className="panel-heading"><div><h2>Meter reading history</h2><p>User-entered and sample readings shown separately</p></div><span className="badge badge-neutral">{visibleReadings.length} ENTRIES</span></div>
        {visibleReadings.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>DATE ADDED</th><th>METER READING</th><th>CHANGE FROM PREVIOUS</th><th>ENTRY TYPE</th></tr></thead><tbody>{visibleReadings.slice().reverse().map((reading, index, ordered) => {
          const older = ordered[index + 1]
          return <tr key={reading.id}><td><strong>{formatDate(reading.date)}</strong><small>{new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(reading.date))}</small></td><td><strong>{reading.kwh.toLocaleString()} kWh</strong></td><td>{older ? <span className="delta-positive"><TrendingUp size={14} /> +{(reading.kwh - older.kwh).toFixed(1)} kWh</span> : <span className="muted-copy">—</span>}</td><td><span className={`badge ${reading.source === 'Sample' ? 'badge-demo' : 'badge-success'}`}><Zap size={12} /> {reading.source === 'Sample' ? 'DEMO SAMPLE' : reading.source.toUpperCase()}</span></td></tr>
        })}</tbody></table></div> : <EmptyState title="No meter readings yet" description="Add a meter reading to start building your household history." />}
      </section>
    </>
  )
}
