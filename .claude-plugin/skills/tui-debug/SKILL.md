---
name: tui-debug
description: Debug and fix TUI rendering issues in xterm.js-embedded terminal applications, especially when hosting interactive CLI tools like Claude Code. Covers flickering, ANSI escape sequence conflicts, alternate screen buffer management, synchronized output (DEC mode 2026), Ink/React CLI rendering issues, input handling, and PTY configuration. Use when encountering visual artifacts, flickering, broken layouts, unresponsive input, or scroll storms in xterm.js terminals running TUI applications.
allowed-tools: Read, Grep, Glob, Bash
---

# TUI Debugging Skill

Diagnose and resolve Text User Interface rendering problems in xterm.js-embedded terminals, with special focus on hosting interactive CLI tools (Claude Code, Ink-based apps, ncurses programs) inside Electron/web applications.

---

## Problem Taxonomy

TUI issues in xterm.js fall into five categories. Identify which you're dealing with before applying fixes.

### 1. Flicker / Visual Artifacts
**Symptoms**: Screen flashes, content redraws visibly, ghost text from previous frames.
**Root cause**: Full-screen redraws where the terminal clears and rewrites all content on every state change. Ink's architecture does full-tree traversal and complete screen redraws on every React state change — even when only a single status line updates.

**The render cycle that causes flicker**:
```
React State Change
  → Reconciler calls rootNode.onRender()
  → render(rootNode) traverses ALL nodes
  → Builds complete 2D buffer
  → ansiEscapes.eraseLines(previousLineCount)  ← THE FLICKER
  → Writes complete new output
```

### 2. Scroll Storms
**Symptoms**: UI jitter, high CPU, terminal multiplexer lag. Claude Code was measured at 4,000–6,700 scroll events/second during streaming — 40–600x higher than typical terminal usage.
**Root cause**: Streaming LLM output triggers rapid re-renders, each producing scroll events.

### 3. Input Handling Conflicts
**Symptoms**: Keyboard input unresponsive, Shift+Tab doesn't work, special keys not recognized, bracketed paste broken.
**Root cause**: The hosted TUI app and the xterm.js instance both try to handle input, or TERM/terminfo capabilities are misreported.

### 4. Alternate Screen Buffer Conflicts
**Symptoms**: Content disappears, scrollback lost, selection broken, search doesn't work.
**Root cause**: TUI app switches to alternate screen (CSI ?1049h) which xterm.js supports but breaks native terminal affordances like text selection, scrollback, and find.

### 5. Escape Sequence Mishandling
**Symptoms**: Raw escape codes visible as text, garbled output, colors wrong, cursor in wrong position.
**Root cause**: TERM variable mismatch, unsupported sequences, or encoding issues in the PTY layer.

---

## Diagnostic Procedures

### Step 1: Capture Raw Output

Intercept what the hosted process actually writes before xterm.js interprets it:

```javascript
// Attach to your PTY's data event BEFORE passing to xterm
ptyProcess.onData((data) => {
  // Log raw bytes for analysis
  const hex = Buffer.from(data).toString('hex');
  const escaped = data.replace(/\x1b/g, '\\e');
  console.log('[PTY RAW]', {
    length: data.length,
    escaped: escaped.substring(0, 200),
    hex: hex.substring(0, 100)
  });

  // Then pass to terminal
  terminal.write(data);
});
```

### Step 2: Detect Flicker Patterns

Count how many erase-line sequences arrive per second:

```javascript
let eraseCount = 0;
let lastReport = Date.now();

const originalWrite = terminal.write.bind(terminal);
terminal.write = (data) => {
  // Count erase-line sequences: ESC[2K and ESC[1A (clear line + move up)
  const erases = (data.match(/\x1b\[2K/g) || []).length;
  const cursorUps = (data.match(/\x1b\[\d*A/g) || []).length;
  eraseCount += erases;

  const now = Date.now();
  if (now - lastReport > 1000) {
    if (eraseCount > 100) {
      console.warn(`[TUI-DEBUG] Flicker risk: ${eraseCount} erase-lines/sec, ${cursorUps} cursor-ups/sec`);
    }
    eraseCount = 0;
    lastReport = now;
  }

  return originalWrite(data);
};
```

