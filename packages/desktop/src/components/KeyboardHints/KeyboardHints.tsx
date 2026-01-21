/**
 * KeyboardHints Component
 *
 * Simplified keyboard shortcut hints.
 * Format: kbd+label with separators
 */

import styles from './KeyboardHints.module.css'

export function KeyboardHints() {
  return (
    <div className={styles.container}>
      <span className={styles.hint}>
        <kbd className={styles.kbd}>⌥⌘N</kbd>
        <span className={styles.label}>new</span>
      </span>
      <span className={styles.separator}>·</span>
      <span className={styles.hint}>
        <kbd className={styles.kbd}>⌘B</kbd>
        <span className={styles.label}>board</span>
      </span>
      <span className={styles.separator}>·</span>
      <span className={styles.hint}>
        <kbd className={styles.kbd}>⇧⌘O</kbd>
        <span className={styles.label}>notes</span>
      </span>
      <span className={styles.separator}>·</span>
      <span className={styles.hint}>
        <kbd className={styles.kbd}>/help</kbd>
        <span className={styles.label}>commands</span>
      </span>
    </div>
  )
}
