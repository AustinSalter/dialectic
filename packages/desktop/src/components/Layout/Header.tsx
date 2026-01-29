/**
 * Header Component - V2Upgrade Design
 *
 * Top navigation bar with:
 * - Logo mark (diagonal line SVG) + "dialectic" wordmark
 * - New session button (+) - opens folder picker for terminal sessions
 * - Terminal / Board view toggles
 */

import { useCallback, useState } from 'react'
import { pickFolder } from '../../lib/folderPicker'
import styles from './Header.module.css'

export type View = 'terminal' | 'board'

interface HeaderProps {
  currentView: View
  onViewChange: (view: View) => void
  onNewSession?: () => void
  onNewSessionWithFolder?: (path: string, name: string) => void
  onToggleNotes?: () => void
  notesOpen?: boolean
  onToggleFilesRail?: () => void
  filesRailOpen?: boolean
  onToggleSessionsRail?: () => void
  sessionsRailOpen?: boolean
}

export function Header({
  currentView,
  onViewChange,
  onNewSession,
  onNewSessionWithFolder,
  onToggleNotes,
  notesOpen,
  onToggleFilesRail,
  filesRailOpen,
  onToggleSessionsRail,
  sessionsRailOpen,
}: HeaderProps) {
  const [isPickingFolder, setIsPickingFolder] = useState(false)

  // Handle new session with folder picker
  const handleNewSessionClick = useCallback(async () => {
    if (onNewSessionWithFolder) {
      if (isPickingFolder) return
      setIsPickingFolder(true)
      try {
        const folder = await pickFolder()
        if (folder) {
          onNewSessionWithFolder(folder.path, folder.name)
        }
      } finally {
        setIsPickingFolder(false)
      }
    } else if (onNewSession) {
      onNewSession()
    }
  }, [onNewSession, onNewSessionWithFolder, isPickingFolder])
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.logo}>
          {/* Logo Mark SVG */}
          <svg className={styles.logoMark} viewBox="0 0 20 28" width="14" height="20">
            <line
              x1="14"
              y1="4"
              x2="6"
              y2="24"
              stroke="#C4836A"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.wordmark}>dialectic</span>
        </div>
        <button
          className={styles.newBtn}
          onClick={handleNewSessionClick}
          disabled={isPickingFolder}
          title="New Session (⌥⌘N)"
        >
          <span className={styles.plus}>+</span>
        </button>
        <div className={styles.divider} />
        {/* Files rail toggle */}
        <button
          className={`${styles.iconBtn} ${filesRailOpen ? styles.iconBtnActive : ''}`}
          onClick={onToggleFilesRail}
          title="Files (⌘[)"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M2 3h12v1.5H2V3zm0 4h12v1.5H2V7zm0 4h12v1.5H2V11z"/>
          </svg>
        </button>
        {/* Sessions rail toggle - lightbulb/spark icon */}
        <button
          className={`${styles.iconBtn} ${sessionsRailOpen ? styles.iconBtnActive : ''}`}
          onClick={onToggleSessionsRail}
          title="Sessions (⌘])"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 11a3 3 0 100-6 3 3 0 000 6zm0 1a4 4 0 01-2.5-.9v1.4a.5.5 0 00.5.5h4a.5.5 0 00.5-.5v-1.4A4 4 0 018 13zm-6.5-5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zm12 0a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zM3.05 3.05a.5.5 0 01.707 0l.707.707a.5.5 0 11-.707.707l-.707-.707a.5.5 0 010-.707zm9.193.707a.5.5 0 00-.707-.707l-.707.707a.5.5 0 00.707.707l.707-.707z"/>
          </svg>
        </button>
      </div>

      <div className={styles.headerRight}>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${currentView === 'terminal' ? styles.active : ''}`}
            onClick={() => onViewChange('terminal')}
          >
            Terminal
          </button>
          <button
            className={`${styles.navBtn} ${currentView === 'board' ? styles.active : ''}`}
            onClick={() => onViewChange('board')}
          >
            Board
          </button>
        </nav>
        <button
          className={`${styles.notesBtn} ${notesOpen ? styles.notesActive : ''}`}
          onClick={onToggleNotes}
          title="Notes (⇧⌘O)"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1v1h8V4H4zm0 3v1h8V7H4zm0 3v1h5v-1H4z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

export default Header
