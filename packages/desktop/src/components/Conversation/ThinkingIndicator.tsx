/**
 * ThinkingIndicator Component
 *
 * Subtle pulsing indicator shown while Claude is processing.
 * Shows thinking state with animated dots.
 */

import styles from './Conversation.module.css'

interface ThinkingIndicatorProps {
  message?: string
}

export function ThinkingIndicator({ message = 'Thinking' }: ThinkingIndicatorProps) {
  return (
    <div className={styles.thinkingIndicator}>
      <div className={styles.thinkingDots}>
        <span className={styles.thinkingDot} />
        <span className={styles.thinkingDot} />
        <span className={styles.thinkingDot} />
      </div>
      <span className={styles.thinkingText}>{message}</span>
    </div>
  )
}
