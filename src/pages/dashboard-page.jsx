import { ArrowRight, Clock3, Droplets, Gauge, Plus, Sparkles, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { StatCard } from '../components/stat-card'
import { UsageChart } from '../components/usage-chart'
import { formatDate, formatPeso } from '../utils/energy-utils'
import { AssistantWidget } from '../components/assistant-widget'

export function DashboardPage({ readings, alerts, appliances, rate, onNavigate }) {
  const current = readings[readings.length - 1]
  const previous = readings[readings.length - 2]
  const delta = current && previous ? current.kwh - previous.kwh : 0
  const estimatedMonthKwh = 248
  const freshAlerts = alerts.filter(alert => !alert.read).slice(0, 2)
  return (
    <>
      <PageTitle eyebrow="THURSDAY, OCTOBER 9" title="Good morning, Maria 👋" description="Here’s your household energy snapshot. All figures shown are sample demo data." action={<button className="button button-primary" onClick={() => onNavigate('meter')}><Zap size={17} /> Scan meter</button>} />
      <div className="demo-banner"><Sparkles size={16} /><span><strong>Demo data</strong> — sample values for presentation only, not live meter readings.</span><button onClick={() => onNavigate('about')}>About this demo <ArrowRight size={14} /></button></div>
      <section className="stats-grid" aria-label="Usage overview">
        <StatCard label="This month" value={estimatedMonthKwh} unit=" kWh" note="Sample usage estimate" trend="+8.2%" icon={Zap} />
        <StatCard label="Estimated bill" value={formatPeso(estimatedMonthKwh * rate)} unit="" note={`At ₱${rate.toFixed(2)} / kWh`} trend="+5.1%" icon={Gauge} tone="amber" />
        <StatCard label="Latest meter reading" value={current?.kwh.toLocaleString() ?? '—'} unit=" kWh" note={current ? `${current.source} · ${formatDate(current.date)}` : 'No readings yet'} icon={Droplets} tone="blue" />
        <StatCard label="Since previous reading" value={delta || '—'} unit={delta ? ' kWh' : ''} note={previous ? `Change since previous ${current?.source === 'Sample' ? 'sample' : 'reading'}` : 'Add another reading'} icon={Clock3} tone="purple" />
      </section>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Usage this week</h2><p>Daily electricity consumption · sample data</p></div><button className="text-button" onClick={() => onNavigate('history')}>Full history <ArrowRight size={15} /></button></div>
          <div className="chart-legend"><span><i /> Daily usage <b>kWh</b></span><span className="chart-period">Last 7 days <span>⌄</span></span></div>
          <UsageChart data={[{ day: 'Mon', usage: 8.1 }, { day: 'Tue', usage: 6.9 }, { day: 'Wed', usage: 7.6 }, { day: 'Thu', usage: 9.4 }, { day: 'Fri', usage: 7.2 }, { day: 'Sat', usage: 10.1 }, { day: 'Sun', usage: 8.7 }]} />
          <div className="chart-footer"><span>Average daily use <strong>8.3 kWh</strong></span><span>Peak day <strong>Saturday · 10.1 kWh</strong></span></div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Your household at a glance</p></div><button className="icon-button subtle-button" aria-label="More activity options" onClick={() => onNavigate('history')}>···</button></div>
          <div className="activity-reading">
            <div className="meter-illustration"><Gauge size={23} /></div>
            <div className="activity-reading-copy"><span>Latest meter reading</span><strong>{current?.kwh.toLocaleString()} <small>kWh</small></strong><small>Sample · {current ? formatDate(current.date) : 'No reading'}</small></div>
            <span className={`badge ${current?.source === 'Sample' ? 'badge-demo' : 'badge-success'}`}>{current?.source === 'Sample' ? 'DEMO' : 'USER ENTRY'}</span>
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
        <section className="panel insight-panel"><div className="insight-icon"><Sparkles size={19} /></div><div><span className="eyebrow">A QUICK INSIGHT · DEMO</span><h2>Your AC is your biggest energy user</h2><p>Based on the sample rated-watt estimates. Actual usage may vary with appliance behavior and conditions.</p><button className="text-button" onClick={() => onNavigate('appliances')}>Explore appliances <ArrowRight size={15} /></button></div></section>
      </div>
            <AssistantWidget readings={readings} appliances={appliances} alerts={alerts} rate={rate} monthKwh={estimatedMonthKwh} />
    </>

  )
}
