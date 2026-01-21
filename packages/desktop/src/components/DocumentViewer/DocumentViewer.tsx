/**
 * DocumentViewer Component
 *
 * Field guide style document viewer with:
 * - Warm paper background
 * - Ruled section headers
 * - Margin notes
 * - Block quotes
 * - Add to Session functionality
 */

import { useState } from 'react'
import type { DocumentContent, DocumentSection } from './types'
import styles from './DocumentViewer.module.css'

interface DocumentViewerProps {
  document: DocumentContent
  onClose: () => void
  onPin?: () => void
  onAddToSession?: (documentId: string) => void
  onAsk?: (question: string) => void
  isPinned?: boolean
  hasActiveSession?: boolean
  embedded?: boolean  // When true, hides internal titlebar (used inside FloatingWindow)
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      <div className={styles.sectionRule} />
    </div>
  )
}

function DocumentSectionView({ section }: { section: DocumentSection }) {
  if (section.type === 'quote') {
    return (
      <blockquote className={styles.quote}>
        {section.content}
      </blockquote>
    )
  }

  const hasHeader = section.type === 'summary' || section.type === 'argument' || section.type === 'tension'
  const headerTitle = section.title || (
    section.type === 'summary' ? 'Summary' :
    section.type === 'argument' ? 'Core Argument' :
    section.type === 'tension' ? 'Tensions' : ''
  )

  return (
    <div className={styles.section}>
      {section.marginNote && (
        <div className={styles.marginNote}>
          {section.marginNote}
        </div>
      )}
      <div className={styles.sectionContent}>
        {hasHeader && <SectionHeader title={headerTitle} />}
        <p className={styles.text}>{section.content}</p>
      </div>
    </div>
  )
}

export function DocumentViewer({
  document,
  onClose,
  onPin,
  onAddToSession,
  onAsk,
  isPinned = false,
  hasActiveSession = false,
  embedded = false,
}: DocumentViewerProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAsk = () => {
    if (inputValue.trim() && onAsk) {
      onAsk(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <div className={`${styles.viewer} ${embedded ? styles.embedded : ''}`}>
      {/* Titlebar - hidden when embedded in FloatingWindow */}
      {!embedded && (
        <div className={styles.titlebar}>
          <div className={styles.controls}>
            <button
              className={`${styles.control} ${styles.close}`}
              onClick={onClose}
              aria-label="Close"
            />
            <button
              className={`${styles.control} ${styles.minimize}`}
              aria-label="Minimize"
            />
            <button
              className={`${styles.control} ${styles.maximize}`}
              aria-label="Maximize"
            />
          </div>
          <div className={styles.filename}>{document.filename}</div>
          <div className={styles.actions}>
            <button
              className={`${styles.actionBtn} ${isPinned ? styles.actionActive : ''}`}
              onClick={onPin}
            >
              Pin
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onAddToSession?.(document.id)}
            >
              Add to Session
            </button>
          </div>
        </div>
      )}

      {/* Document content */}
      <div className={styles.content}>
        {document.sections.map((section, idx) => (
          <DocumentSectionView key={idx} section={section} />
        ))}
      </div>

      {/* Footer actions */}
      <div className={styles.footer}>
        <button className={styles.footerBtn}>
          Copy Link
        </button>
        {hasActiveSession && (
          <button
            className={`${styles.footerBtn} ${styles.footerBtnPrimary}`}
            onClick={() => onAddToSession?.(document.id)}
          >
            Add to Current Session
          </button>
        )}
      </div>

      {/* Ask input */}
      <div className={styles.askBar}>
        <span className={styles.askPrompt}>&gt;</span>
        <input
          type="text"
          className={styles.askInput}
          placeholder="Ask about this document..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}
