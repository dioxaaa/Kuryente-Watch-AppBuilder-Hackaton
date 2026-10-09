import { useEffect, useRef, useState } from 'react'
import { Bot, CircleAlert, LoaderCircle, MessageCircle, RefreshCw, Send, Sparkles, UserRound } from 'lucide-react'
import { api } from '../api'
import { BUILT_IN_MODEL } from '../local-api'
import { PageTitle } from '../components/page-title'

const modelLabel = name => (name === BUILT_IN_MODEL ? 'On-device assistant' : name)

const suggestions = [
  'How much energy did my household use?',
  'Which appliance has the largest daily estimate?',
  'Explain the difference between my meter readings.',
]

export function AssistantPage() {
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [available, setAvailable] = useState(false)
  const [onDevice, setOnDevice] = useState(false)
  const [checking, setChecking] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  async function refreshModels(signal) {
    setChecking(true)
    try {
      const status = await api('/assistant/status', { signal })
      setModels(status.models)
      setAvailable(status.available)
      setOnDevice(Boolean(status.local) || status.models.includes(BUILT_IN_MODEL))
      setStatusError(status.error)
      setModel(current => status.models.includes(current) ? current : (status.models[0] ?? ''))
    } catch (requestError) {
      setAvailable(false)
      setOnDevice(false)
      setModels([])
      setStatusError(requestError.message || 'Could not check local Ollama status.')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    refreshModels(controller.signal)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, busy])

  async function sendMessage(text = draft, { retry = false } = {}) {
    const content = text.trim()
    if (!content || busy || !available || !model) return
    const previousMessages = (retry ? messages.slice(0, -1) : messages).slice(-8)
    if (!retry) setMessages(current => [...current, { role: 'user', content }])
    setDraft('')
    setBusy(true)
    setError('')
    try {
      const result = await api('/assistant/chat', {
        method: 'POST',
        body: { message: content, model, history: previousMessages },
      })
      setMessages(current => [...current, { role: 'assistant', content: result.reply }])
    } catch (requestError) {
      setError(requestError.message || 'The assistant could not answer. Please try again.')
      if (requestError.status === 503) refreshModels()
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function startNewChat() {
    if (busy) return
    setMessages([])
    setError('')
    setDraft('')
    inputRef.current?.focus()
  }

  return (
    <>
      <PageTitle
        eyebrow="LOCAL MODEL · YOUR DATA STAYS HERE"
        title="Energy Assistant"
        description="Ask about your meter readings, appliance estimates, and household energy."
        action={<button className="button button-secondary" type="button" onClick={startNewChat} disabled={busy}>New chat</button>}
      />
      <div className="assistant-layout">
        <section className="panel assistant-panel" aria-label="Energy Assistant conversation">
          <div className="assistant-topline">
            <div className="assistant-model-state">
              <span className={`assistant-state-dot ${available ? 'assistant-state-ready' : ''}`} />
              <span>{checking ? 'Checking assistant…' : onDevice ? 'On-device assistant ready' : available ? 'Ollama connected' : 'Ollama unavailable'}</span>
              {available && <span className="badge badge-success">{onDevice ? 'ON DEVICE' : 'LOCAL'}</span>}
            </div>
            <label className="assistant-model-picker">
              <span>Model</span>
              <select aria-label="Assistant model" value={model} onChange={event => setModel(event.target.value)} disabled={!available || busy}>
                {models.length === 0 && <option value="">No models found</option>}
                {models.map(name => <option key={name} value={name}>{modelLabel(name)}</option>)}
              </select>
            </label>
          </div>

          <div className="assistant-messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <span className="assistant-welcome-icon"><Sparkles size={22} /></span>
                <h2>Your local energy companion</h2>
                <p>Ask a question and I’ll use the meter readings, appliances, and alerts saved in this installation.</p>
                <div className="assistant-suggestions" aria-label="Suggested questions">
                  {suggestions.map(question => (
                    <button key={question} type="button" onClick={() => sendMessage(question)} disabled={!available || busy}>{question}</button>
                  ))}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <article className={`assistant-message assistant-message-${message.role}`} key={`${index}-${message.role}`}>
                <span className="assistant-message-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={16} />}
                </span>
                <div className="assistant-message-copy">
                  <strong>{message.role === 'assistant' ? 'Energy Assistant' : 'You'}</strong>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {busy && (
              <div className="assistant-thinking" role="status">
                <LoaderCircle size={16} className="assistant-spinner" />
                <span>{onDevice ? 'Thinking…' : 'Thinking with your local model…'}</span>
              </div>
            )}
            {error && (
              <div className="assistant-error" role="alert">
                <CircleAlert size={17} />
                <span>{error}</span>
                <button type="button" onClick={() => sendMessage(messages[messages.length - 1]?.content ?? '', { retry: true })} disabled={busy || !available}>Try again</button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="assistant-composer" onSubmit={event => { event.preventDefault(); sendMessage() }}>
            <label className="visually-hidden" htmlFor="assistant-prompt">Ask the Energy Assistant</label>
            <textarea
              id="assistant-prompt"
              ref={inputRef}
              rows="2"
              maxLength="2000"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={available ? 'Ask about your household energy…' : 'Start Ollama to ask a question'}
              disabled={!available || busy}
            />
            <div className="assistant-composer-footer">
              <span>Enter to send · Shift+Enter for a new line · 2,000 character limit</span>
              <button className="button button-primary" type="submit" disabled={!available || busy || !draft.trim()} aria-label="Send message">
                {busy ? <LoaderCircle size={16} className="assistant-spinner" /> : <Send size={15} />}
                Send
              </button>
            </div>
          </form>
        </section>

        <aside className="assistant-side">
          <section className="panel assistant-info-card">
            <span className="assistant-side-icon"><MessageCircle size={18} /></span>
            <h2>Private, local answers</h2>
            <p>{onDevice ? 'Ollama is not reachable, so a built-in responder on this device answers from your saved readings and appliances. Nothing leaves this device.' : 'Your prompt and household context go to Ollama on this computer only. No cloud AI or external API is used.'}</p>
            <div className="assistant-model-detail">
              <span>ACTIVE MODEL</span>
              <strong>{available ? modelLabel(model) : 'Not connected'}</strong>
            </div>
          </section>
          <section className={`assistant-connect-card ${available ? 'assistant-connect-ready' : ''}`} aria-live="polite">
            <div className="assistant-connect-heading">
              {available ? <Sparkles size={17} /> : <CircleAlert size={17} />}
              <strong>{available ? 'Ready to help' : 'Ollama needs to be running'}</strong>
            </div>
            <p>{onDevice ? 'Answers come from a built-in responder that works offline. Start Ollama for longer, free-form answers.' : available ? 'Answers are generated locally and use the latest saved data available to this app.' : statusError || 'The local Ollama model service could not be reached.'}</p>
            {!available && <p className="assistant-setup-hint">Start Ollama, install a model if needed, then refresh the model list.</p>}
            <button className="button button-secondary button-small" type="button" onClick={() => refreshModels()} disabled={busy || checking}>
              <RefreshCw size={14} /> Refresh models
            </button>
          </section>
          <p className="assistant-disclaimer">Advice is informational. Appliance usage is estimated from rating labels; unusual readings alone do not diagnose a fault.</p>
        </aside>
      </div>
    </>
  )
}
