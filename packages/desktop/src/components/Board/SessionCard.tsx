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
  onFork?: (sessionId: string) => void
}

export function SessionCard({ session, onClick, onDelete, onFork }: SessionCardProps) {
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

  // Handle fork with stop propagation
  const handleFork = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onFork) {
      onFork(session.id)
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
      {/* Fork button */}
      {onFork && (
        <button
          className={styles.forkButton}
          onClick={handleFork}
          onPointerDown={(e) => e.stopPropagation()}
          title="Fork session"
        >
          &#x2442;
        </button>
      )}
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

      <h4 className={styles.title}>
        {session.parentSessionId && <span className={styles.forkIndicator} title="Forked session">&#x2442; </span>}
        {session.title}
      </h4>
      {session.thesisPreview && (
        <p className={styles.thesisPreview}>{session.thesisPreview}</p>
      )}
      {!session.thesisPreview && session.summary && (
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
      {(session.passCount > 0 || session.confidenceScore != null || session.contextFileCount > 0) && (
        <div className={styles.details}>
          {session.passCount > 0 && (
            <span className={styles.detailItem}>{session.passCount} {session.passCount === 1 ? 'pass' : 'passes'}</span>
          )}
          {session.confidenceScore != null && (
            <span className={styles.detailItem}>{Math.round(session.confidenceScore * 100)}% conf</span>
          )}
          {session.contextFileCount > 0 && (
            <span className={styles.detailItem}>{session.contextFileCount} {session.contextFileCount === 1 ? 'file' : 'files'}</span>
          )}
        </div>
      )}
    </div>
  )
}
