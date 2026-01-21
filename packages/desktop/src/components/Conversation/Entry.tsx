/**
 * Entry Component
 *
 * Individual message entry with role-based styling and markdown rendering.
 * - User: Lora serif, amber border
 * - Assistant: IBM Plex Mono, green border, markdown rendered
 * - Tool: Monospace, gray border, muted
 */

import ReactMarkdown from 'react-markdown'
import styles from './Conversation.module.css'

export type EntryRole = 'user' | 'assistant' | 'tool'

interface EntryProps {
  role: EntryRole
  roleLabel?: string
  children: React.ReactNode
  isStreaming?: boolean
}

export function Entry({ role, roleLabel, children, isStreaming = false }: EntryProps) {
  const defaultLabels: Record<EntryRole, string> = {
    user: 'You',
    assistant: 'Claude',
    tool: 'Tool',
  }

  const label = roleLabel ?? defaultLabels[role]

  // Render content - markdown for assistant, plain for user
  const renderContent = () => {
    if (typeof children === 'string') {
      if (role === 'assistant') {
        return (
          <ReactMarkdown
            components={{
              // Custom code block rendering
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match
                return isInline ? (
                  <code className={styles.inlineCode} {...props}>
                    {children}
                  </code>
                ) : (
                  <pre className={styles.codeBlock}>
                    <div className={styles.codeBlockHeader}>
                      <span className={styles.codeBlockFilename}>{match[1]}</span>
                    </div>
                    <code {...props}>{children}</code>
                  </pre>
                )
              },
              // Links open in new tab
              a: ({ children, ...props }) => (
                <a target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {children}
          </ReactMarkdown>
        )
      }
      return <p>{children}</p>
    }
    return children
  }

  return (
    <div className={`${styles.entry} ${styles[role]} ${isStreaming ? styles.streaming : ''}`}>
      <div className={styles.entryRole}>{label}</div>
      <div className={styles.entryContent}>
        {renderContent()}
        {isStreaming && <span className={styles.streamingCursor}>▋</span>}
      </div>
    </div>
  )
}
