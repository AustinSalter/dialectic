/**
 * TerminalView Component
 *
 * Main terminal view showing:
 * - EmptyState when no session windows are open
 * - Vista background with prompt to open a folder
 */

import { EmptyState } from './EmptyState'
import { vistaTaglines, type VistaType } from '../Vista'
import styles from './TerminalView.module.css'

interface TerminalViewProps {
  hasOpenSessions?: boolean
  vistaVariant?: VistaType
}

export function TerminalView({ hasOpenSessions = false, vistaVariant }: TerminalViewProps) {
  // Get tagline for current vista
  const tagline = vistaVariant ? vistaTaglines[vistaVariant] : undefined

  return (
    <div className={styles.container}>
      {/* Empty state shows over vista when no open sessions */}
      {!hasOpenSessions && <EmptyState tagline={tagline} />}
    </div>
  )
}
