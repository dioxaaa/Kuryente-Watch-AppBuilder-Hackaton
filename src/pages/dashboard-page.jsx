import { ArrowRight, Clock3, Droplets, Gauge, Plus, Sparkles, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { StatCard } from '../components/stat-card'
import { UsageChart } from '../components/usage-chart'
import { EmptyState } from '../components/empty-state'
import { estimateDailyKwh, estimateMonthKwh, formatDate, formatPeso, usageFromReadings } from '../utils/energy-utils'
import { AssistantWidget } from '../components/assistant-widget'

const todayLabel = () => new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }

export function DashboardPage({ readings, alerts, appliances, rate, household, onNavigate }) {
  const current = readings[readings.length - 1]
  const previous = readings[readings.length - 2]
  const delta = current && previous ? current.kwh - previous.kwh : 0
  const estimatedMonthKwh = Math.round(estimateMonthKwh(appliances))
  const freshAlerts = alerts.filter(alert => !alert.read).slice(0, 2)
  const weekly = usageFromReadings(readings).slice(-7)
  const weeklyAverage = weekly.length ? weekly.reduce((sum, item) => sum + item.usage, 0) / weekly.length : 0
  const peak = weekly.reduce((best, item) => (!best || item.usage > best.usage ? item : best), null)
  const biggest = appliances.reduce((best, item) => (!best || estimateDailyKwh(item) > estimateDailyKwh(best) ? item : best), null)
  return (
    <>
      <PageTitle eyebrow={todayLabel()} title={`${greeting()}, ${household || 'there'} 👋`} description="Here’s your household energy snapshot." action={<button className="button button-primary" onClick={() => onNavigate('meter')}><Zap size={17} /> Add meter reading</button>} />
      <div className="demo-banner"><Sparkles size={16} /><span><strong>Your readings, appliances and settings are saved on this computer.</strong> Alerts below are still sample data.</span><button onClick={() => onNavigate('about')}>About this prototype <ArrowRight size={14} /></button></div>
      <section className="stats-grid" aria-label="Usage overview">
        <StatCard label="Monthly estimate" value={estimatedMonthKwh} unit=" kWh" note="From your appliance list" icon={Zap} />
        <StatCard label="Estimated bill" value={formatPeso(estimatedMonthKwh * rate)} unit="" note={`At ₱${rate.toFixed(2)} / kWh`} icon={Gauge} tone="amber" />
        <StatCard label="Latest meter reading" value={current?.kwh.toLocaleString() ?? '—'} unit={current ? ' kWh' : ''} note={current ? `${current.source} · ${formatDate(current.date)}` : 'No readings yet'} icon={Droplets} tone="blue" />
        <StatCard label="Since previous reading" value={previous ? delta.toFixed(1) : '—'} unit={previous ? ' kWh' : ''} note={previous ? `Since ${formatDate(previous.date)}` : 'Add another reading'} icon={Clock3} tone="purple" />
      </section>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Recent usage</h2><p>Average kWh per day between your meter readings</p></div><button className="text-button" onClick={() => onNavigate('history')}>Full history <ArrowRight size={15} /></button></div>
          {weekly.length ? <>
            <UsageChart data={weekly} />
            <div className="chart-footer"><span>Average daily use <strong>{weeklyAverage.toFixed(1)} kWh</strong></span><span>Peak <strong>{peak.day} · {peak.usage.toFixed(1)} kWh</strong></span></div>
          </> : <EmptyState title="Add two meter readings" description="Usage per day is worked out from the difference between your readings." action={<button className="button button-secondary" onClick={() => onNavigate('meter')}>Add a reading</button>} />}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Your household at a glance</p></div><button className="icon-button subtle-button" aria-label="More activity options" onClick={() => onNavigate('history')}>···</button></div>
          <div className="activity-reading">
            <div className="meter-illustration"><Gauge size={23} /></div>
            <div className="activity-reading-copy"><span>Latest meter reading</span><strong>{current ? current.kwh.toLocaleString() : '—'} <small>kWh</small></strong><small>{current ? `${current.source} · ${formatDate(current.date)}` : 'No reading yet'}</small></div>
            {current && <span className="badge badge-success">USER ENTRY</span>}
          </div>
          <div className="activity-divider" />
          <div className="activity-list">
            {appliances.slice(0, 3).map((appliance, index) => (
              <div className="activity-item" key={appliance.id}><span className={`activity-dot dot-${index}`} /><span><strong>{appliance.name}</strong><small>{appliance.category} · estimated use</small></span><b>{((appliance.watts * appliance.hours * 30) / 1000).toFixed(1)} <small>kWh/mo</small></b></div>
            ))}
          </div>
          <button className="panel-bottom-link" onClick={() => onNavigate('appliances')}><Plus size={15} /> Manage appliances <ArrowRight size={15} /></button>
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel alerts-preview">
          <div className="panel-heading"><div><h2>Needs your attention</h2><p>Sample alerts · no appliance diagnosis</p></div><button className="text-button" onClick={() => onNavigate('alerts')}>View all <ArrowRight size={15} /></button></div>
          {freshAlerts.length ? freshAlerts.map(alert => <div className="preview-alert" key={alert.id}><span className={`severity-marker severity-${alert.severity}`}><Zap size={16} /></span><span><strong>{alert.title}</strong><small>{alert.context}</small></span><span className="badge badge-warning">NEW</span></div>) : <p className="muted-copy">You’re all caught up.</p>}
        </section>
        <section className="panel insight-panel"><div className="insight-icon"><Sparkles size={19} /></div><div><span className="eyebrow">A QUICK INSIGHT</span>{biggest ? <><h2>{biggest.name} is your biggest estimated energy user</h2><p>About {(estimateDailyKwh(biggest) * 30).toFixed(0)} kWh a month, worked out from its rated watts × hours of use. Actual usage may vary with appliance behavior and conditions.</p></> : <><h2>Add your appliances</h2><p>Add what you use at home and we will show which one costs the most.</p></>}<button className="text-button" onClick={() => onNavigate('appliances')}>Explore appliances <ArrowRight size={15} /></button></div></section>
      </div>
      <AssistantWidget readings={readings} appliances={appliances} alerts={alerts} rate={rate} monthKwh={estimatedMonthKwh} />
    </>
  )
}