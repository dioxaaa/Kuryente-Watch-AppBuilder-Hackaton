import { AlertTriangle, RotateCw } from 'lucide-react'

export function ErrorMessage({ title = 'Local server unavailable', message, onRetry }) {
  return (
    <section className="backend-error" role="alert">
      <span className="backend-error-icon"><AlertTriangle size={22} /></span>
      <p className="eyebrow">LOCAL CONNECTION</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <p className="backend-error-note">The cached app interface may open offline, but SQLite-backed features require this computer’s KuryenteWatch server to be running.</p>
      {onRetry && <button className="button button-primary" onClick={onRetry}><RotateCw size={15} /> Try again</button>}
    </section>
  )
}
