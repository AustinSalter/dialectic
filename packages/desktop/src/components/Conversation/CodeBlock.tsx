/**
 * CodeBlock Component
 *
 * Styled code display with optional filename header and action label.
 */

import styles from './Conversation.module.css'

interface CodeBlockProps {
  filename?: string
  action?: string // e.g., "Created", "Modified", "Deleted"
  children: React.ReactNode
}

export function CodeBlock({ filename, action, children }: CodeBlockProps) {
  const hasHeader = filename || action

  return (
    <div className={styles.codeBlock}>
      {hasHeader && (
        <div className={styles.codeBlockHeader}>
          {filename && <span className={styles.codeBlockFilename}>{filename}</span>}
          {action && <span className={styles.codeBlockAction}>{action}</span>}
        </div>
      )}
      <code>{children}</code>
    </div>
  )
}
