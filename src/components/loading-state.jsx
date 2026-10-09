export function LoadingState({ label = 'Connecting to the local database…' }) {
  return <div className="loading-state" role="status"><span className="loading-spinner" /><strong>{label}</strong><small>Your records stay on this computer.</small></div>
}
