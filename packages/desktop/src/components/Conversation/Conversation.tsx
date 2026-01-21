/**
 * Conversation Component
 *
 * Scrollable container for message entries.
 * Use inside a FloatingWindow.
 */

import { useRef, useEffect } from 'react'
import styles from './Conversation.module.css'

interface ConversationProps {
  children: React.ReactNode
  autoScroll?: boolean
}

export function Conversation({ children, autoScroll = true }: ConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [children, autoScroll])

  return (
    <div ref={containerRef} className={styles.conversation}>
      {children}
    </div>
  )
}
