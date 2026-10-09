import { ArrowLeft, Check, Code2, Eye, Info, ShieldCheck, Sparkles, X } from 'lucide-react'
import { PageTitle } from '../components/page-title'

export function AdminPage({ onNavigate }) {
  const items = [
    ['Meter readings, saved in the local database', true],
    ['Appliance list, saved in the local database', true],
    ['Settings, saved in the local database', true],
    ['Usage charts worked out from your readings', true],
    ['Local AI energy assistant (needs Ollama running)', true],
    ['Alerts from the anomaly detector, explained by the local AI (needs Ollama running)', true],
    ['Meter reading from a photo (OCR)', false],
    ['Accounts and syncing between devices', false],
  ]
  return (
    <>
      <PageTitle eyebrow="PROTOTYPE OVERVIEW" title="About this prototype" description="A local-first household energy companion. Your data stays on this computer." action={<button className="button button-secondary" onClick={() => onNavigate('dashboard')}><ArrowLeft size={15} /> Back to dashboard</button>} />
      <div className="demo-banner"><Info size={16} /><span><strong>This is not an admin console.</strong> There are no accounts or server controls here.</span></div>
      <div className="about-grid">
        <section className="panel about-hero"><div className="about-brand-icon"><span className="brand-mark"><span>ϟ</span></span></div><span className="eyebrow">KURYENTEWATCH · PROTOTYPE</span><h2>The Local Energy Detective</h2><p>Designed to help Filipino households understand their electricity habits with clarity, useful estimates, and privacy in mind.</p><button className="button button-primary" onClick={() => onNavigate('meter')}><Eye size={16} /> Explore meter flow</button></section>
        <section className="panel about-status"><div className="panel-heading"><div><h2>Prototype status</h2><p>What works today</p></div><span className="badge badge-success"><i /> PROTOTYPE</span></div>{items.map(([label, done]) => <div className="status-row" key={label}><span className={`status-icon ${done ? 'status-ready' : 'status-off'}`}>{done ? <Check size={14} /> : <X size={14} />}</span><span>{label}</span><small>{done ? 'Working' : 'Not connected yet'}</small></div>)}</section>
      </div>
      <section className="panel principles-panel"><div className="panel-heading"><div><h2>Principles behind the experience</h2><p>Designed to make energy data approachable, without overstating what the product knows.</p></div></div><div className="principles-grid"><div><ShieldCheck size={19} /><strong>Privacy by design</strong><span>Data is stored in a database on this computer. Nothing is uploaded.</span></div><div><Sparkles size={19} /><strong>Honest estimates</strong><span>Estimates and sample data are clearly labeled.</span></div><div><Code2 size={19} /><strong>Built for iteration</strong><span>OCR and live device scanning can be explored separately later.</span></div></div></section>
    </>
  )
}