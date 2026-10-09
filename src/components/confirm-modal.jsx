import { AlertTriangle, X } from 'lucide-react'

export function ConfirmModal({ title, description, confirmLabel = 'Confirm', onConfirm, onCancel, danger = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal-close" onClick={onCancel} aria-label="Close dialog"><X size={18} /></button>
        <span className={`modal-icon ${danger ? 'modal-icon-danger' : ''}`}><AlertTriangle size={21} /></span>
        <h2 id="modal-title">{title}</h2>
        <p>{description}</p>
        <div className="modal-actions"><button className="button button-secondary" onClick={onCancel}>Cancel</button><button className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={onConfirm}>{confirmLabel}</button></div>
      </section>
    </div>
  )
}
