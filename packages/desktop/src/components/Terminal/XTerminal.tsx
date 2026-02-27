/**
 * XTerminal Component
 *
 * Real terminal emulator using xterm.js connected to native PTY.
 * Integrates with useTerminal hook for Tauri IPC.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { invoke } from '@tauri-apps/api/core'
import { useTerminal, type TerminalConfig } from '../../hooks/useTerminal'
import { SyncAwareOutputBatcher, cleanupOnProcessExit, TUIDiagnostics } from '../../lib/tui-diagnostics'
import styles from './XTerminal.module.css'

// Delay before injecting initial command to allow shell to initialize
// This accounts for shell startup time (loading .zshrc/.bashrc, etc.)
const SHELL_INIT_DELAY_MS = 500

// Delay before first attempt to capture Claude Code's conversation ID.
// Claude Code needs time to start up and create its session file.
const CONVERSATION_CAPTURE_DELAY_MS = 5000

// Number of retry attempts for conversation ID capture
const CONVERSATION_CAPTURE_RETRIES = 3

// Interval between retry attempts (ms)
const CONVERSATION_CAPTURE_INTERVAL_MS = 5000

// Debounce delay for resize events to avoid flooding the PTY during animated resizing
const RESIZE_DEBOUNCE_MS = 150

// Bounds for terminal dimensions to prevent degenerate sizes
const MIN_COLS = 20
const MAX_COLS = 500
const MIN_ROWS = 5
const MAX_ROWS = 200

// Terminal theme from design tokens (dialectic-terminal-mockup_1.html)
const TERMINAL_THEME = {
  background: '#1F1E1B',      // --warm-black
  foreground: '#B5B0A8',      // --warm-light
  cursor: '#C4836A',          // --rust-light
  cursorAccent: '#1F1E1B',
  selectionBackground: 'rgba(196, 131, 106, 0.3)',
  black: '#1F1E1B',
  red: '#E55A5A',
  green: '#7FB174',           // --term-green
  yellow: '#D4A656',          // --term-yellow
  blue: '#7B9DBF',            // --term-blue
  magenta: '#B07BA8',         // --term-magenta
  cyan: '#6AA8A0',            // --term-cyan
  white: '#D9D4CA',           // --warm-pale
  brightBlack: '#4A4743',     // --warm-mid
  brightRed: '#E55A5A',
  brightGreen: '#7FB174',
  brightYellow: '#D4A656',
  brightBlue: '#7B9DBF',
  brightMagenta: '#B07BA8',
  brightCyan: '#6AA8A0',
  brightWhite: '#D9D4CA',
}

interface XTerminalProps {
  sessionId: string
  workingDir: string
  onClose?: () => void
  /** Command to inject after terminal spawns (e.g., "claude --resume <id>") */
  initialCommand?: string
  /** Extra environment variables to set in the terminal */
  envVars?: Record<string, string>
}

