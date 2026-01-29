/**
 * GlobalInputBar Component
 *
 * Persistent input bar at the bottom of the screen.
 * - Visible across all views (terminal, board)
 * - Targets active session window when available
 * - Opens folder picker when no session is active
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { pickFolder } from '../../lib/folderPicker'
import styles from './GlobalInputBar.module.css'

interface GlobalInputBarProps {
  activeSessionId: string | null
  activeSessionTitle?: string
  onMessage: (sessionId: string, message: string) => void
  onNewSessionWithFolder?: (path: string, name: string) => void
  disabled?: boolean
}

export function GlobalInputBar({
  activeSessionId,
  activeSessionTitle,
  onMessage,
  onNewSessionWithFolder,
  disabled = false,
}: GlobalInputBarProps) {
  const [value, setValue] = useState('')
  const [isPickingFolder, setIsPickingFolder] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [value])

  // Handle folder picker for new terminal sessions
  const handlePickFolder = useCallback(async () => {
    if (isPickingFolder || !onNewSessionWithFolder) return
    setIsPickingFolder(true)
    try {
      const folder = await pickFolder()
      if (folder) {
        onNewSessionWithFolder(folder.path, folder.name)
      }
    } finally {
      setIsPickingFolder(false)
    }
  }, [isPickingFolder, onNewSessionWithFolder])

  const handleSubmit = useCallback(async () => {
    if (disabled) return

    const trimmed = value.trim()

    if (activeSessionId) {
      // Send to active session
      if (!trimmed) return
      onMessage(activeSessionId, trimmed)
      setValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } else if (onNewSessionWithFolder) {
      // No active session - open folder picker for new terminal
      await handlePickFolder()
    }
  }, [value, disabled, activeSessionId, onMessage, onNewSessionWithFolder, handlePickFolder])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  // Determine placeholder based on context
  const placeholder = activeSessionId
    ? `Message ${activeSessionTitle || 'session'}...`
    : 'Press ⌥⌘N to open a project folder...'

  // When no active session and folder picker is available, show folder icon
  const showFolderAction = !activeSessionId && onNewSessionWithFolder

  return (
    <div className={styles.globalInputBar}>
      <div className={styles.inputContainer}>
        {/* Target indicator */}
        {activeSessionId && (
          <div className={styles.targetIndicator}>
            <span className={styles.targetDot} />
            <span className={styles.targetLabel}>{activeSessionTitle || 'Active Session'}</span>
          </div>
        )}

        <div className={styles.inputBox}>
          {/* Mode indicator (green dot) */}
          <span className={styles.modeIndicator} />
          <textarea
            ref={textareaRef}
            className={styles.inputField}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || !!showFolderAction}
            rows={1}
          />
          <button
            className={styles.sendButton}
            onClick={handleSubmit}
            disabled={disabled || (activeSessionId && !value.trim()) || isPickingFolder}
            aria-label={showFolderAction ? 'Open folder' : 'Send'}
          >
            {showFolderAction ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
