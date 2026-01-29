/**
 * useTerminal Hook
 *
 * Custom hook for managing PTY terminal sessions via Tauri IPC.
 * Handles spawning, writing, resizing, and killing terminals,
 * as well as listening for output and close events.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface TerminalConfig {
  sessionId: string
  workingDir: string
  command?: string
  args?: string[]
  cols: number
  rows: number
}

export interface TerminalState {
  sessionId: string
  pid: number
  running: boolean
}

interface UseTerminalOptions {
  onOutput?: (data: string) => void
  onClose?: () => void
}

interface UseTerminalReturn {
  spawn: (config: TerminalConfig) => Promise<TerminalState>
  write: (data: string) => Promise<void>
  resize: (cols: number, rows: number) => Promise<void>
  kill: () => Promise<void>
  isConnected: boolean
  error: string | null
}

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const unlistenOutputRef = useRef<UnlistenFn | null>(null)
  const unlistenClosedRef = useRef<UnlistenFn | null>(null)

  // Cleanup function for event listeners
  const cleanup = useCallback(async () => {
    if (unlistenOutputRef.current) {
      unlistenOutputRef.current()
      unlistenOutputRef.current = null
    }
    if (unlistenClosedRef.current) {
      unlistenClosedRef.current()
      unlistenClosedRef.current = null
    }
  }, [])

  // Spawn a new terminal session
  const spawn = useCallback(async (config: TerminalConfig): Promise<TerminalState> => {
    try {
      setError(null)

      // Clean up any existing listeners
      await cleanup()

      // Set up event listeners before spawning
      const outputEventName = `terminal-output-${config.sessionId}`
      const closedEventName = `terminal-closed-${config.sessionId}`

      unlistenOutputRef.current = await listen<string>(outputEventName, (event) => {
        options.onOutput?.(event.payload)
      })

      unlistenClosedRef.current = await listen(closedEventName, () => {
        setIsConnected(false)
        options.onClose?.()
      })

      // Spawn the terminal
      const state = await invoke<TerminalState>('spawn_terminal', { config })

      sessionIdRef.current = config.sessionId
      setIsConnected(true)

      return state
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      setIsConnected(false)
      throw err
    }
  }, [cleanup, options])

  // Write data to the terminal
  const write = useCallback(async (data: string): Promise<void> => {
    if (!sessionIdRef.current) {
      throw new Error('No terminal session active')
    }

    try {
      await invoke('write_to_terminal', {
        sessionId: sessionIdRef.current,
        data,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      throw err
    }
  }, [])

  // Resize the terminal
  const resize = useCallback(async (cols: number, rows: number): Promise<void> => {
    if (!sessionIdRef.current) {
      return // Silently ignore if no session
    }

    try {
      await invoke('resize_terminal', {
        sessionId: sessionIdRef.current,
        cols,
        rows,
      })
    } catch (err) {
      // Resize errors are non-fatal, just log
      console.warn('Failed to resize terminal:', err)
    }
  }, [])

  // Kill the terminal session
  const kill = useCallback(async (): Promise<void> => {
    if (!sessionIdRef.current) {
      return
    }

    try {
      await invoke('kill_terminal', {
        sessionId: sessionIdRef.current,
      })
    } catch (err) {
      // Kill errors are non-fatal
      console.warn('Failed to kill terminal:', err)
    } finally {
      await cleanup()
      sessionIdRef.current = null
      setIsConnected(false)
    }
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
      // Also kill the terminal on unmount
      if (sessionIdRef.current) {
        invoke('kill_terminal', { sessionId: sessionIdRef.current }).catch(() => {
          // Ignore errors during cleanup
        })
      }
    }
  }, [cleanup])

  return {
    spawn,
    write,
    resize,
    kill,
    isConnected,
    error,
  }
}
