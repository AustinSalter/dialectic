/**
 * TUI Diagnostics for xterm.js
 *
 * Debugging toolkit and output batcher for diagnosing rendering issues
 * when hosting interactive TUI apps (Claude Code, etc.) in xterm.js.
 */

import type { Terminal, IDisposable } from '@xterm/xterm'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface DiagnosticsOptions {
  verbose?: boolean
  logPrefix?: string
  onWarning?: (msg: string) => void
  onInfo?: (msg: string) => void
}

interface DiagnosticsMetrics {
  eraseCount: number
  cursorMoveCount: number
  writeCount: number
  bytesWritten: number
  syncFrames: number
  altScreenEnters: number
  altScreenExits: number
  lastReportTime: number
  startTime: number
}

interface DiagnosticsReport {
  cols: number
  rows: number
  bufferType: string
  cursorPos: string
  scrollback: number
  warnings: string[]
}

interface BatcherOptions {
  flushIntervalMs?: number
  maxBufferBytes?: number
}

interface BatcherStats {
  flushes: number
  syncFrames: number
  bytesTotal: number
}

interface EscapeLoggerOptions {
  maxLogLength?: number
  filter?: RegExp | null
  onSequence?: (seq: string) => void
}

// ──────────────────────────────────────────────
// DIAGNOSTICS
// ──────────────────────────────────────────────

type Disposable = IDisposable | (() => void)

export class TUIDiagnostics {
  private terminal: Terminal
  private verbose: boolean
  private logPrefix: string
  private onWarning: (msg: string) => void
  private onInfo: (msg: string) => void
  private _disposables: Disposable[] = []
  private _metrics: DiagnosticsMetrics = {
    eraseCount: 0,
    cursorMoveCount: 0,
    writeCount: 0,
    bytesWritten: 0,
    syncFrames: 0,
    altScreenEnters: 0,
    altScreenExits: 0,
    lastReportTime: 0,
    startTime: 0,
  }

  constructor(terminal: Terminal, options: DiagnosticsOptions = {}) {
    this.terminal = terminal
    this.verbose = options.verbose ?? false
    this.logPrefix = options.logPrefix ?? '[TUI-DIAG]'
    this.onWarning = options.onWarning ?? ((msg) => console.warn(`${this.logPrefix} ${msg}`))
    this.onInfo = options.onInfo ?? ((msg) => { if (this.verbose) console.log(`${this.logPrefix} ${msg}`) })
  }

  start(): this {
    this._metrics.startTime = performance.now()
    this._metrics.lastReportTime = performance.now()

    this._interceptWrites()
    this._watchAltScreen()
    this._watchSyncOutput()
    this._startPeriodicReport()

    this.onInfo('Diagnostics started')
    this.healthCheck()

    return this
  }

  stop(): void {
    for (const d of this._disposables) {
      if (typeof d === 'function') d()
      else if (d?.dispose) d.dispose()
    }
    this._disposables = []
    this.onInfo('Diagnostics stopped')
  }

  healthCheck(): DiagnosticsReport {
    const warnings: string[] = []
    const t = this.terminal

    if (t.cols < 80) {
      warnings.push(`Terminal too narrow: ${t.cols} cols (TUI apps expect ≥80)`)
    }
    if (t.rows < 24) {
      warnings.push(`Terminal too short: ${t.rows} rows (TUI apps expect ≥24)`)
    }
    if (t.buffer.active.type === 'alternate') {
      warnings.push('In alternate screen buffer — scrollback/selection broken')
    }

    const report: DiagnosticsReport = {
      cols: t.cols,
      rows: t.rows,
      bufferType: t.buffer.active.type,
      cursorPos: `${t.buffer.active.cursorX},${t.buffer.active.cursorY}`,
      scrollback: t.buffer.normal.length - t.rows,
      warnings,
    }

    if (warnings.length) {
      warnings.forEach(w => this.onWarning(w))
    } else {
      this.onInfo('Health check: OK')
    }

    return report
  }

  getMetrics() {
    const elapsed = (performance.now() - this._metrics.startTime) / 1000
    return {
      ...this._metrics,
      elapsedSeconds: elapsed,
      writesPerSecond: this._metrics.writeCount / elapsed,
      erasesPerSecond: this._metrics.eraseCount / elapsed,
      avgBytesPerWrite: this._metrics.writeCount > 0
        ? this._metrics.bytesWritten / this._metrics.writeCount
        : 0,
    }
  }