**Thresholds**:
- < 30 erases/sec: Normal TUI operation
- 30–100 erases/sec: Mild flicker likely
- 100–500 erases/sec: Significant flicker
- 500+ erases/sec: Scroll storm territory (Claude Code pre-fix was 4,000–6,700/sec)

### Step 3: Detect Alternate Screen Usage

```javascript
terminal.parser.registerCsiHandler({ final: 'h' }, (params) => {
  if (params[0] === 1049 || params[0] === 47 || params[0] === 1047) {
    console.log('[TUI-DEBUG] Entering alternate screen buffer');
    // Track this — it means the hosted app wants full screen control
  }
  return false; // Don't consume, let xterm handle it
});

terminal.parser.registerCsiHandler({ final: 'l' }, (params) => {
  if (params[0] === 1049 || params[0] === 47 || params[0] === 1047) {
    console.log('[TUI-DEBUG] Exiting alternate screen buffer');
  }
  return false;
});
```

### Step 4: Monitor Synchronized Output

Check if the hosted app is using DEC mode 2026:

```javascript
// Track synchronized output frames
let inSyncFrame = false;
let syncFrameStart = 0;
let syncBuffer = '';

terminal.parser.registerCsiHandler({ final: 'h' }, (params) => {
  if (params[0] === 2026) {
    inSyncFrame = true;
    syncFrameStart = performance.now();
    syncBuffer = '';
    console.log('[TUI-DEBUG] Sync frame BEGIN (DEC 2026)');
  }
  return false;
});

terminal.parser.registerCsiHandler({ final: 'l' }, (params) => {
  if (params[0] === 2026) {
    const duration = performance.now() - syncFrameStart;
    console.log(`[TUI-DEBUG] Sync frame END — ${duration.toFixed(1)}ms, ${syncBuffer.length} bytes`);
    inSyncFrame = false;
  }
  return false;
});
```

### Step 5: Measure Render Performance

```javascript
// Measure time between writes and actual renders
const writeTimestamps = [];

const origWrite = terminal.write.bind(terminal);
terminal.write = (data, callback) => {
  writeTimestamps.push(performance.now());

  // Trim to last 100
  if (writeTimestamps.length > 100) writeTimestamps.shift();

  // Calculate write frequency
  if (writeTimestamps.length >= 10) {
    const span = writeTimestamps[writeTimestamps.length - 1] - writeTimestamps[writeTimestamps.length - 10];
    const writesPerSec = (9 / span) * 1000;
    if (writesPerSec > 120) {
      console.warn(`[TUI-DEBUG] High write frequency: ${writesPerSec.toFixed(0)} writes/sec — consider batching`);
    }
  }

  return origWrite(data, callback);
};
```

---

## Mitigation Strategies

### Strategy 1: Output Batching / Throttling

The single most impactful fix. Batch PTY output to ~60fps before passing to xterm.js. See `packages/desktop/src/lib/tui-diagnostics.ts` for the `SyncAwareOutputBatcher` implementation.

**Critical**: This MUST preserve synchronized output frames. If DEC 2026 is in use, the entire frame (BSU→ESU) should be written atomically.

### Strategy 2: Enable Synchronized Output (DEC Mode 2026)

xterm.js 6.0+ supports DEC mode 2026 natively. This is the gold standard — it lets the terminal batch all writes between BSU/ESU into a single atomic render.

### Strategy 3: PTY Configuration

The PTY layer is where many subtle issues originate. Ensure:
- `TERM=xterm-256color`
- `COLORTERM=truecolor`
- `LANG=en_US.UTF-8`
- PTY dimensions synced with xterm.js on init AND resize

