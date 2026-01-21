/**
 * EmptyState Component - V2Upgrade Design
 *
 * Loops through 3 states with fade animation:
 * 1. "/ dialectic" branding
 * 2. Vista-specific tagline
 * 3. "Press N to start" hint
 */

import { useState, useEffect } from 'react'
import styles from './EmptyState.module.css'

type DisplayState = 'branding' | 'tagline' | 'hint'

const DISPLAY_ORDER: DisplayState[] = ['branding', 'tagline', 'hint']

interface EmptyStateProps {
  tagline?: string  // Vista-specific tagline
}

export function EmptyState({ tagline = 'The fire is for thinking.' }: EmptyStateProps) {
  const [currentState, setCurrentState] = useState<DisplayState>('branding')
  const [isVisible, setIsVisible] = useState(true)

  // Rotate through states every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false)

      // After fade out, change state and fade in
      setTimeout(() => {
        setCurrentState((prev) => {
          const currentIndex = DISPLAY_ORDER.indexOf(prev)
          const nextIndex = (currentIndex + 1) % DISPLAY_ORDER.length
          return DISPLAY_ORDER[nextIndex]
        })
        setIsVisible(true)
      }, 400) // Match CSS transition duration
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  // Render based on current state
  const renderContent = () => {
    switch (currentState) {
      case 'branding':
        return (
          <div className={styles.branding}>
            <span className={styles.slash}>/</span>
            <span className={styles.brandName}>dialectic</span>
          </div>
        )
      case 'tagline':
        return (
          <div className={styles.taglineText}>
            {tagline}
          </div>
        )
      case 'hint':
        return (
          <div className={styles.hintText}>
            Press <kbd className={styles.kbd}>⌥⌘N</kbd> to start a new session
          </div>
        )
    }
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.content} ${isVisible ? styles.visible : styles.hidden}`}>
        {renderContent()}
      </div>
    </div>
  )
}
