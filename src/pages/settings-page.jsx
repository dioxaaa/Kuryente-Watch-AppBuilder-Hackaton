import { useEffect, useState } from 'react'
import { Bell, Check, CircleHelp, RotateCcw, Save, Settings2, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { ConfirmModal } from '../components/confirm-modal'
import { initialsOf } from '../utils/energy-utils'

function profileSettings(profile, settings) {
  return {
    userName: profile.userName,
    householdName: profile.householdName,
    ratePerKwh: settings.ratePerKwh,
    compact: settings.compact,
    weeklySummary: settings.weeklySummary,
  }
}

export function SettingsPage({ profile, settings, onSave, onResetProfile, onToast }) {
  const [form, setForm] = useState(() => profileSettings(profile, settings))
  const [confirmReset, setConfirmReset] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(profileSettings(profile, settings))
  }, [profile, settings])

  async function save(event) {
    event.preventDefault()
    const userName = form.userName.trim()
    const householdName = form.householdName.trim()
    const ratePerKwh = Number(form.ratePerKwh)
    if (!userName || !householdName) return onToast('Enter both a profile name and household name.', 'error')
    if (userName.length > 80 || householdName.length > 100) return onToast('Name length is too long.', 'error')
    if (!Number.isFinite(ratePerKwh) || ratePerKwh <= 0 || ratePerKwh > 1000) return onToast('Enter a rate between ₱0.01 and ₱1,000 per kWh.', 'error')
    setSaving(true)
    try {
      if (await onSave({ ...form, userName, householdName, ratePerKwh })) onToast('Profile and settings saved to the local database.')
    } catch (error) {
      onToast(error.message || 'Could not save settings.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function resetProfile() {
    try {
      if (await onResetProfile()) {
        setConfirmReset(false)
        onToast('Local profile reset. Your readings and appliances were retained.')
      }
    } catch (error) {
      onToast(error.message || 'Could not reset this profile.', 'error')
    }
  }

  return (
    <>
      <PageTitle eyebrow="LOCAL INSTALLATION" title="Profile & settings" description="Update your household profile and estimate rate for this computer." action={<button type="button" className="button button-secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset setup</button>} />
      <div className="demo-banner"><ShieldCheck size={16} /><span><strong>Stored on this installation.</strong> There are no passwords or online account.</span></div>
      <form className="settings-layout" onSubmit={save} noValidate>
        <div className="settings-main">
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><UserRound size={18} /></span><div><h2>Profile & household</h2><p>These names are stored locally in SQLite.</p></div></div>
            <div className="field-grid settings-name-grid">
              <div className="settings-field"><label htmlFor="profile-name">Your name</label><input id="profile-name" maxLength={80} value={form.userName} onChange={event => setForm({ ...form, userName: event.target.value })} /></div>
              <div className="settings-field"><label htmlFor="household-name">Household name</label><input id="household-name" maxLength={100} value={form.householdName} onChange={event => setForm({ ...form, householdName: event.target.value })} /></div>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><Settings2 size={18} /></span><div><h2>Energy rate</h2><p>Used for estimated bills only. Your utility rate may vary.</p></div></div>
            <div className="settings-field rate-field"><label htmlFor="rate-per-kwh">Electricity price</label><div className="input-with-unit"><span>₱</span><input id="rate-per-kwh" type="number" min="0.01" max="1000" step="0.01" value={form.ratePerKwh} onChange={event => setForm({ ...form, ratePerKwh: event.target.value })} /><span>/ kWh</span></div><small>Check your electricity bill for your current rate per kilowatt-hour.</small></div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon"><SlidersHorizontal size={18} /></span><div><h2>Display preferences</h2><p>Stored with your local settings.</p></div></div>
            <div className="preference-row"><span className="preference-icon"><UserRound size={17} /></span><span><strong>Compact overview</strong><small>Show a denser summary layout</small></span><button type="button" role="switch" aria-checked={form.compact} className={`toggle ${form.compact ? 'toggle-on' : ''}`} onClick={() => setForm({ ...form, compact: !form.compact })}><i /></button></div>
            <div className="preference-row"><span className="preference-icon"><Bell size={17} /></span><span><strong>Weekly summary reminder</strong><small>Display preference only; no notifications are sent</small></span><button type="button" role="switch" aria-checked={form.weeklySummary} className={`toggle ${form.weeklySummary ? 'toggle-on' : ''}`} onClick={() => setForm({ ...form, weeklySummary: !form.weeklySummary })}><i /></button></div>
          </section>
          <div className="settings-save-row"><span><Check size={14} /> Settings persist in local SQLite</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Save size={16} /> Save changes</>}</button></div>
        </div>
        <aside className="settings-aside">
          <section className="panel account-card">
            <div className="settings-section-heading"><span className="avatar avatar-large">{initialsOf(profile.userName)}</span><div><h3>{form.userName || profile.userName}</h3><p>Local profile · no online account</p></div></div>
            <div className="account-separator" />
            <div className="account-detail"><span>Household</span><strong>{form.householdName || profile.householdName}</strong></div>
            <div className="account-detail"><span>Electricity rate</span><strong>₱{Number(form.ratePerKwh || 0).toFixed(2)} / kWh</strong></div>
            <span className="badge badge-success"><i /> THIS COMPUTER</span>
          </section>
          <section className="panel privacy-card-settings">
            <span className="privacy-large-icon"><ShieldCheck size={21} /></span><h3>Your local data</h3>
            <p>Profile, readings, appliances, and settings live in a SQLite file on this computer. Back up the data folder if you need a copy.</p>
            <button type="button" className="text-button" onClick={() => onToast('Your SQLite file is stored under the project data/ folder.')}>Where is my data? <CircleHelp size={15} /></button>
          </section>
        </aside>
      </form>
      {confirmReset && <ConfirmModal title="Reset local setup?" description="This removes only your saved profile and household name, then returns to onboarding. Meter readings and appliance records are retained." confirmLabel="Reset profile" onConfirm={resetProfile} onCancel={() => setConfirmReset(false)} />}
    </>
  )
}
