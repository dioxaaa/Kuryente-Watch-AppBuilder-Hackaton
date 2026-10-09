import { useMemo, useState } from 'react'
import { CalendarDays, Download, TrendingUp, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { EmptyState } from '../components/empty-state'
import { UsageChart } from '../components/usage-chart'
import { formatDate, usageFromReadings } from '../utils/energy-utils'

function exportCsv(readings, onToast) {
  if (!readings.length) { onToast('No readings in this period to export.'); return }
  const rows = ['date,kwh,source', ...readings.map(r => `${new Date(r.date).toISOString()},${r.kwh},${String(r.source).replaceAll(',', ' ')}`)]
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: 'kuryentewatch-readings.csv' })
  link.click()
  URL.revokeObjectURL(url)
  onToast('Readings exported.')
}

export function HistoryPage({ readings, onToast }) {
  const [range, setRange] = useState('7 days')
  const rangeDays = range === '7 days' ? 7 : range === '30 days' ? 30 : 90
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000
  const chartData = useMemo(() => usageFromReadings(readings).filter(point => point.date.getTime() >= cutoff), [readings, cutoff])
  const visibleReadings = readings.filter(reading => new Date(reading.date).getTime() >= cutoff)
  const average = chartData.length ? chartData.reduce((sum, item) => sum + item.usage, 0) / chartData.length : 0
  return (
    <>
      <PageTitle eyebrow="TRACK YOUR USAGE" title="Energy history" description="Usage worked out from the meter readings you entered." action={<button className="button button-secondary" onClick={() => exportCsv(visibleReadings, onToast)}><Download size={16} /> Export CSV</button>} />
      <div className="demo-banner"><CalendarDays size={16} /><span><strong>Based on your readings.</strong> Each bar is the average kWh per day between two meter readings, so you need at least two readings.</span></div>
      <section className="panel history-chart-panel">
        <div className="panel-heading history-heading"><div><h2>Electricity usage</h2><p>Household consumption · kWh</p></div><div className="range-selector" role="group" aria-label="Chart date range">{['7 days', '30 days', '90 days'].map(item => <button key={item} className={range === item ? 'range-active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div>
        <div className="history-summary"><div><span>Average daily use</span><strong>{chartData.length ? average.toFixed(1) : '—'} <small>kWh</small></strong></div><div><span>Highest period</span><strong>{chartData.length ? Math.max(...chartData.map(item => item.usage)).toFixed(1) : '—'} <small>kWh/day</small></strong></div><div><span>Period selected</span><strong>{range}</strong></div></div>
        {chartData.length ? <UsageChart data={chartData} /> : <EmptyState title="Not enough readings yet" description="Add at least two meter readings in this period to see daily usage." />}
        <p className="chart-disclaimer"><span className="legend-circle" /> Average kWh per day between meter readings</p>
      </section>
      <section className="panel reading-history-panel">
        <div className="panel-heading"><div><h2>Meter reading history</h2><p>Everything you have entered from your meter</p></div><span className="badge badge-neutral">{visibleReadings.length} ENTRIES</span></div>
        {visibleReadings.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>DATE ADDED</th><th>METER READING</th><th>CHANGE FROM PREVIOUS</th><th>ENTRY TYPE</th></tr></thead><tbody>{visibleReadings.slice().reverse().map((reading, index, ordered) => {
          const older = ordered[index + 1]
          return <tr key={reading.id}><td><strong>{formatDate(reading.date)}</strong><small>{new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(reading.date))}</small></td><td><strong>{reading.kwh.toLocaleString()} kWh</strong></td><td>{reading.reset ? <span className="muted-copy">New meter</span> : older ? <span className="delta-positive"><TrendingUp size={14} /> +{(reading.kwh - older.kwh).toFixed(1)} kWh</span> : <span className="muted-copy">—</span>}</td><td><span className="badge badge-success"><Zap size={12} /> {reading.source.toUpperCase()}</span></td></tr>
        })}</tbody></table></div> : <EmptyState title="No meter readings yet" description="Add a meter reading to start building your household history." />}
      </section>
    </>
  )
}