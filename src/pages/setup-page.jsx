import { useState } from 'react'
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react'

export function SetupPage({ onCreateProfile }) {
  const [userName, setUserName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const name = userName.trim()
    const home = householdName.trim()
    if (!name || !home) {
      setError('Please enter both your name and household name.')
      return
    }
    if (name.length > 80 || home.length > 100) {
      setError('Your name can be up to 80 characters and your household name up to 100.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onCreateProfile({ userName: name, householdName: home })
    } catch (failure) {
      setError(failure.message || 'Could not save your profile. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <div className="setup-brand">
          <span className="brand-mark"><Zap size={22} fill="currentColor" /></span>
          <span className="brand-copy"><strong>Kuryente<span>Watch</span></strong><small>THE LOCAL ENERGY DETECTIVE</small></span>
        </div>
        <div className="setup-art"><div className="setup-orbit orbit-one" /><div className="setup-orbit orbit-two" /><span><Zap size={30} fill="currentColor" /></span><i className="orbit-dot dot-a" /><i className="orbit-dot dot-b" /><i className="orbit-dot dot-c" /></div>
        <p className="eyebrow">A LITTLE SETUP, THEN YOU’RE IN</p>
        <h1>Let’s get to know<br />your household.</h1>
        <p className="setup-description">Your energy story starts at home. Tell us what to call you and your household.</p>
        <form onSubmit={submit} noValidate>
          <div className="field-group"><label htmlFor="setup-user-name">What should we call you?</label><input autoComplete="name" id="setup-user-name" maxLength={80} value={userName} onChange={event => { setUserName(event.target.value); setError('') }} placeholder="Your name" /></div>
          <div className="field-group"><label htmlFor="setup-household-name">What is your household name?</label><input id="setup-household-name" maxLength={100} value={householdName} onChange={event => { setHouseholdName(event.target.value); setError('') }} placeholder="e.g. Casa de Santos" /></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary setup-submit" type="submit" disabled={submitting}>{submitting ? 'Setting up your home…' : <>Get started <ArrowRight size={16} /></>}</button>
        </form>
        <div className="setup-privacy"><ShieldCheck size={17} /><span><strong>Private by nature</strong><small>This profile is stored on this computer only. It isn’t an online account.</small></span></div>
      </section>
      <footer className="setup-footer">KuryenteWatch · AppBuildersPH Hackathon 2026 <span>Local installation</span></footer>
    </main>
  )
}