  private _interceptWrites(): void {
    const origWrite = this.terminal.write.bind(this.terminal)
    const self = this
    let reportAccum = { erases: 0, writes: 0, bytes: 0 }

    this.terminal.write = function (data: string | Uint8Array, callback?: () => void) {
      const str = typeof data === 'string' ? data : new TextDecoder().decode(data)

      self._metrics.writeCount++
      self._metrics.bytesWritten += str.length
      reportAccum.writes++
      reportAccum.bytes += str.length

      // Count flicker-indicating sequences
      const erases = (str.match(/\x1b\[2K/g) || []).length
      const cursorUps = (str.match(/\x1b\[\d*A/g) || []).length
      self._metrics.eraseCount += erases
      self._metrics.cursorMoveCount += cursorUps
      reportAccum.erases += erases

      // Per-second warning
      const now = performance.now()
      if (now - self._metrics.lastReportTime > 1000) {
        if (reportAccum.erases > 100) {
          self.onWarning(
            `Flicker risk: ${reportAccum.erases} erases/sec, ` +
            `${reportAccum.writes} writes/sec, ` +
            `${(reportAccum.bytes / 1024).toFixed(1)}KB/sec`
          )
        }
        reportAccum = { erases: 0, writes: 0, bytes: 0 }
        self._metrics.lastReportTime = now
      }

      return origWrite(data, callback)
    } as Terminal['write']

    this._disposables.push(() => {
      this.terminal.write = origWrite
    })
  }

  private _watchAltScreen(): void {
    const altModes = [47, 1047, 1049]

    const enterHandler = this.terminal.parser.registerCsiHandler(
      { final: 'h' },
      (params) => {
        if (altModes.includes(params[0] as number)) {
          this._metrics.altScreenEnters++
          this.onWarning(`Alternate screen ENTERED (mode ${params[0]}) — count: ${this._metrics.altScreenEnters}`)
        }
        return false // Don't consume
      }
    )

    const exitHandler = this.terminal.parser.registerCsiHandler(
      { final: 'l' },
      (params) => {
        if (altModes.includes(params[0] as number)) {
          this._metrics.altScreenExits++
          this.onInfo(`Alternate screen EXITED (mode ${params[0]})`)
        }
        return false
      }
    )

    this._disposables.push(enterHandler, exitHandler)
  }

  private _watchSyncOutput(): void {
    let syncStart = 0

    const bsuHandler = this.terminal.parser.registerCsiHandler(
      { final: 'h' },
      (params) => {
        if (params[0] === 2026) {
          syncStart = performance.now()
          this.onInfo('Sync frame BEGIN (DEC 2026)')
        }
        return false
      }
    )

    const esuHandler = this.terminal.parser.registerCsiHandler(
      { final: 'l' },
      (params) => {
        if (params[0] === 2026) {
          this._metrics.syncFrames++
          const duration = performance.now() - syncStart
          this.onInfo(`Sync frame END — ${duration.toFixed(1)}ms (total: ${this._metrics.syncFrames})`)
        }
        return false
      }
    )

    this._disposables.push(bsuHandler, esuHandler)
  }

  private _startPeriodicReport(): void {
    const interval = setInterval(() => {
      if (this.verbose) {
        const m = this.getMetrics()
        this.onInfo(
          `[${m.elapsedSeconds.toFixed(0)}s] ` +
          `writes: ${m.writeCount}, erases: ${m.eraseCount}, ` +
          `sync frames: ${m.syncFrames}, ` +
          `alt screen: ${m.altScreenEnters} enters / ${m.altScreenExits} exits`
        )
      }
    }, 5000)

    this._disposables.push(() => clearInterval(interval))
  }
}


// ──────────────────────────────────────────────
// OUTPUT BATCHER (Sync-aware)
// ──────────────────────────────────────────────

/**
 * Batches PTY output to ~60fps while preserving DEC 2026
 * synchronized output frames as atomic writes.
 *
 * This is the single most impactful fix for TUI flickering.
 */
export class SyncAwareOutputBatcher {
  private terminal: Terminal
  private buffer = ''
  private inSyncFrame = false
  private syncBuffer = ''
  private maxBufferSize: number
  private timer: number | null = null
  private stats: BatcherStats = { flushes: 0, syncFrames: 0, bytesTotal: 0 }

  // DEC 2026 markers
  private readonly BSU = '\x1b[?2026h'
  private readonly ESU = '\x1b[?2026l'

  constructor(terminal: Terminal, options: BatcherOptions = {}) {
    this.terminal = terminal
    this.maxBufferSize = options.maxBufferBytes ?? 64 * 1024
  }

  write(data: string | Uint8Array): void {
    const str = typeof data === 'string' ? data : new TextDecoder().decode(data)
    this.stats.bytesTotal += str.length

    // Handle synchronized output frames
    if (str.includes(this.BSU)) {
      // Flush pending non-sync content first
      this._flush()
      this.inSyncFrame = true
      this.syncBuffer = ''
    }

    if (this.inSyncFrame) {
      this.syncBuffer += str

      if (str.includes(this.ESU)) {
        // Write entire sync frame atomically — this is the whole point
        this.terminal.write(this.syncBuffer)
        this.stats.syncFrames++
        this.syncBuffer = ''
        this.inSyncFrame = false
      }
      return
    }

    // Normal batching
    this.buffer += str

    // Force flush if buffer exceeds limit (prevents lag on large outputs)
    if (this.buffer.length > this.maxBufferSize) {
      this._flush()
      return
    }

    // Schedule flush at next animation frame
    if (this.timer === null) {
      this.timer = requestAnimationFrame(() => {
        this._flush()
      })
    }
  }

  private _flush(): void {
    if (this.timer !== null) {
      cancelAnimationFrame(this.timer)
      this.timer = null
    }

    if (this.buffer.length > 0) {
      this.terminal.write(this.buffer)
      this.buffer = ''
      this.stats.flushes++
    }
  }

  getStats(): BatcherStats {
    return { ...this.stats }
  }

  dispose(): void {
    this._flush()
    if (this.timer !== null) cancelAnimationFrame(this.timer)
  }
}


// ──────────────────────────────────────────────
// PROCESS EXIT CLEANUP
// ──────────────────────────────────────────────

/**
 * Ensures terminal is in a clean state when a hosted process exits.
 * Fixes: blank screen, stuck in alt buffer, cursor hidden, etc.
 */
export function cleanupOnProcessExit(terminal: Terminal): void {
  const cleanup = [
    '\x1b[?1049l',   // Exit alternate screen (if in it)
    '\x1b[?25h',     // Show cursor
    '\x1b[?2004l',   // Disable bracketed paste
    '\x1b[?1000l',   // Disable mouse reporting
    '\x1b[?1002l',   // Disable cell motion tracking
    '\x1b[?1003l',   // Disable all motion tracking
    '\x1b[0m',       // Reset all text attributes
    '\x1b[r',        // Reset scroll region to full screen
  ].join('')

  terminal.write(cleanup)
}


// ──────────────────────────────────────────────
// RAW ESCAPE SEQUENCE LOGGER
// ──────────────────────────────────────────────

/**
 * Logs raw escape sequences in human-readable form.
 * Useful for understanding exactly what a TUI app is sending.
 */
export class EscapeSequenceLogger {
  private maxLogLength: number
  private filter: RegExp | null
  private onSequence: (seq: string) => void

  private readonly _knownSequences: Record<string, string> = {
    '\\e[2K': 'ERASE_LINE',
    '\\e[2J': 'ERASE_SCREEN',
    '\\e[3J': 'ERASE_SCROLLBACK',
    '\\e[?1049h': 'ALT_SCREEN_ON',
    '\\e[?1049l': 'ALT_SCREEN_OFF',
    '\\e[?25h': 'CURSOR_SHOW',
    '\\e[?25l': 'CURSOR_HIDE',
    '\\e[?2026h': 'SYNC_BEGIN',
    '\\e[?2026l': 'SYNC_END',
    '\\e[?2004h': 'BRACKETED_PASTE_ON',
    '\\e[?2004l': 'BRACKETED_PASTE_OFF',
    '\\e[?1000h': 'MOUSE_ON',
    '\\e[?1000l': 'MOUSE_OFF',
    '\\e[0m': 'RESET_ATTRS',
    '\\ec': 'HARD_RESET',
    '\\e[!p': 'SOFT_RESET',
  }

  constructor(options: EscapeLoggerOptions = {}) {
    this.maxLogLength = options.maxLogLength ?? 500
    this.filter = options.filter ?? null
    this.onSequence = options.onSequence ?? ((seq) => console.log(`[ESC] ${seq}`))
  }

  log(data: string | Uint8Array): void {
    const str = typeof data === 'string' ? data : new TextDecoder().decode(data)
    const escaped = str.replace(/\x1b/g, '\\e')

    if (this.filter && !this.filter.test(escaped)) return

    // Identify known sequences
    const annotations: string[] = []
    for (const [pattern, name] of Object.entries(this._knownSequences)) {
      const count = escaped.split(pattern).length - 1
      if (count > 0) {
        annotations.push(`${name}×${count}`)
      }
    }

    // Count cursor moves
    const cursorMoves = (escaped.match(/\\e\[\d+;\d+H/g) || []).length
    if (cursorMoves > 0) annotations.push(`CURSOR_MOVE×${cursorMoves}`)

    if (annotations.length > 0) {
      this.onSequence(
        `[${str.length}B] ${annotations.join(' ')} | ` +
        escaped.substring(0, this.maxLogLength)
      )
    }
  }
}
