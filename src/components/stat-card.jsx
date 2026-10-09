import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export function StatCard({ label, value, unit, note, trend, icon: Icon, tone = 'green' }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon stat-icon-${tone}`}><Icon size={18} /></span>
      </div>
      <div className="stat-value">{value}<span>{unit}</span></div>
      <div className="stat-foot">
        {trend && <span className={`trend ${trend.startsWith('-') ? 'trend-down' : 'trend-up'}`}>{trend.startsWith('-') ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{trend}</span>}
        <span>{note}</span>
      </div>
    </article>
  )
}
