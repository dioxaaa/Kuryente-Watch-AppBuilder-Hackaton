import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { buildAssistantContext } from '../utils/assistant-context'
import { fetchAiRecommendation } from '../utils/api'

const quickQuestions = ['Why is my bill high?', 'Which appliance uses the most?', 'How can I save electricity?']
const greeting = "Hi! I'm your energy assistant. Ask me about your electricity usage and I'll explain it in simple words."

export function AssistantWidget(props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, loading, open])

  async function send(text) {
    const question = text.trim()
    if (!question || loading) return

    setMessages(items => [...items, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      // Check if user is asking about a specific saved appliance
      const matchedAppliance = props.appliances?.find(a => 
        question.toLowerCase().includes(a.name.toLowerCase())
      )

      let reply = ''

      if (matchedAppliance) {
        // Option A: Call the dedicated local Ollama AI endpoint via fetchAiRecommendation
        const resData = await fetchAiRecommendation(
          matchedAppliance.name,
          matchedAppliance.watts,
          matchedAppliance.hours
        )
        reply = resData.insight || resData.recommendation
        if (!reply) throw new Error(resData.error || 'Something went wrong. Please try again.')
      } else {
        // Everything else ("Why is my bill high?", saving tips, ...) is answered from the real meter readings, appliances and alerts
        const history = messages.filter(m => !m.error).map(({ role, content }) => ({ role, content }))
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history, context: buildAssistantContext(props) }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
        reply = data.reply
      }

      setMessages(items => [...items, { role: 'assistant', content: reply }])
    } catch (err) {
      const offline = err instanceof TypeError
      setMessages(items => [
        ...items,
        {
          role: 'assistant',
          error: true,
          content: offline
            ? 'Cannot reach the KuryenteWatch server. Make sure it is running (npm run server).'
            : err.message,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="assistant">
      {open && (
        <section className="assistant-window" role="dialog" aria-label="Energy assistant">
          <header className="assistant-head">
            <span className="assistant-avatar"><Sparkles size={17} /></span>
            <span className="assistant-head-copy">
              <strong>Energy assistant</strong>
              <small>Local AI · runs on your device</small>
            </span>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={18} />
            </button>
          </header>

          <div className="assistant-body" ref={bodyRef} aria-live="polite">
            <div className="assistant-msg assistant-msg-bot">{greeting}</div>
            {messages.length === 0 && (
              <div className="assistant-chips">
                {quickQuestions.map(q => (
                  <button key={q} onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`assistant-msg ${m.role === 'user' ? 'assistant-msg-user' : 'assistant-msg-bot'} ${m.error ? 'assistant-msg-error' : ''}`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="assistant-msg assistant-msg-bot assistant-typing">
                <i /><i /><i />
              </div>
            )}
          </div>

          <form className="assistant-form" onSubmit={e => { e.preventDefault(); send(input) }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your electricity..."
              maxLength={500}
              aria-label="Your question"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send">
              <Send size={16} />
            </button>
          </form>
          <p className="assistant-note">
            Uses your saved readings and appliances. Answers are estimates and may be wrong.
          </p>
        </section>
      )}

      <button
        className="assistant-fab"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close energy assistant' : 'Open energy assistant'}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}