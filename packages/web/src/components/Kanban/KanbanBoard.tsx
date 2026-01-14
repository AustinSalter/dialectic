import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { Column } from './Column'
import { SessionCard } from './SessionCard'
import type { Session, SessionState } from './SessionCard'

const STATES: SessionState[] = ['backlog', 'exploring', 'tensions', 'synthesizing', 'formed']

interface KanbanBoardProps {
  sessions: Session[]
  onSessionMove: (sessionId: string, newState: SessionState) => void
  onSessionOpen?: (session: Session) => void
  onSessionDelete?: (sessionId: string) => void
}

export function KanbanBoard({ sessions, onSessionMove, onSessionOpen, onSessionDelete }: KanbanBoardProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const getSessionsByState = (state: SessionState) => {
    return sessions.filter(s => s.state === state)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const session = sessions.find(s => s.id === event.active.id)
    if (session) {
      setActiveSession(session)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveSession(null)

    if (over && active.id !== over.id) {
      // Check if dropped over a column
      const newState = STATES.find(s => s === over.id)
      if (newState) {
        onSessionMove(active.id as string, newState)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 'var(--space-3)',
          height: '100%',
        }}
      >
        {STATES.map((state) => (
          <Column
            key={state}
            state={state}
            sessions={getSessionsByState(state)}
            onSessionDoubleClick={onSessionOpen}
            onSessionDelete={onSessionDelete}
          />
        ))}
      </div>

      <DragOverlay>
        {activeSession ? (
          <div style={{ transform: 'scale(1.05)' }}>
            <SessionCard session={activeSession} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
