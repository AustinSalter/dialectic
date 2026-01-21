/**
 * SessionCard Component
 *
 * Draggable card for Kanban board:
 * - Title (truncated)
 * - Category badge
 * - Tension count badge
 * - Delete button on hover
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Session, SessionCategory } from '../Kanban'
import styles from './SessionCard.module.css'

const categoryColors: Record<SessionCategory, string> = {
  'geopolitical': 'var(--category-geopolitical)',
  'market-structure': 'var(--category-market-structure)',
  'ai-infrastructure': 'var(--category-ai-infrastructure)',
  'energy-power': 'var(--category-energy-power)',
  'operational': 'var(--category-operational)',
}

const categoryLabels: Record<SessionCategory, string> = {
  'geopolitical': 'geo',
  'market-structure': 'market',
  'ai-infrastructure': 'tech',
  'energy-power': 'energy',
  'operational': 'ops',
}

interface SessionCardProps {
  session: Session
  onClick?: () => void
  onDelete?: (sessionId: string) => void
}

export function SessionCard({ session, onClick, onDelete }: SessionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Handle click that doesn't trigger during drag
  const handleClick = () => {
    if (!isDragging && onClick) {
      onClick()
    }
  }

  // Handle delete with stop propagation
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onDelete) {
      onDelete(session.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      {/* Delete button */}
      {onDelete && (
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          onPointerDown={(e) => e.stopPropagation()}
          title="Delete session"
        >
          ×
        </button>
      )}

      <h4 className={styles.title}>{session.title}</h4>
      {session.summary && (
        <p className={styles.summary}>{session.summary}</p>
      )}
      <div className={styles.meta}>
        <span
          className={styles.categoryBadge}
          style={{ backgroundColor: categoryColors[session.category] }}
        >
          {categoryLabels[session.category]}
        </span>
        {session.tensionCount > 0 && (
          <span className={styles.tensionBadge}>
            {session.tensionCount} {session.tensionCount === 1 ? 'tension' : 'tensions'}
          </span>
        )}
        {session.tensionCount === 0 && (
          <span className={styles.claims}>{session.claimCount} claims</span>
        )}
      </div>
    </div>
  )
}
