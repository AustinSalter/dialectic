/**
 * useDraggable Hook
 *
 * Provides drag and resize behavior for floating windows.
 * Handles mouse events and constrains to viewport bounds.
 */

import { useState, useCallback, useRef, useEffect } from 'react'

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

interface UseDraggableOptions {
  initialPosition?: Position
  initialSize?: Size
  minSize?: Size
  onPositionChange?: (position: Position) => void
  onSizeChange?: (size: Size) => void
  disabled?: boolean
}

interface UseDraggableReturn {
  position: Position
  size: Size
  isDragging: boolean
  isResizing: boolean
  resizeDirection: ResizeDirection
  handleMouseDown: (e: React.MouseEvent) => void
  handleResizeMouseDown: (direction: ResizeDirection) => (e: React.MouseEvent) => void
  setPosition: (position: Position) => void
  setSize: (size: Size) => void
}

const HEADER_HEIGHT = 52 // --header-height

export function useDraggable({
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 700, height: 500 },
  minSize = { width: 400, height: 300 },
  onPositionChange,
  onSizeChange,
  disabled = false,
}: UseDraggableOptions = {}): UseDraggableReturn {
  const [position, setPositionState] = useState<Position>(initialPosition)
  const [size, setSizeState] = useState<Size>(initialSize)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)

  const dragOffset = useRef<Position>({ x: 0, y: 0 })
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number; posX: number; posY: number }>({
    x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0
  })

  const setPosition = useCallback(
    (newPosition: Position) => {
      setPositionState(newPosition)
      onPositionChange?.(newPosition)
    },
    [onPositionChange]
  )

  const setSize = useCallback(
    (newSize: Size) => {
      setSizeState(newSize)
      onSizeChange?.(newSize)
    },
    [onSizeChange]
  )

  // Drag handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      if (e.button !== 0) return

      e.preventDefault()
      e.stopPropagation()

      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }

      setIsDragging(true)
    },
    [disabled, position]
  )

  // Resize handler
  const handleResizeMouseDown = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      if (disabled) return
      if (e.button !== 0) return

      e.preventDefault()
      e.stopPropagation()

      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
        posX: position.x,
        posY: position.y,
      }

      setResizeDirection(direction)
      setIsResizing(true)
    },
    [disabled, size, position]
  )

  // Drag effect
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const minX = 0
      const minY = HEADER_HEIGHT
      const maxX = window.innerWidth - 100
      const maxY = window.innerHeight - 50

      const newX = Math.max(minX, Math.min(maxX, e.clientX - dragOffset.current.x))
      const newY = Math.max(minY, Math.min(maxY, e.clientY - dragOffset.current.y))

      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, setPosition])

  // Resize effect
  useEffect(() => {
    if (!isResizing || !resizeDirection) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.current.x
      const deltaY = e.clientY - resizeStart.current.y
      const start = resizeStart.current

      let newWidth = start.width
      let newHeight = start.height
      let newX = start.posX
      let newY = start.posY

      // Handle horizontal resize
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minSize.width, start.width + deltaX)
      }
      if (resizeDirection.includes('w')) {
        const proposedWidth = start.width - deltaX
        if (proposedWidth >= minSize.width) {
          newWidth = proposedWidth
          newX = start.posX + deltaX
        }
      }

      // Handle vertical resize
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minSize.height, start.height + deltaY)
      }
      if (resizeDirection.includes('n')) {
        const proposedHeight = start.height - deltaY
        if (proposedHeight >= minSize.height) {
          newHeight = proposedHeight
          newY = Math.max(HEADER_HEIGHT, start.posY + deltaY)
        }
      }

      // Constrain to viewport
      newWidth = Math.min(newWidth, window.innerWidth - newX - 20)
      newHeight = Math.min(newHeight, window.innerHeight - newY - 20)

      setSize({ width: newWidth, height: newHeight })
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDirection(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeDirection, minSize, setPosition, setSize])

  return {
    position,
    size,
    isDragging,
    isResizing,
    resizeDirection,
    handleMouseDown,
    handleResizeMouseDown,
    setPosition,
    setSize,
  }
}
