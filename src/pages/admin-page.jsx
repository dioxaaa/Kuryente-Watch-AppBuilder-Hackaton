import { ArrowLeft, Check, Code2, Eye, Info, ShieldCheck, Sparkles, X } from 'lucide-react'
import { PageTitle } from '../components/page-title'

const features = [
  ['Profile and household setup', true],
  ['Meter readings saved in local SQLite', true],
  ['Appliance estimates and settings', true],
  ['Local statistical anomaly detector', true],
  ['Ollama Energy Assistant (local model required)', true],
  ['Accounts and multi-device syncing', false],
]

export function AdminPage({ onNavigate }) {
  return (
    <>
      <PageTitle eyebrow="LOCAL INSTALLATION" title="About KuryenteWatch" description="A household energy companion running on this computer." action={<button className="button button-secondary" onClick={() => onNavigate('dashboard')}><ArrowLeft size={15} /> Back to dashboard</button>} />
      <div className="demo-banner"><Info size={16} /><span><strong>No online account or cloud service.</strong> Your household records are stored in local SQLite. The optional assistant requires Ollama installed locally.</span></div>
      <div className="about-grid">
        <section className="panel about-hero">
          <div className="about-brand-icon"><span className="brand-mark"><span>ϟ</span></span></div>
          <span className="eyebrow">KURYENTEWATCH · LOCAL APP</span>
          <h2>The Local Energy Detective</h2>
          <p>Track cumulative meter readings, explore appliance estimates, and review local rule-based usage signals.</p>
          <button className="button button-primary" onClick={() => onNavigate('meter')}><Eye size={16} /> Add a meter reading</button>
        </section>
        <section className="panel about-status">
          <div className="panel-heading"><div><h2>Feature availability</h2><p>Local installation capabilities</p></div><span className="badge badge-success"><i /> LOCAL APP</span></div>
          {features.map(([label, ready]) => (
            <div className="status-row" key={label}>
              <span className={`status-icon ${ready ? 'status-ready' : 'status-off'}`}>{ready ? <Check size={14} /> : <X size={14} />}</span>
              <span>{label}</span><small>{ready ? 'Available locally' : 'Not connected'}</small>
            </div>
          ))}
        </section>
      </div>
      <section className="panel principles-panel">
        <div className="panel-heading"><div><h2>How this installation works</h2><p>The internet is not required while the local server is running.</p></div></div>
        <div className="principles-grid">
          <div><ShieldCheck size={19} /><strong>Local database</strong><span>SQLite files live under the project data/ folder and are excluded from Git.</span></div>
          <div><Sparkles size={19} /><strong>Estimates stay estimates</strong><span>Appliance figures use rated watts and hours, not live consumption.</span></div>
          <div><Code2 size={19} /><strong>Keep the server running</strong><span>The cached app shell does not keep SQLite available when Node is stopped.</span></div>
        </div>
      </section>
    </>
  )
}
