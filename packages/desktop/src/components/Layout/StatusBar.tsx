/**
 * StatusBar Component
 *
 * Bottom status bar with:
 * - Keyboard shortcuts hint
 * - Session count
 * - Version
 */

import styles from './StatusBar.module.css'

interface StatusBarProps {
  sessionCount: number
  version?: string
}

export function StatusBar({ sessionCount, version = '0.2.0' }: StatusBarProps) {
  return (
    <footer className={styles.statusBar}>
      <span className={styles.shortcuts}>
        <kbd>⌘K</kbd> commands <span className={styles.separator}>│</span>
        <kbd>⌘B</kbd> board <span className={styles.separator}>│</span>
        <kbd>⌘T</kbd> terminal
      </span>
      <span className={styles.info}>
        {sessionCount} sessions • v{version}
      </span>
    </footer>
  )
}
