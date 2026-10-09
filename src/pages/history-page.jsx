import { useMemo, useState } from 'react'
import { CalendarDays, Download, TrendingUp, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { EmptyState } from '../components/empty-state'
import { UsageChart } from '../components/usage-chart'
import { formatDate } from '../utils/energy-utils'

function exportReadings(readings, onToast) {
  if (!readings.length) return onToast('There are no readings to export.')
  const rows = [
    ['Recorded at', 'Cumulative reading (kWh)', 'Usage since previous (kWh)', 'Notes'],
    ...readings.map(reading => [
      reading.recordedAt,
      reading.readingKwh,
      reading.usageKwh ?? '',
      `"${String(reading.notes || '').replaceAll('"', '""')}"`,
    ]),
  ]
  const blob = new Blob([rows.map(row => row.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'kuryentewatch-meter-readings.csv'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  onToast('Meter-reading CSV downloaded to this device.')
}

export function HistoryPage({ readings, onToast }) {
  const [range, setRange] = useState('30 days')
  const rangeDays = range === '7 days' ? 7 : range === '30 days' ? 30 : 90
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000
  const visibleReadings = useMemo(() => readings.filter(reading => new Date(reading.recordedAt).getTime() >= cutoff), [readings, cutoff])
  const usageData = visibleReadings.filter(reading => reading.usageKwh !== null).map(reading => ({
    day: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(reading.recordedAt)),
    usage: Number(reading.usageKwh.toFixed(2)),
  }))
  const average = usageData.length ? usageData.reduce((sum, item) => sum + item.usage, 0) / usageData.length : null
  const total = usageData.reduce((sum, item) => sum + item.usage, 0)
  return (
    <>
      <PageTitle eyebrow="TRACK YOUR USAGE" title="Energy history" description="Review household meter entries and their calculated differences." action={<button className="button button-secondary" onClick={() => exportReadings(readings, onToast)}><Download size={16} /> Export CSV</button>} />
      <div className="demo-banner"><CalendarDays size={16} /><span><strong>From your local database.</strong> Usage is the difference between cumulative readings, never a simulated sensor value.</span></div>
      <section className="panel history-chart-panel">
        <div className="panel-heading history-heading"><div><h2>Usage between readings</h2><p>Calculated change in household meter value · kWh</p></div><div className="range-selector" role="group" aria-label="Filter history by date range">{['7 days', '30 days', '90 days'].map(item => <button key={item} className={range === item ? 'range-active' : ''} onClick={() => setRange(item)} aria-pressed={range === item}>{item}</button>)}</div></div>
        <div className="history-summary"><div><span>Usage in selected range</span><strong>{usageData.length ? total.toFixed(1) : '—'} <small>kWh</small></strong></div><div><span>Average per reading interval</span><strong>{average !== null ? average.toFixed(1) : '—'} <small>kWh</small></strong></div><div><span>Readings in range</span><strong>{visibleReadings.length}</strong></div></div>
        {usageData.length ? <UsageChart data={usageData} /> : <EmptyState title="Not enough readings for a chart" description="Record at least two meter readings in the selected period to calculate usage." />}
        <p className="chart-disclaimer"><span className="legend-circle" /> Each point represents a measured cumulative meter reading difference.</p>
      </section>
      <section className="panel reading-history-panel">
        <div className="panel-heading"><div><h2>Meter reading history</h2><p>Stored locally · cumulative kWh and interval change</p></div><span className="badge badge-neutral">{visibleReadings.length} ENTRIES</span></div>
        {visibleReadings.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>DATE ADDED</th><th>CUMULATIVE METER</th><th>USAGE SINCE PREVIOUS</th><th>NOTES</th></tr></thead><tbody>{visibleReadings.slice().reverse().map(reading => (
          <tr key={reading.id}><td><strong>{formatDate(reading.recordedAt)}</strong><small>{new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(reading.recordedAt))}</small></td><td><strong>{reading.readingKwh.toLocaleString()} kWh</strong></td><td>{reading.usageKwh !== null ? <span className="delta-positive"><TrendingUp size={14} /> {reading.usageKwh.toFixed(2)} kWh</span> : <span className="muted-copy">First reading</span>}</td><td>{reading.notes || <span className="muted-copy">—</span>}</td></tr>
        ))}</tbody></table></div> : <EmptyState title="No meter readings in this range" description="Add a cumulative meter reading to start building your household history." />}
      </section>
    </>
  )
}
