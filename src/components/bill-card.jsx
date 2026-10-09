import { useMemo, useState } from 'react'
import { Bell, Gauge, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { api } from '../api'
import { billFacts, buildAssistantContext } from '../utils/assistant-context'

const QUESTION = 'Why is my bill high?'
const factIcons = { meter: Gauge, appliance: Zap, alert: Bell }
// Answers are kept for this browser session, so coming back to the dashboard shows the last answer instantly
// instead of asking the local AI again. A change in the household data changes the key, so it asks again.
const answers = new Map()

// Home-screen answer to "Why is my bill high?". The plain facts always show (worked out from real meter readings,
// appliances and alerts). The local AI then puts them into friendly words when the person asks.
export function BillCard({ readings, appliances, alerts, rate, monthKwh }) {
  const [state, setState] = useState({ loading: false, error: '' })
  const facts = useMemo(() => billFacts({ readings, appliances, alerts, rate }), [readings, appliances, alerts, rate])
  const context = useMemo(() => buildAssistantContext({ readings, appliances, alerts, rate, monthKwh }), [readings, appliances, alerts, rate, monthKwh])
  const key = JSON.stringify(context)
  const answer = answers.get(key)

  async function ask() {
    setState({ loading: true, error: '' })
    try {
      const { reply, model } = await api.post('/assistant', { question: QUESTION, context })
      answers.set(key, { text: reply, model })
      setState({ loading: false, error: '' })
    } catch (err) { setState({ loading: false, error: err.message }) }
  }

  return (
    <section className="panel bill-card" aria-label={QUESTION}>
      <div className="bill-card-head">
        <span className="bill-card-icon"><Sparkles size={18} /></span>
        <div>
          <span className="eyebrow">ASK THE ENERGY ASSISTANT</span>
          <h2>{QUESTION}</h2>
          <p>Worked out from your meter readings, appliances and alerts.</p>
        </div>
      </div>
      <div className="bill-card-body">
        <ul className="bill-facts">
          {facts.map(fact => {
            const Icon = factIcons[fact.kind] || Zap
            return <li key={fact.id} className={fact.muted ? 'bill-fact-muted' : ''}><span className={`bill-fact-icon bill-fact-${fact.kind}`}><Icon size={14} /></span><span>{fact.text}</span></li>
          })}
        </ul>
        <div className="bill-answer">
          {state.loading ? (
            <div className="ai-box ai-box-loading" role="status" aria-live="polite"><Sparkles size={14} /><span>Asking the local AI…</span><span className="ai-dots"><i /><i /><i /></span></div>
          ) : answer ? (
            <div className="ai-box">
              <div className="ai-box-head"><Sparkles size={13} /><strong>In plain words</strong><small>{answer.model ? `${answer.model} · ` : ''}runs on this device</small></div>
              <p>{answer.text}</p>
              <button className="text-button ai-again" onClick={ask}><RefreshCw size={12} /> Explain again</button>
            </div>
          ) : (
            <div className="bill-ask">
              <p>Want this in simple words, with what to check first?</p>
              <button className="button button-primary button-small" onClick={ask}><Sparkles size={14} /> Explain my bill</button>
            </div>
          )}
          {state.error && <p className="ai-error" role="alert">{state.error}</p>}
        </div>
      </div>
    </section>
  )
}
