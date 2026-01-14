import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SessionCard } from './SessionCard'
import type { Session, SessionState } from './SessionCard'

interface ColumnProps {
  state: SessionState
  sessions: Session[]
  onSessionDoubleClick?: (session: Session) => void
  onSessionDelete?: (sessionId: string) => void
}

export const stateLabels: Record<SessionState, string> = {
  backlog: 'Spark',
  exploring: 'Shape',
  tensions: 'Stress-Test',
  synthesizing: 'Sharpen',
  formed: 'Ship',
}

export function Column({ state, sessions, onSessionDoubleClick, onSessionDelete }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: state,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        backgroundColor: isOver ? 'var(--bg-card)' : 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 200,
        border: isOver ? '2px dashed var(--accent-primary)' : '2px solid transparent',
        transition: 'background-color var(--transition-default), border-color var(--transition-default)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--text-caption)',
            fontFamily: 'var(--font-headers)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wide)',
            fontWeight: 'var(--weight-semibold)',
          }}
        >
          {stateLabels[state]}
        </h3>
        <span
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--bg-subtle)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {sessions.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <SortableContext
          items={sessions.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onDoubleClick={() => onSessionDoubleClick?.(session)}
                onDelete={onSessionDelete ? () => onSessionDelete(session.id) : undefined}
              />
            ))
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-caption)',
                fontFamily: 'var(--font-mono)',
                opacity: 0.5,
              }}
            >
              Drop here
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
