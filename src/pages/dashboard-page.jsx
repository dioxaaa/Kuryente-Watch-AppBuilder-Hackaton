import { ArrowRight, Clock3, Droplets, Gauge, Plus, ShieldAlert, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { StatCard } from '../components/stat-card'
import { UsageChart } from '../components/usage-chart'
import { EmptyState } from '../components/empty-state'
import { formatDate, formatPeso } from '../utils/energy-utils'

export function DashboardPage({ profile, readings, alerts, appliances, rate, onNavigate }) {
  const current = readings.at(-1)
  const previous = readings.at(-2)
  const currentMonth = new Date()
  currentMonth.setDate(1)
  currentMonth.setHours(0, 0, 0, 0)
  const monthUsage = readings
    .filter(reading => new Date(reading.recordedAt) >= currentMonth && reading.usageKwh !== null)
    .reduce((total, reading) => total + reading.usageKwh, 0)
  const monthIntervals = readings.filter(reading => new Date(reading.recordedAt) >= currentMonth && reading.usageKwh !== null).length
  const usageData = readings.filter(reading => reading.usageKwh !== null).slice(-7).map(reading => ({
    day: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(reading.recordedAt)),
    usage: Number(reading.usageKwh.toFixed(2)),
  }))
  const freshAlerts = alerts.filter(alert => !alert.read && !alert.dismissed).slice(0, 2)
  const greeting = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()
  return (
    <>
      <PageTitle eyebrow={greeting} title={`Good day, ${profile.userName} 👋`} description={`${profile.householdName} · A clear view of your household energy.`} action={<button className="button button-primary" onClick={() => onNavigate('meter')}><Zap size={17} /> Add meter reading</button>} />
      <div className="stats-grid" aria-label="Household energy overview">
        <StatCard label="Recorded use this month" value={monthIntervals ? monthUsage.toFixed(1) : '—'} unit={monthIntervals ? ' kWh' : ''} note={monthIntervals ? 'Sum of meter-reading intervals' : 'Add another reading to calculate use'} icon={Zap} />
        <StatCard label="Estimated bill" value={monthIntervals ? formatPeso(monthUsage * rate) : '—'} unit="" note={`Estimate at ₱${Number(rate).toFixed(2)} / kWh`} icon={Gauge} tone="amber" />
        <StatCard label="Latest meter reading" value={current?.readingKwh.toLocaleString() ?? '—'} unit={current ? ' kWh' : ''} note={current ? formatDate(current.recordedAt) : 'No reading recorded yet'} icon={Droplets} tone="blue" />
        <StatCard label="Use since previous" value={current?.usageKwh != null ? current.usageKwh.toFixed(1) : '—'} unit={current?.usageKwh != null ? ' kWh' : ''} note={previous ? 'Difference between cumulative readings' : 'Add a second reading to compare'} icon={Clock3} tone="purple" />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Usage between readings</h2><p>Calculated from cumulative meter values · kWh</p></div><button className="text-button" onClick={() => onNavigate('history')}>Full history <ArrowRight size={15} /></button></div>
          {usageData.length ? <><div className="chart-legend"><span><i /> Meter consumption <b>kWh</b></span><span className="chart-period">Latest readings</span></div><UsageChart data={usageData} /><div className="chart-footer"><span>Each bar is the difference from the previous reading</span><button className="text-button" onClick={() => onNavigate('meter')}>Add reading <Plus size={14} /></button></div></> :
            <EmptyState title="Your chart starts with a second reading" description="Record two cumulative meter values and we’ll calculate the energy used between them." action={<button className="button button-secondary" onClick={() => onNavigate('meter')}>Add a reading</button>} />}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Household snapshot</h2><p>Data stored in your local SQLite database</p></div><button className="icon-button subtle-button" aria-label="Manage appliances" onClick={() => onNavigate('appliances')}>···</button></div>
          <div className="activity-reading">
            <div className="meter-illustration"><Gauge size={23} /></div>
            <div className="activity-reading-copy"><span>Latest confirmed reading</span><strong>{current?.readingKwh.toLocaleString() ?? '—'} <small>kWh</small></strong><small>{current ? `${formatDate(current.recordedAt)} · saved locally` : 'No meter reading yet'}</small></div>
            <span className="badge badge-success">LOCAL</span>
          </div>
          <div className="activity-divider" />
          <div className="activity-list">
            {appliances.slice(0, 3).map((appliance, index) => (
              <div className="activity-item" key={appliance.id}><span className={`activity-dot dot-${index}`} /><span><strong>{appliance.name}</strong><small>{appliance.category} · {appliance.isSample ? 'sample' : 'rated-power estimate'}</small></span><b>{((appliance.ratedWatts * appliance.hoursPerDay * 30) / 1000).toFixed(1)} <small>kWh/mo</small></b></div>
            ))}
            {!appliances.length && <p className="muted-copy">No appliances yet. Add one to see rated-power estimates.</p>}
          </div>
          <button className="panel-bottom-link" onClick={() => onNavigate('appliances')}><Plus size={15} /> Manage appliances <ArrowRight size={15} /></button>
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel alerts-preview">
          <div className="panel-heading"><div><h2>Local usage alerts</h2><p>Rule-based signals · not an appliance diagnosis</p></div><button className="text-button" onClick={() => onNavigate('alerts')}>View all <ArrowRight size={15} /></button></div>
          {freshAlerts.length ? freshAlerts.map(alert => <div className="preview-alert" key={alert.id}><span className={`severity-marker severity-${alert.severity}`}><ShieldAlert size={16} /></span><span><strong>{alert.title}</strong><small>{alert.device || 'Household'} · local rule signal</small></span><span className="badge badge-warning">NEW</span></div>) : <p className="muted-copy">No unread alerts. New detector signals appear here after local analysis.</p>}
        </section>
        <section className="panel insight-panel"><div className="insight-icon"><ShieldAlert size={19} /></div><div><span className="eyebrow">LOCAL ANALYSIS · RULE-BASED</span><h2>Unusual patterns are signals, not diagnoses</h2><p>The built-in detector compares locally stored device power readings against a learned baseline. It does not use a cloud or AI model.</p><button className="text-button" onClick={() => onNavigate('alerts')}>Review alerts <ArrowRight size={15} /></button></div></section>
      </div>
    </>
  )
}
