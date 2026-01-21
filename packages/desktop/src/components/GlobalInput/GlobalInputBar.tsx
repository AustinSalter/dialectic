/**
 * GlobalInputBar Component
 *
 * Persistent input bar at the bottom of the screen.
 * - Visible across all views (terminal, board)
 * - Accepts natural language + commands (prefix with /)
 * - Targets active session window when available
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './GlobalInputBar.module.css'

interface GlobalInputBarProps {
  activeSessionId: string | null
  activeSessionTitle?: string
  onMessage: (sessionId: string, message: string) => void
  onCommand: (command: string) => void
  disabled?: boolean
}

export function GlobalInputBar({
  activeSessionId,
  activeSessionTitle,
  onMessage,
  onCommand,
  disabled = false,
}: GlobalInputBarProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [value])

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return

    const trimmed = value.trim()

    // Check if it's a command (starts with /)
    if (trimmed.startsWith('/')) {
      onCommand(trimmed.slice(1))
    } else if (activeSessionId) {
      // Send to active session
      onMessage(activeSessionId, trimmed)
    } else {
      // No active session - treat as command to show help
      onCommand('help')
    }

    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, activeSessionId, onMessage, onCommand])

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
    : 'Type /help for commands, or start a new session...'

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
            disabled={disabled}
            rows={1}
          />
          <button
            className={styles.sendButton}
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
            </svg>
          </button>
        </div>

{/* Hints removed - using KeyboardHints component below */}
      </div>
    </div>
  )
}
