import { useEffect, useState } from 'react'
import { Bell, Check, CircleHelp, RotateCcw, Save, Settings2, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { initialsOf } from '../utils/energy-utils'
import { ConfirmModal } from '../components/confirm-modal'
import { DEFAULT_SETTINGS } from '../utils/settings'

export function SettingsPage({ settings, onSave, onToast }) {
  const [form, setForm] = useState({ ...settings })
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => setForm({ ...settings }), [settings])
  async function save(event) {
    event.preventDefault()
    if (!form.household.trim()) {
      onToast('Enter a household name.')
      return
    }
    if (!form.rate || Number(form.rate) <= 0 || Number(form.rate) > 1000) {
      onToast('Enter a rate between ₱0.01 and ₱1,000 per kWh.')
      return
    }
    if (await onSave({ ...form, rate: Number(form.rate) })) onToast('Settings saved.')
  }
  async function reset() {
    setConfirmReset(false)
    if (await onSave(DEFAULT_SETTINGS)) { setForm(DEFAULT_SETTINGS); onToast('Settings reset to defaults.') }
  }
  return (
    <>
      <PageTitle eyebrow="MAKE IT YOURS" title="Settings" description="Set your household name and electricity rate. They are saved on this computer." action={<button className="button button-secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset</button>} />
      <div className="demo-banner"><ShieldCheck size={16} /><span><strong>Saved locally.</strong> Settings are stored in the database on this computer, so they are still here after you refresh.</span></div>
      <form className="settings-layout" onSubmit={save}>
        <div className="settings-main">
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><Settings2 size={18} /></span><div><h2>Household details</h2><p>Give your household a familiar name.</p></div></div>
            <div className="settings-field"><label htmlFor="household-name">Household name</label><input id="household-name" value={form.household} onChange={event => setForm({ ...form, household: event.target.value })} placeholder="e.g. Casa de Santos" /></div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><SlidersHorizontal size={18} /></span><div><h2>Energy rate</h2><p>Used for estimated bills only. Your utility rate may vary.</p></div></div>
            <div className="settings-field rate-field"><label htmlFor="rate-per-kwh">Electricity price</label><div className="input-with-unit"><span>₱</span><input id="rate-per-kwh" type="number" min="0.01" max="1000" step="0.01" value={form.rate} onChange={event => setForm({ ...form, rate: event.target.value })} /><span>/ kWh</span></div><small>Default: ₱12.50 per kWh. Check your latest bill for your actual rate.</small></div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><Bell size={18} /></span><div><h2>Display preferences</h2><p>Adjust how the app looks and what it reminds you of.</p></div></div>
            <div className="preference-row"><span className="preference-icon"><UserRound size={17} /></span><span><strong>Compact overview</strong><small>Show a denser summary layout</small></span><button type="button" role="switch" aria-checked={form.compact} className={`toggle ${form.compact ? 'toggle-on' : ''}`} onClick={() => setForm({ ...form, compact: !form.compact })}><i /></button></div>
            <div className="preference-row"><span className="preference-icon"><Bell size={17} /></span><span><strong>Weekly summary reminder</strong><small>Saved, but no reminders are sent yet</small></span><button type="button" role="switch" aria-checked={form.weeklySummary} className={`toggle ${form.weeklySummary ? 'toggle-on' : ''}`} onClick={() => setForm({ ...form, weeklySummary: !form.weeklySummary })}><i /></button></div>
          </section>
          <div className="settings-save-row"><span><Check size={14} /> Changes are saved on this computer</span><button className="button button-primary" type="submit"><Save size={16} /> Save settings</button></div>
        </div>
        <aside className="settings-aside">
          <section className="panel account-card"><div className="settings-section-heading"><span className="avatar avatar-large">{initialsOf(form.household)}</span><div><h3>{form.household || 'My household'}</h3><p>Household owner</p></div></div><div className="account-separator" /><div className="account-detail"><span>Household</span><strong>{form.household || 'Casa de Santos'}</strong></div><div className="account-detail"><span>Electricity rate</span><strong>₱{Number(form.rate || 0).toFixed(2)} / kWh</strong></div><span className="badge badge-success"><i /> SAVED LOCALLY</span></section>
          <section className="panel privacy-card-settings"><span className="privacy-large-icon"><ShieldCheck size={21} /></span><h3>Privacy first</h3><p>Your readings, appliances and settings are saved in a database on this computer. Photos are not stored, and nothing is sent to the internet.</p><button type="button" className="text-button" onClick={() => onToast('Your data stays in the local database. Reading history can be exported as CSV from Energy history.')}>How your data is stored <CircleHelp size={15} /></button></section>
        </aside>
      </form>
      {confirmReset && <ConfirmModal title="Reset settings?" description="Your rate, household name, and display preferences will return to their defaults." confirmLabel="Reset settings" onConfirm={reset} onCancel={() => setConfirmReset(false)} />}
    </>
  )
}