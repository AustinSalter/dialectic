/**
 * CommandInput Component
 *
 * Bottom input bar with:
 * - ">" prompt in accent color
 * - Arrow key history navigation
 * - Escape to clear
 */

import { useState, useRef, useEffect } from 'react'
import styles from './CommandInput.module.css'

interface CommandInputProps {
  onSubmit: (command: string) => void
  history: string[]
  placeholder?: string
}

export function CommandInput({ onSubmit, history, placeholder = "Type a command... (try 'help')" }: CommandInputProps) {
  const [value, setValue] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
      setValue('')
      setHistoryIndex(-1)
    } else if (e.key === 'Escape') {
      setValue('')
      setHistoryIndex(-1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIndex)
        setValue(history[history.length - 1 - newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setValue(history[history.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setValue('')
      }
    }
  }

  return (
    <div className={styles.container}>
      <span className={styles.prompt}>&gt;</span>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
