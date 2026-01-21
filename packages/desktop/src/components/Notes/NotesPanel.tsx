/**
 * NotesPanel Component
 *
 * A parchment-styled notes panel for capturing quick thoughts and key questions.
 * Supports pinned notes and timestamped entries.
 */

import { useState, useRef, useEffect } from 'react'
import type { Note } from './types'
import styles from './NotesPanel.module.css'

interface NotesPanelProps {
  notes: Note[]
  onAddNote: (content: string) => void
  onTogglePin: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function NotesPanel({
  notes,
  onAddNote,
  onTogglePin,
  onDeleteNote,
}: NotesPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((n) => n.isPinned)
  const unpinnedNotes = notes
    .filter((n) => !n.isPinned)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Auto-scroll to bottom when new note is added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [notes.length])

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAddNote(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={styles.notesPanel}>
      <div className={styles.notesList} ref={listRef}>
        {/* Pinned section */}
        {pinnedNotes.length > 0 && (
          <div className={styles.pinnedSection}>
            <div className={styles.sectionLabel}>PINNED</div>
            {pinnedNotes.map((note) => (
              <div
                key={note.id}
                className={`${styles.noteItem} ${styles.pinned}`}
                onDoubleClick={() => onTogglePin(note.id)}
              >
                <div className={styles.noteContent}>{note.content}</div>
                <button
                  className={styles.deleteButton}
                  onClick={() => onDeleteNote(note.id)}
                  aria-label="Delete note"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Regular notes */}
        {unpinnedNotes.map((note) => (
          <div
            key={note.id}
            className={styles.noteItem}
            onDoubleClick={() => onTogglePin(note.id)}
          >
            <div className={styles.noteTimestamp}>{formatTime(new Date(note.timestamp))}</div>
            <div className={styles.noteContent}>{note.content}</div>
            <button
              className={styles.deleteButton}
              onClick={() => onDeleteNote(note.id)}
              aria-label="Delete note"
            >
              ×
            </button>
          </div>
        ))}

        {/* Empty state */}
        {notes.length === 0 && (
          <div className={styles.emptyState}>
            Capture key questions and insights as you explore.
          </div>
        )}
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <input
          type="text"
          className={styles.noteInput}
          placeholder="+ Add note..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}
