/**
 * InputArea Component
 *
 * Multiline textarea with amber border and prompt character.
 * Submit with Enter, newline with Shift+Enter.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './Conversation.module.css'

interface InputAreaProps {
  placeholder?: string
  promptChar?: string
  onSubmit: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

export function InputArea({
  placeholder = 'Continue the analysis...',
  promptChar = '>',
  onSubmit,
  disabled = false,
  autoFocus = false,
}: InputAreaProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [value])

  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim())
      setValue('')
      // Reset height after submission
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      // Shift+Enter allows newlines naturally
    },
    [handleSubmit]
  )

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputBox}>
        <span className={styles.inputPrompt}>{promptChar}</span>
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
      </div>
      <div className={styles.inputHint}>
        <span>Enter to send</span>
        <span className={styles.inputHintDivider}>·</span>
        <span>Shift+Enter for newline</span>
      </div>
    </div>
  )
}
