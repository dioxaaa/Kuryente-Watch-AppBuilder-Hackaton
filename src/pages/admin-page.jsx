import { ArrowLeft, Check, Code2, Eye, Info, ShieldCheck, Sparkles, X } from 'lucide-react'
import { PageTitle } from '../components/page-title'

export function AdminPage({ onNavigate }) {
  const items = [
    ['Dashboard and sample charts', true],
    ['Meter form and photo preview', true],
    ['Appliance inventory interactions', true],
    ['Local persistence and accounts', false],
    ['OCR, AI, and live meter data', false],
  ]
  return (
    <>
      <PageTitle eyebrow="PROTOTYPE OVERVIEW" title="About this demo" description="A presentation-ready frontend exploration of a local-first household energy companion." action={<button className="button button-secondary" onClick={() => onNavigate('dashboard')}><ArrowLeft size={15} /> Back to dashboard</button>} />
      <div className="demo-banner"><Info size={16} /><span><strong>This is not an admin console.</strong> There are no accounts, server controls, or administrative data here.</span></div>
      <div className="about-grid">
        <section className="panel about-hero"><div className="about-brand-icon"><span className="brand-mark"><span>ϟ</span></span></div><span className="eyebrow">KURYENTEWATCH · UI PROTOTYPE</span><h2>The Local Energy Detective</h2><p>Designed to help Filipino households understand their electricity habits with clarity, useful estimates, and privacy in mind.</p><button className="button button-primary" onClick={() => onNavigate('meter')}><Eye size={16} /> Explore meter flow</button></section>
        <section className="panel about-status"><div className="panel-heading"><div><h2>Prototype status</h2><p>What works in this UI demo today</p></div><span className="badge badge-success"><i /> UI DEMO</span></div>{items.map(([label, done]) => <div className="status-row" key={label}><span className={`status-icon ${done ? 'status-ready' : 'status-off'}`}>{done ? <Check size={14} /> : <X size={14} />}</span><span>{label}</span><small>{done ? 'Interactive demo' : 'Not connected'}</small></div>)}</section>
      </div>
      <section className="panel principles-panel"><div className="panel-heading"><div><h2>Principles behind the experience</h2><p>Designed to make energy data approachable, without overstating what the product knows.</p></div></div><div className="principles-grid"><div><ShieldCheck size={19} /><strong>Privacy by design</strong><span>No backend or data transmission in this prototype.</span></div><div><Sparkles size={19} /><strong>Honest estimates</strong><span>Sample and rated-power estimates are clearly labeled.</span></div><div><Code2 size={19} /><strong>Built for iteration</strong><span>OCR and anomaly interfaces can be explored separately later.</span></div></div></section>
    </>
  )
}
