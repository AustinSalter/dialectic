/**
 * TerminalView Component - V2Upgrade Design
 *
 * Main terminal container with:
 * - EmptyState when no output (positioned over vista)
 * - FloatingWindow containing CommandBlocks for command history
 * - CommandInput at bottom of window
 */

import { useState } from 'react'
import { EmptyState } from './EmptyState'
import { CommandInput } from './CommandInput'
import { CommandBlock, type CommandBlockData } from './CommandBlock'
import { FloatingWindow } from '../Window'
import { vistaTaglines, type VistaType } from '../Vista'
import styles from './TerminalView.module.css'

interface TerminalViewProps {
  blocks: CommandBlockData[]
  commandHistory: string[]
  onCommand: (command: string) => void
  hasOpenSessions?: boolean
  vistaVariant?: VistaType
}

export function TerminalView({ blocks, commandHistory, onCommand, hasOpenSessions = false, vistaVariant }: TerminalViewProps) {
  const hasBlocks = blocks.length > 0
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Hide empty state if there are blocks OR open session windows
  const showEmptyState = !hasBlocks && !hasOpenSessions

  // Get tagline for current vista
  const tagline = vistaVariant ? vistaTaglines[vistaVariant] : undefined

  return (
    <div className={styles.container}>
      {/* Empty state shows over vista when no blocks and no open sessions */}
      {showEmptyState && <EmptyState tagline={tagline} />}

      {/* Session window with command blocks */}
      {hasBlocks && (
        <FloatingWindow
          id="main-session"
          title="Session"
          status={{ type: 'active' }}
          initialPosition={{ x: Math.max(50, (window.innerWidth - 700) / 2), y: 80 }}
          initialSize={{ width: 700, height: Math.min(600, window.innerHeight - 150) }}
          isFullscreen={isFullscreen}
          onClose={() => {
            // Could clear blocks or minimize
          }}
          onMinimize={() => {
            // Could minimize to dock
          }}
          onMaximize={() => setIsFullscreen(!isFullscreen)}
        >
          <div className={styles.windowContent}>
            <div className={styles.conversation}>
              {blocks.map((block) => (
                <CommandBlock key={block.id} block={block} />
              ))}
            </div>
            <div className={styles.windowInput}>
              <CommandInput onSubmit={onCommand} history={commandHistory} />
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* Old CommandInput removed - GlobalInputBar is now the primary input */}
    </div>
  )
}