### Strategy 4: Process Exit Cleanup

When a hosted process exits, ensure the terminal is in a clean state. See `cleanupOnProcessExit()` in `packages/desktop/src/lib/tui-diagnostics.ts`.

---

## Debugging Checklist

Run through this when investigating TUI issues:

```
□ xterm.js version >= 6.0.0 (DEC 2026 support)
□ TERM environment variable = 'xterm-256color'
□ PTY cols/rows synced with terminal on init AND resize
□ Output batching/throttling in place (~60fps)
□ Synchronized output frames preserved (not split by batching)
□ Input forwarding includes onData AND onBinary
□ No accidental double-write (PTY data → xterm AND manual echo)
□ WebGL renderer enabled for performance (addon-webgl)
□ Fit addon active and responding to container resize
□ Flow control configured (not fighting between PTY and xterm)
```

---

## Common Failure Modes & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Screen flashes white/black between updates | Full redraws without sync output | Enable DEC 2026 or add output batching |
| Ghost text from previous output | Incomplete erase before rewrite | Ensure erase sequences aren't split across batches |
| Cursor stuck in wrong position | Mismatched cols/rows between PTY and terminal | Sync dimensions on resize AND init |
| Colors wrong or missing | TERM not set to xterm-256color | Set TERM env var in PTY spawn |
| Special keys (arrows, Home, End) don't work | Input not forwarded via onData/onBinary | Attach both handlers |
| Terminal goes blank after hosted app exits | Alt screen buffer not exited | Write ESC[?1049l on process exit |
| Scrollbar fighting / double scroll | Both xterm and app handling scroll | Disable one; usually let xterm handle it |
| Content wider than viewport, wrapping wrong | PTY cols don't match terminal cols | Force resize after terminal attach |
| "Raw" escape codes visible as text | PTY not in raw mode or TERM wrong | Check PTY name matches, check shell setup |
| Paste inserts escape chars | Bracketed paste mode conflict | Ensure only one layer enables ESC[?2004h |

---

## Reference: Key ANSI Sequences for TUI Debugging

```
CURSOR
  ESC[{n}A        Cursor up n lines
  ESC[{n}B        Cursor down n lines
  ESC[{r};{c}H    Cursor to row r, column c
  ESC[s           Save cursor position
  ESC[u           Restore cursor position
  ESC[?25h        Show cursor
  ESC[?25l        Hide cursor

ERASE
  ESC[2K          Erase entire line
  ESC[0K          Erase from cursor to end of line
  ESC[2J          Erase entire screen
  ESC[3J          Erase screen + scrollback

SCREEN BUFFER
  ESC[?1049h      Enter alternate screen (save cursor + switch + clear)
  ESC[?1049l      Exit alternate screen (restore)
  ESC[?47h        Alt screen (simpler, no cursor save)

SYNCHRONIZED OUTPUT (DEC 2026)
  ESC[?2026h      Begin Synchronized Update (BSU) — buffer output
  ESC[?2026l      End Synchronized Update (ESU) — flush to screen
  ESC[?2026$p     Query sync output support (DECRQM)

SCROLLING
  ESC[{n}S        Scroll up n lines
  ESC[{n}T        Scroll down n lines
  ESC[{t};{b}r    Set scroll region (rows t through b)

MOUSE
  ESC[?1000h      Enable basic mouse reporting
  ESC[?1002h      Enable cell motion mouse tracking
  ESC[?1003h      Enable all motion mouse tracking
  ESC[?1006h      SGR mouse encoding (modern, recommended)

MISC
  ESC[?2004h      Enable bracketed paste mode
  ESC[?2004l      Disable bracketed paste mode
  ESC c           Full terminal reset (RIS) — DANGEROUS, clears scrollback
  ESC[!p          Soft reset (DECSTR) — safer
```
