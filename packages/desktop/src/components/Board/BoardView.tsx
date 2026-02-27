/**
 * BoardView Component
 *
 * 5-column Kanban board with drag-and-drop.
 * Floating glass columns with dynamic height based on content.
 */

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useState } from 'react'
import type { Session, SessionState } from '../Kanban'
import { Column } from './Column'
import { SessionCard } from './SessionCard'
import styles from './BoardView.module.css'

const STATES: SessionState[] = ['backlog', 'exploring', 'tensions', 'synthesizing', 'formed']

interface BoardViewProps {
  sessions: Session[]
  onMoveSession: (sessionId: string, newState: SessionState) => void
  onOpenSession?: (sessionId: string, state: SessionState) => void
  onDeleteSession?: (sessionId: string) => void
  onForkSession?: (sessionId: string) => void
}

export function BoardView({ sessions, onMoveSession, onOpenSession, onDeleteSession, onForkSession }: BoardViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const sessionId = active.id as string
      const newState = over.id as SessionState

      // Check if dropped on a valid column
      if (STATES.includes(newState)) {
        onMoveSession(sessionId, newState)
      }
    }
  }

  const getSessionsByState = (state: SessionState) =>
    sessions.filter((s) => s.state === state)

  const activeSession = activeId
    ? sessions.find((s) => s.id === activeId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.board}>
        {STATES.map((state) => (
          <Column
            key={state}
            state={state}
            sessions={getSessionsByState(state)}
            onOpenSession={onOpenSession}
            onDeleteSession={onDeleteSession}
            onForkSession={onForkSession}
          />
        ))}
      </div>
      <DragOverlay>
        {activeSession && <SessionCard session={activeSession} />}
      </DragOverlay>
    </DndContext>
  )
}
