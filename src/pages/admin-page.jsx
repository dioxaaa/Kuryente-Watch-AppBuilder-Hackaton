import { ArrowLeft, Check, Code2, Eye, Info, ShieldCheck, Sparkles, X } from 'lucide-react'
import { PageTitle } from '../components/page-title'

export function AdminPage({ onNavigate }) {
  const items = [
    ['Profile and household setup', true],
    ['Meter reading history in SQLite', true],
    ['Appliance estimates and settings', true],
    ['Local statistical anomaly detector', true],
    ['Local Ollama Energy Assistant (model required)', true],
  ]
  return (
    <>
      <PageTitle eyebrow="LOCAL INSTALLATION" title="About KuryenteWatch" description="A household energy companion running on this computer." action={<button className="button button-secondary" onClick={() => onNavigate('dashboard')}><ArrowLeft size={15} /> Back to dashboard</button>} />
      <div className="demo-banner"><Info size={16} /><span><strong>No online account or cloud service.</strong> Your profile and household records are stored in local SQLite; the optional Energy Assistant requires Ollama installed on this computer.</span></div>
      <div className="about-grid">
        <section className="panel about-hero"><div className="about-brand-icon"><span className="brand-mark"><span>ϟ</span></span></div><span className="eyebrow">KURYENTEWATCH · LOCAL APP</span><h2>The Local Energy Detective</h2><p>Designed to help Filipino households track cumulative meter readings, explore appliance estimates, and review local rule-based usage signals.</p><button className="button button-primary" onClick={() => onNavigate('meter')}><Eye size={16} /> Add a meter reading</button></section>
        <section className="panel about-status"><div className="panel-heading"><div><h2>Feature availability</h2><p>Local database-backed capabilities</p></div><span className="badge badge-success"><i /> LOCAL APP</span></div>{items.map(([label, done]) => <div className="status-row" key={label}><span className={`status-icon ${done ? 'status-ready' : 'status-off'}`}>{done ? <Check size={14} /> : <X size={14} />}</span><span>{label}</span><small>{done ? 'Available locally' : 'Not connected'}</small></div>)}</section>
      </div>
      <section className="panel principles-panel"><div className="panel-heading"><div><h2>How this installation works</h2><p>Internet access is not required while the local server is running.</p></div></div><div className="principles-grid"><div><ShieldCheck size={19} /><strong>Local database</strong><span>SQLite files live under the project data/ folder and are excluded from Git.</span></div><div><Sparkles size={19} /><strong>Estimates stay estimates</strong><span>Appliance figures use rating-label watts and hours, not live consumption.</span></div><div><Code2 size={19} /><strong>Keep the server running</strong><span>The frontend shell can be cached, but data features need the local Node process.</span></div></div></section>
    ['Meter readings, saved in the local database', true],
    ['Appliance list, saved in the local database', true],
    ['Settings, saved in the local database', true],
    ['Usage charts worked out from your readings', true],
    ['Local AI energy assistant (needs Ollama running)', true],
    ['Alerts from the anomaly detector, explained by the local AI (needs Ollama running)', true],
    ['Meter reading from a photo, read by a local vision model (needs Ollama)', true],
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