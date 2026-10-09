import { ClipboardList } from 'lucide-react'

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><ClipboardList size={22} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
