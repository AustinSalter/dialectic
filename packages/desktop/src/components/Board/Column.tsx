/**
 * Column Component
 *
 * Kanban column representing a session state.
 * Uses @dnd-kit for drop functionality.
 */

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Session, SessionState } from '../Kanban'
import { SessionCard } from './SessionCard'
import styles from './Column.module.css'

const stateLabels: Record<SessionState, { label: string; description: string }> = {
  backlog: { label: 'Spark', description: 'Initial ideas' },
  exploring: { label: 'Shape', description: 'Active exploration' },
  tensions: { label: 'Stress-Test', description: 'Finding contradictions' },
  synthesizing: { label: 'Sharpen', description: 'Forming thesis' },
  formed: { label: 'Ship', description: 'Complete' },
}

interface ColumnProps {
  state: SessionState
  sessions: Session[]
  onOpenSession?: (sessionId: string, state: SessionState) => void
  onDeleteSession?: (sessionId: string) => void
  onForkSession?: (sessionId: string) => void
}

export function Column({ state, sessions, onOpenSession, onDeleteSession, onForkSession }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: state })
  const { label } = stateLabels[state]

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.over : ''}`}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{label}</h3>
        <span className={styles.count}>{sessions.length}</span>
      </div>
      <SortableContext
        items={sessions.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={styles.cards}>
          {sessions.length === 0 ? (
            <div className={styles.empty}>
              {state === 'synthesizing' ? 'Drag here when tensions resolved' : 'No items'}
            </div>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onOpenSession?.(session.id, state)}
                onDelete={onDeleteSession}
                onFork={onForkSession}
              />
            ))
          )}
        </div>
      </SortableContext>
      {state === 'backlog' && (
        <button className={styles.addButton}>+ Add</button>
      )}
    </div>
  )
}
