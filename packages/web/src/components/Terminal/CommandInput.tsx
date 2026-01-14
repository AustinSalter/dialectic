import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'

interface CommandInputProps {
  onSubmit: (command: string) => void
  history: string[]
  disabled?: boolean
}

export function CommandInput({ onSubmit, history, disabled = false }: CommandInputProps) {
  const [value, setValue] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
      setValue('')
      setHistoryIndex(-1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIndex)
        setValue(history[history.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setValue(history[history.length - 1 - newIndex] || '')
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setValue('')
      }
    } else if (e.key === 'Escape') {
      setValue('')
      setHistoryIndex(-1)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        backgroundColor: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span
        style={{
          color: 'var(--accent-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-mono)',
          userSelect: 'none',
        }}
      >
        &gt;
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setHistoryIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a command... (try 'help')"
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-mono)',
          outline: 'none',
          caretColor: 'var(--accent-primary)',
        }}
      />
      {value && (
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--text-caption)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Enter to run
        </span>
      )}
    </div>
  )
}
