import { useEffect, useState } from 'react'
import { Bell, Check, CircleHelp, RotateCcw, Save, Settings2, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { ConfirmModal } from '../components/confirm-modal'

export function SettingsPage({ settings, onSave, onToast }) {
  const [form, setForm] = useState({ ...settings })
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => setForm({ ...settings }), [settings])
  function save(event) {
    event.preventDefault()
    if (!form.household.trim()) {
      onToast('Enter a household name.')
      return
    }
    if (!form.rate || Number(form.rate) <= 0 || Number(form.rate) > 1000) {
      onToast('Enter a rate between ₱0.01 and ₱1,000 per kWh.')
      return
    }
    onSave({ ...form, rate: Number(form.rate) })
    onToast('Settings saved for this demo session.')
  }
  function reset() {
    const defaults = { rate: 12.5, household: 'Casa de Santos', compact: false, weeklySummary: true }
    setForm(defaults)
    onSave(defaults)
    setConfirmReset(false)
    onToast('Settings reset for this demo session.')
  }
  return (
    <>
      <PageTitle eyebrow="MAKE IT YOURS" title="Settings" description="Personalize the demo household and sample energy-rate estimates." action={<button className="button button-secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset</button>} />
      <div className="demo-banner"><ShieldCheck size={16} /><span><strong>Temporary settings.</strong> Changes only stay in React state and reset when you refresh the page.</span></div>
      <form className="settings-layout" onSubmit={save}>
        <div className="settings-main">
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><Settings2 size={18} /></span><div><h2>Household details</h2><p>Give your demo household a familiar name.</p></div></div>
            <div className="settings-field"><label htmlFor="household-name">Household name</label><input id="household-name" value={form.household} onChange={event => setForm({ ...form, household: event.target.value })} placeholder="e.g. Casa de Santos" /></div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><SlidersHorizontal size={18} /></span><div><h2>Energy rate</h2><p>Used for estimated bills only. Your utility rate may vary.</p></div></div>
            <div className="settings-field rate-field"><label htmlFor="rate-per-kwh">Electricity price</label><div className="input-with-unit"><span>₱</span><input id="rate-per-kwh" type="number" min="0.01" max="1000" step="0.01" value={form.rate} onChange={event => setForm({ ...form, rate: event.target.value })} /><span>/ kWh</span></div><small>Demo default: ₱12.50 per kWh. Check your latest bill for your actual rate.</small></div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><Bell size={18} /></span><div><h2>Display preferences</h2><p>Adjust this prototype's presentation.</p></div></div>
            <div className="preference-row"><span className="preference-icon"><UserRound size={17} /></span><span><strong>Compact overview</strong><small>Show a denser summary layout</small></span><button type="button" role="switch" aria-checked={form.compact} className={`toggle ${form.compact ? 'toggle-on' : ''}`} onClick={() => setForm({ ...form, compact: !form.compact })}><i /></button></div>
            <div className="preference-row"><span className="preference-icon"><Bell size={17} /></span><span><strong>Weekly summary reminder</strong><small>Demo-only display preference</small></span><button type="button" role="switch" aria-checked={form.weeklySummary} className={`toggle ${form.weeklySummary ? 'toggle-on' : ''}`} onClick={() => setForm({ ...form, weeklySummary: !form.weeklySummary })}><i /></button></div>
          </section>
          <div className="settings-save-row"><span><Check size={14} /> Changes apply to this demo session</span><button className="button button-primary" type="submit"><Save size={16} /> Save settings</button></div>
        </div>
        <aside className="settings-aside">
          <section className="panel account-card"><div className="settings-section-heading"><span className="avatar avatar-large">MS</span><div><h3>Maria Santos</h3><p>Demo household owner</p></div></div><div className="account-separator" /><div className="account-detail"><span>Household</span><strong>{form.household || 'Casa de Santos'}</strong></div><div className="account-detail"><span>Electricity rate</span><strong>₱{Number(form.rate || 0).toFixed(2)} / kWh</strong></div><span className="badge badge-demo"><i /> DEMO PROFILE</span></section>
          <section className="panel privacy-card-settings"><span className="privacy-large-icon"><ShieldCheck size={21} /></span><h3>Privacy first</h3><p>This is a frontend-only prototype. Your inputs and photos remain in this browser session and are not sent to a server.</p><button type="button" className="text-button" onClick={() => onToast('This is a UI prototype with no data export or remote services.')}>Learn about this demo <CircleHelp size={15} /></button></section>
        </aside>
      </form>
      {confirmReset && <ConfirmModal title="Reset demo settings?" description="Your rate, household name, and display preferences will return to their demo defaults." confirmLabel="Reset settings" onConfirm={reset} onCancel={() => setConfirmReset(false)} />}
    </>
  )
}
