/**
 * CommandBlock Component
 *
 * Displays a command and its output with:
 * - Command as header
 * - Status dot (pulsing amber = running, green = done, red = error)
 * - Markdown rendered output
 * - Timestamp on right
 */

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from './CommandBlock.module.css'

export type CommandStatus = 'running' | 'done' | 'error'

export interface CommandBlockData {
  id: string
  command: string
  output: string
  status: CommandStatus
  timestamp: Date
}

interface CommandBlockProps {
  block: CommandBlockData
}

export function CommandBlock({ block }: CommandBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles.headerLeft}>
          <span className={`${styles.status} ${styles[block.status]}`} />
          <span className={styles.command}>
            <span className={styles.prompt}>&gt;</span> {block.command}
          </span>
        </div>
        <span className={styles.timestamp}>{formatTime(block.timestamp)}</span>
      </div>

      {isExpanded && block.output && (
        <div className={styles.output}>
          <ReactMarkdown>{block.output}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
