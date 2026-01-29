/**
 * FloatingWindow Component
 *
 * Draggable and resizable window with macOS-style traffic light controls.
 * Supports fullscreen mode and custom content.
 */

import { useCallback, useEffect } from 'react'
import { useDraggable } from '../../hooks/useDraggable'
import styles from './FloatingWindow.module.css'

interface WindowStatus {
  type: 'tensions' | 'active' | 'notes' | 'terminal'
  count?: number
}

interface FloatingWindowProps {
  id: string
  title: string
  status?: WindowStatus
  initialPosition?: { x: number; y: number }
  initialSize?: { width: number; height: number }
  isFullscreen?: boolean
  isNotesWindow?: boolean
  onClose: () => void
  onMinimize?: () => void
  onMaximize?: () => void
  onFocus?: () => void
  zIndex?: number
  children: React.ReactNode
}

export function FloatingWindow({
  id,
  title,
  status,
  initialPosition = { x: 100, y: 80 },
  initialSize = { width: 700, height: 600 },
  isFullscreen = false,
  isNotesWindow = false,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  zIndex = 10,
  children,
}: FloatingWindowProps) {
  const {
    position,
    size,
    isDragging,
    isResizing,
    handleMouseDown,
    handleResizeMouseDown,
  } = useDraggable({
    initialPosition,
    initialSize,
    minSize: isNotesWindow ? { width: 280, height: 200 } : { width: 400, height: 300 },
    disabled: isFullscreen,
  })

  const handleWindowClick = useCallback(() => {
    onFocus?.()
  }, [onFocus])

  // Double-click titlebar to toggle fullscreen
  const handleTitlebarDoubleClick = useCallback(() => {
    onMaximize?.()
  }, [onMaximize])

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onMaximize?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, onMaximize])

  const getStatusText = () => {
    if (!status) return null
    if (status.type === 'tensions') {
      return `${status.count ?? 0} tension${status.count !== 1 ? 's' : ''}`
    }
    if (status.type === 'active') {
      return 'exploring'
    }
    if (status.type === 'notes') {
      return `${status.count ?? 0} note${status.count !== 1 ? 's' : ''}`
    }
    if (status.type === 'terminal') {
      return 'terminal'
    }
    return null
  }

  const windowClasses = [
    styles.floatingWindow,
    isFullscreen && styles.fullscreen,
    isNotesWindow && styles.notesWindow,
    (isDragging || isResizing) && styles.dragging,
  ]
    .filter(Boolean)
    .join(' ')

  const windowStyle = isFullscreen
    ? { zIndex }
    : {
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
        zIndex,
      }

  return (
    <div
      className={windowClasses}
      style={windowStyle}
      onClick={handleWindowClick}
      data-window-id={id}
    >
      {/* Titlebar */}
      <div
        className={styles.titlebar}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleTitlebarDoubleClick}
        style={{ cursor: isFullscreen ? 'default' : isDragging ? 'grabbing' : 'grab' }}
      >
        <div className={styles.controls}>
          <button
            className={`${styles.control} ${styles.close}`}
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="Close"
          />
          <button
            className={`${styles.control} ${styles.minimize}`}
            onClick={(e) => {
              e.stopPropagation()
              onMinimize?.()
            }}
            aria-label="Minimize"
          />
          <button
            className={`${styles.control} ${styles.maximize} ${isFullscreen ? styles.inactive : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onMaximize?.()
            }}
            aria-label="Maximize"
          />
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.meta}>
          {status && (
            <span
              className={`${styles.status} ${
                status.type === 'tensions'
                  ? styles.statusTensions
                  : status.type === 'active'
                    ? styles.statusActive
                    : status.type === 'terminal'
                      ? styles.statusTerminal
                      : ''
              }`}
            >
              {getStatusText()}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {children}

      {/* Resize Handles (hidden in fullscreen) */}
      {!isFullscreen && (
        <>
          {/* Edge handles */}
          <div className={`${styles.resizeHandle} ${styles.resizeN}`} onMouseDown={handleResizeMouseDown('n')} />
          <div className={`${styles.resizeHandle} ${styles.resizeS}`} onMouseDown={handleResizeMouseDown('s')} />
          <div className={`${styles.resizeHandle} ${styles.resizeE}`} onMouseDown={handleResizeMouseDown('e')} />
          <div className={`${styles.resizeHandle} ${styles.resizeW}`} onMouseDown={handleResizeMouseDown('w')} />
          {/* Corner handles */}
          <div className={`${styles.resizeHandle} ${styles.resizeNE}`} onMouseDown={handleResizeMouseDown('ne')} />
          <div className={`${styles.resizeHandle} ${styles.resizeNW}`} onMouseDown={handleResizeMouseDown('nw')} />
          <div className={`${styles.resizeHandle} ${styles.resizeSE}`} onMouseDown={handleResizeMouseDown('se')} />
          <div className={`${styles.resizeHandle} ${styles.resizeSW}`} onMouseDown={handleResizeMouseDown('sw')} />
        </>
      )}
    </div>
  )
}
