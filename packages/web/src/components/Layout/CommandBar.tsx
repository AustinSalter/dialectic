import React, { useState, useRef, useEffect } from 'react'

interface CommandBarProps {
  onCommand: (command: string) => void
  sessionCount: number
  isProcessing?: boolean
}

/**
 * CommandBar - "The Radio"
 *
 * Fixed at bottom, always visible. 52px height.
 * This is the command input for the terminal-style interface.
 *
 * Styling follows the dialectic-visual-design-spec-v2.md:
 * - Background: var(--color-canvas)
 * - Border-top: 1px solid var(--color-terracotta)
 * - Slight top shadow for lift
 */
export function CommandBar({ onCommand, sessionCount, isProcessing = false }: CommandBarProps) {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount and when pressing "/" anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus on "/" key if not already focused on an input
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !isProcessing) {
      onCommand(trimmed)
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleActionClick = (action: string) => {
    if (!isProcessing) {
      onCommand(action)
    }
  }

  const actions = ['ingest', 'continue', 'analyze', 'resolve']

  return (
    <div
      className="command-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '52px',
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-strong)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 100,
      }}
    >
      {/* Prompt character */}
      <span
        className="command-prompt"
        style={{
          color: 'var(--accent-primary)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        &gt;
      </span>

      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={isProcessing}
        placeholder={isFocused ? '' : 'Type a command or question...'}
        className="command-input"
        style={{
          flex: 1,
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          color: 'var(--text-primary)',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          opacity: isProcessing ? 0.6 : 1,
        }}
      />

      {/* Action hints */}
      <div
        className="command-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
        }}
      >
        {actions.map((action, index) => (
          <React.Fragment key={action}>
            {index > 0 && (
              <span
                className="command-separator"
                style={{ color: 'var(--border-default)' }}
              >
                |
              </span>
            )}
            <span
              className="command-action"
              onClick={() => handleActionClick(action)}
              style={{
                color: 'var(--text-tertiary)',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 100ms ease',
                opacity: isProcessing ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.background = 'var(--bg-subtle)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-tertiary)'
              }}
            >
              {action}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Session count */}
      <div
        style={{
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          marginLeft: '8px',
          whiteSpace: 'nowrap',
        }}
      >
        {sessionCount} session{sessionCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

export default CommandBar