export function XTerminal({ sessionId, workingDir, onClose, initialCommand, envVars }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasSpawnedRef = useRef(false)
  // Track dimensions last sent to PTY, shared between spawn and resize observer
  const lastDimsRef = useRef({ cols: 0, rows: 0 })
  const batcherRef = useRef<SyncAwareOutputBatcher | null>(null)
  const diagnosticsRef = useRef<TUIDiagnostics | null>(null)

  // Terminal hook with output handler — route through batcher for flicker-free rendering
  const { spawn, write, resize, isConnected, error } = useTerminal({
    onOutput: useCallback((data: string) => {
      if (batcherRef.current) {
        batcherRef.current.write(data)
      } else {
        terminalRef.current?.write(data)
      }
    }, []),
    onClose: useCallback(() => {
      if (terminalRef.current) {
        cleanupOnProcessExit(terminalRef.current)
      }
      onClose?.()
    }, [onClose]),
  })

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const terminal = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: "'IBM Plex Mono', 'Cousine', monospace",
      fontSize: 12,
      lineHeight: 1.5,
      cursorStyle: 'bar',
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle user input
    terminal.onData((data) => {
      write(data).catch((err) => {
        console.error('Failed to write to terminal:', err)
      })
    })

    // Handle binary input (special key combos, mouse events that onData misses)
    terminal.onBinary((data) => {
      write(data).catch((err) => {
        console.error('Failed to write binary to terminal:', err)
      })
    })

    // Initialize output batcher for flicker-free rendering (~60fps batching)
    const batcher = new SyncAwareOutputBatcher(terminal)
    batcherRef.current = batcher

    // Dev-mode diagnostics
    if (import.meta.env.DEV) {
      const diag = new TUIDiagnostics(terminal, { verbose: true })
      diag.start()
      diagnosticsRef.current = diag
    }

    return () => {
      diagnosticsRef.current?.stop()
      diagnosticsRef.current = null
      batcherRef.current?.dispose()
      batcherRef.current = null
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [write])

  // Spawn terminal on mount
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current || hasSpawnedRef.current) return

    hasSpawnedRef.current = true
    const fit = fitAddonRef.current

    const dims = fit.proposeDimensions()
    const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, dims?.cols ?? 80))
    const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, dims?.rows ?? 24))

    // Record spawn dimensions so ResizeObserver won't send a redundant resize
    lastDimsRef.current = { cols, rows }

    const config: TerminalConfig = {
      sessionId,
      workingDir,
      cols,
      rows,
      env: envVars,
    }

    spawn(config)
      .then(() => {
        setIsLoading(false)
        // Inject initial command after shell has initialized
        if (initialCommand) {
          setTimeout(() => {
            write(initialCommand + '\n').catch((err) => {
              console.error('Failed to write initial command:', err)
            })
          }, SHELL_INIT_DELAY_MS)

          // Capture Claude Code's conversation ID with retries
          const attemptCapture = (attempt: number) => {
            invoke('capture_conversation_id', { sessionId })
              .then((convId) => {
                if (convId) {
                  console.log(`Captured conversation ID (attempt ${attempt}):`, convId)
                } else if (attempt < CONVERSATION_CAPTURE_RETRIES) {
                  setTimeout(() => attemptCapture(attempt + 1), CONVERSATION_CAPTURE_INTERVAL_MS)
                } else {
                  console.warn('Conversation ID capture exhausted all retries')
                }
              })
              .catch((err) => {
                if (attempt < CONVERSATION_CAPTURE_RETRIES) {
                  console.warn(`Conversation ID capture attempt ${attempt} failed, retrying...`, err)
                  setTimeout(() => attemptCapture(attempt + 1), CONVERSATION_CAPTURE_INTERVAL_MS)
                } else {
                  console.warn('Failed to capture conversation ID after all retries:', err)
                }
              })
          }
          setTimeout(() => attemptCapture(1), CONVERSATION_CAPTURE_DELAY_MS)
        }
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })
  }, [sessionId, workingDir, spawn, write, initialCommand, envVars])

  // Handle resize with debouncing
  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return

    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const doResize = () => {
      const fit = fitAddonRef.current
      if (!fit) return

      try {
        fit.fit()
        const dims = fit.proposeDimensions()
        if (!dims) return

        const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, dims.cols))
        const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, dims.rows))

        // Only send resize if dimensions actually changed from what PTY knows
        if (cols !== lastDimsRef.current.cols || rows !== lastDimsRef.current.rows) {
          lastDimsRef.current = { cols, rows }
          resize(cols, rows)
        }
      } catch {
        // Ignore resize errors during transitions
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      // Debounce all resize events to avoid flooding the PTY with SIGWINCH
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(doResize, RESIZE_DEBOUNCE_MS)
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
    }
  }, [resize])

  // Focus terminal when connected
  useEffect(() => {
    if (isConnected && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isConnected])

  const displayError = loadError || error

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.terminal} />
      {(isLoading || displayError) && (
        <div className={styles.overlay}>
          {isLoading && !displayError && (
            <>
              <span className={styles.spinner} />
              <span>Starting terminal...</span>
            </>
          )}
          {displayError && (
            <span className={styles.error}>Error: {displayError}</span>
          )}
        </div>
      )}
    </div>
  )
}
