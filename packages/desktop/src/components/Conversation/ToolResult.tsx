/**
 * ToolResult Component
 *
 * Styled output from tool execution with green-tinted background.
 */

import styles from './Conversation.module.css'

interface ToolResultProps {
  children: React.ReactNode
}

export function ToolResult({ children }: ToolResultProps) {
  return <div className={styles.toolResult}>{children}</div>
}
