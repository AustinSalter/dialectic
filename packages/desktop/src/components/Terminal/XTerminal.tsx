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
import { useTerminal, type TerminalConfig } from '../../hooks/useTerminal'
import styles from './XTerminal.module.css'

// Delay before injecting initial command to allow shell to initialize
// This accounts for shell startup time (loading .zshrc/.bashrc, etc.)
const SHELL_INIT_DELAY_MS = 500

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
  /** Command to inject after terminal spawns (e.g., "/brief resume <id>") */
  initialCommand?: string
}

export function XTerminal({ sessionId, workingDir, onClose, initialCommand }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasSpawnedRef = useRef(false)

  // Terminal hook with output handler
  const { spawn, write, resize, isConnected, error } = useTerminal({
    onOutput: useCallback((data: string) => {
      terminalRef.current?.write(data)
    }, []),
    onClose: useCallback(() => {
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

    return () => {
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

    const config: TerminalConfig = {
      sessionId,
      workingDir,
      cols: fit.proposeDimensions()?.cols ?? 80,
      rows: fit.proposeDimensions()?.rows ?? 24,
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
        }
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })
  }, [sessionId, workingDir, spawn, write, initialCommand])

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      const fit = fitAddonRef.current
      if (!fit) return

      try {
        fit.fit()
        const dims = fit.proposeDimensions()
        if (dims) {
          resize(dims.cols, dims.rows)
        }
      } catch {
        // Ignore resize errors during transitions
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
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
