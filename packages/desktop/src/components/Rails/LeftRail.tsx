/**
 * LeftRail Component
 *
 * Floating glass panel for file browsing.
 * Launches floating on vista, snaps to edge when dragged there.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './Rails.module.css'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

interface LeftRailProps {
  isOpen: boolean
  onToggle: () => void
  onFileSelect?: (path: string) => void
}

// Demo file structure - paths must match demoDocuments in App.tsx
const demoFiles: FileNode[] = [
  {
    name: 'research',
    type: 'folder',
    children: [
      { name: 'wang-letters.md', type: 'file' },
      { name: 'dalio-world-order.md', type: 'file' },
      { name: 'asml-analysis.pdf', type: 'file' },
    ],
  },
  {
    name: 'notes',
    type: 'folder',
    children: [
      { name: 'questions.md', type: 'file' },
    ],
  },
]

// Folder icon SVG
function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={styles.fileIcon}>
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.172a1.5 1.5 0 011.06.44l.658.658H13.5A1.5 1.5 0 0115 4.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/>
    </svg>
  )
}

// File icon SVG
function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={styles.fileIcon}>
      <path d="M4 1.5A1.5 1.5 0 015.5 0h4.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V14.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 010 14.5v-13A1.5 1.5 0 011.5 0h2.879"/>
    </svg>
  )
}

function FileTreeItem({
  node,
  depth,
  path,
  onSelect,
}: {
  node: FileNode
  depth: number
  path: string
  onSelect?: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const currentPath = `${path}/${node.name}`

  const handleClick = () => {
    if (node.type === 'folder') {
      setExpanded(!expanded)
    } else {
      onSelect?.(currentPath)
    }
  }

  return (
    <div className={styles.fileTreeItem}>
      <div
        className={`${styles.fileRow} ${node.type === 'folder' ? styles.folder : styles.file}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={handleClick}
      >
        {node.type === 'folder' ? <FolderIcon /> : <FileIcon />}
        <span className={styles.fileName}>{node.name}</span>
      </div>
      {node.type === 'folder' && expanded && node.children && (
        <div className={styles.fileChildren}>
          {node.children.map((child, idx) => (
            <FileTreeItem
              key={idx}
              node={child}
              depth={depth + 1}
              path={currentPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const SNAP_THRESHOLD = 60 // pixels from edge to snap

export function LeftRail({ isOpen, onToggle, onFileSelect }: LeftRailProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isSnapped, setIsSnapped] = useState(false)
  const [isNearEdge, setIsNearEdge] = useState(false)
  const [position, setPosition] = useState({ x: 80, y: 120 })
  const dragStart = useRef({ x: 0, y: 0 })
  const dragOffset = useRef({ x: 0, y: 0 })
  const railRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  // Reset to floating state when rail opens
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setIsSnapped(false)
      setPosition({ x: 80, y: 120 })
    }
    wasOpen.current = isOpen
  }, [isOpen])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return

    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }

    if (!isSnapped) {
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    } else {
      // When snapped, start from current position
      dragOffset.current = { x: e.clientX, y: e.clientY - 60 }
    }
  }, [isSnapped, position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x
      const newY = e.clientY - dragOffset.current.y

      // Check if window's left edge is near the screen's left edge
      const windowLeftEdge = Math.max(0, newX)
      const nearLeftEdge = windowLeftEdge < SNAP_THRESHOLD
      setIsNearEdge(nearLeftEdge)

      if (!isSnapped) {
        // Floating mode - update position
        setPosition({ x: windowLeftEdge, y: Math.max(60, newY) })

        // Snap if window edge is near screen edge
        if (nearLeftEdge) {
          setIsSnapped(true)
          setIsNearEdge(false)
        }
      } else {
        // Snapped mode - dragging away from drawer closes the rail
        if (e.clientX > SNAP_THRESHOLD + 150) {
          setIsDragging(false)
          setIsSnapped(false)
          onToggle() // Close the rail
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsNearEdge(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isSnapped, onToggle])

  const railClasses = [
    styles.rail,
    styles.leftRail,
    isOpen && styles.open,
    isSnapped && styles.snapped,
    isDragging && styles.dragging,
    isNearEdge && styles.nearEdge,
  ].filter(Boolean).join(' ')

  // Dynamic positioning for floating state
  const railStyle: React.CSSProperties = !isSnapped ? {
    top: position.y,
    left: position.x,
  } : {}

  // Drawer zone classes - shows docking target when dragging
  const drawerZoneClasses = [
    styles.drawerZone,
    styles.left,
    isDragging && styles.visible,
    isNearEdge && styles.active,
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* Drawer dock zone indicator */}
      <div className={drawerZoneClasses} />

      <div
        ref={railRef}
        className={railClasses}
        style={railStyle}
      >
        {/* Header - drag handle */}
      <div className={styles.railHeader} onMouseDown={handleMouseDown}>
        <svg viewBox="0 0 16 16" fill="currentColor" className={styles.railIcon}>
          <path d="M1 4a1 1 0 011-1h12a1 1 0 011 1v.5H1V4zm0 2h14v7a1 1 0 01-1 1H2a1 1 0 01-1-1V6zm5 2a.5.5 0 000 1h4a.5.5 0 000-1H6z"/>
        </svg>
        <span className={styles.railTitle}>Files</span>
        <button className={styles.railCloseBtn} onClick={onToggle}>
          ×
        </button>
      </div>

      {/* File tree */}
      <div className={styles.railContent}>
        <div className={styles.fileTree}>
          {demoFiles.map((node, idx) => (
            <FileTreeItem
              key={idx}
              node={node}
              depth={0}
              path=""
              onSelect={onFileSelect}
            />
          ))}
        </div>
      </div>
    </div>
    </>
  )
}
