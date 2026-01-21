/**
 * RightRail Component
 *
 * Floating glass panel for session list.
 * Launches floating on vista, snaps to edge when dragged there.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Session } from '../Kanban'
import styles from './Rails.module.css'

interface RightRailProps {
  isOpen: boolean
  onToggle: () => void
  sessions: Session[]
  onSessionClick?: (sessionId: string) => void
  activeSessionId?: string | null
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

function getSessionStatus(session: Session): { text: string; hasTensions: boolean } {
  if (session.tensionCount > 0) {
    return { text: `${session.tensionCount} tension${session.tensionCount > 1 ? 's' : ''}`, hasTensions: true }
  }
  if (session.state === 'exploring') {
    return { text: 'exploring', hasTensions: false }
  }
  return { text: session.state, hasTensions: false }
}

const SNAP_THRESHOLD = 60 // pixels from edge to snap

export function RightRail({ isOpen, onToggle, sessions, onSessionClick, activeSessionId }: RightRailProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isSnapped, setIsSnapped] = useState(false)
  const [isNearEdge, setIsNearEdge] = useState(false)
  const [position, setPosition] = useState({ x: 80, y: 120 }) // x is distance from right edge
  const dragStart = useRef({ x: 0, y: 0 })
  const dragOffset = useRef({ x: 0, y: 0 })
  const railRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  // Reset to floating state when rail opens
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setIsSnapped(false)
      setPosition({ x: 80, y: 120 })
    }
    wasOpen.current = isOpen
  }, [isOpen])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return

    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }

    if (!isSnapped) {
      // Calculate offset from the right edge position
      const rightEdgeX = window.innerWidth - position.x - 260 // 260 is rail width
      dragOffset.current = {
        x: e.clientX - rightEdgeX,
        y: e.clientY - position.y
      }
    } else {
      // When snapped, start from current position
      dragOffset.current = { x: e.clientX - (window.innerWidth - 260), y: e.clientY - 60 }
    }
  }, [isSnapped, position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth
      const newY = e.clientY - dragOffset.current.y

      // Floating mode - calculate position (x is distance from right edge)
      const leftX = e.clientX - dragOffset.current.x
      const rightX = Math.max(0, windowWidth - leftX - 260)

      // Check if window's right edge is near the screen's right edge
      const nearRightEdge = rightX < SNAP_THRESHOLD
      setIsNearEdge(nearRightEdge)

      if (!isSnapped) {
        // Floating mode - update position
        setPosition({ x: rightX, y: Math.max(60, newY) })

        // Snap if window edge is near screen edge
        if (nearRightEdge) {
          setIsSnapped(true)
          setIsNearEdge(false)
        }
      } else {
        // Snapped mode - dragging away from drawer closes the rail
        if (e.clientX < windowWidth - SNAP_THRESHOLD - 150) {
          setIsDragging(false)
          setIsSnapped(false)
          onToggle() // Close the rail
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsNearEdge(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isSnapped, onToggle])

  // Sort sessions by most recent first
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const railClasses = [
    styles.rail,
    styles.rightRail,
    isOpen && styles.open,
    isSnapped && styles.snapped,
    isDragging && styles.dragging,
    isNearEdge && styles.nearEdge,
  ].filter(Boolean).join(' ')

  // Dynamic positioning for floating state
  const railStyle: React.CSSProperties = !isSnapped ? {
    top: position.y,
    right: position.x,
  } : {}

  // Drawer zone classes - shows docking target when dragging
  const drawerZoneClasses = [
    styles.drawerZone,
    styles.right,
    isDragging && styles.visible,
    isNearEdge && styles.active,
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* Drawer dock zone indicator */}
      <div className={drawerZoneClasses} />

      <div
        ref={railRef}
        className={railClasses}
        style={railStyle}
      >
        {/* Header - drag handle */}
      <div className={styles.railHeader} onMouseDown={handleMouseDown}>
        {/* Spark/lightbulb icon for Sessions */}
        <svg viewBox="0 0 16 16" fill="currentColor" className={styles.railIcon}>
          <path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 11a3 3 0 100-6 3 3 0 000 6zm0 1a4 4 0 01-2.5-.9v1.4a.5.5 0 00.5.5h4a.5.5 0 00.5-.5v-1.4A4 4 0 018 13zm-6.5-5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zm12 0a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zM3.05 3.05a.5.5 0 01.707 0l.707.707a.5.5 0 11-.707.707l-.707-.707a.5.5 0 010-.707zm9.193.707a.5.5 0 00-.707-.707l-.707.707a.5.5 0 00.707.707l.707-.707z"/>
        </svg>
        <span className={styles.railTitle}>Sessions</span>
        <button className={styles.railCloseBtn} onClick={onToggle}>
          ×
        </button>
      </div>

      {/* Session list */}
      <div className={styles.railContent}>
        {sortedSessions.length === 0 ? (
          <div className={styles.emptyState}>
            No sessions yet
          </div>
        ) : (
          <div className={styles.sessionList}>
            {sortedSessions.map((session) => {
              const status = getSessionStatus(session)
              const isActive = session.id === activeSessionId

              return (
                <div
                  key={session.id}
                  className={`${styles.sessionItem} ${isActive ? styles.active : ''}`}
                  onClick={() => onSessionClick?.(session.id)}
                >
                  <span className={styles.sessionTitle}>{session.title}</span>
                  <div className={styles.sessionMeta}>
                    <span className={`${styles.sessionStatus} ${status.hasTensions ? styles.tensions : ''}`}>
                      {status.text}
                    </span>
                    <span className={styles.sessionDivider}>·</span>
                    <span className={styles.sessionTime}>{formatTimeAgo(session.updatedAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
