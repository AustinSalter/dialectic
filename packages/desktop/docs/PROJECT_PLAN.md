# Dialectic Project Plan

## Vision

A desktop workbench for high-stakes thinking — beautiful UI shell around Claude Code with a multi-pass reasoning methodology.

**Core insight**: Don't build an AI product. Build a *thinking interface* that uses Claude Code as the engine.

---

## What's Done

### Design
- [x] Visual identity — warm palette, rust accents, Libre Baskerville + Archivo Narrow
- [x] Vista concept — layered landscape SVG background
- [x] Floating session windows — draggable, conversation view
- [x] Snappable palettes — files/sessions, float or dock to edges
- [x] Field guide file viewer — warm paper, ruled lines, margin notes
- [x] Kanban board concept — sessions as cards across workflow columns
- [x] Persistent input line — bottom terminal prompt
- [x] Clean SVG icons — no emoji

### Architecture
- [x] Claude Code plugin structure (index.ts, package.json)
- [x] Slash commands: `/harness`, `/gather`, `/shape`, `/critique`, `/synthesize`, `/tension`, `/session`, `/resume`
- [x] Session persistence schema (session.json)
- [x] Context management strategy (file-based scratchpad)
- [x] Tauri + terminal integration architecture
- [x] Auto-loading from kanban (select card → load context)

### Methodology
- [x] Multi-pass harness (expansion → compression → critique → synthesis)
- [x] Semantic markers ([INSIGHT], [EVIDENCE], [RISK], [COUNTER], etc.)
- [x] Six questioning techniques
- [x] Termination logic (saturation, confidence threshold, max cycles)
- [x] Confidence tracking and trajectory analysis

---

## Phase 1: Plugin MVP
**Goal**: Working Claude Code plugin you can use today

### 1.1 Plugin Core
- [ ] Test plugin loads in Claude Code
- [ ] Verify slash commands register
- [ ] Test session.json creation/persistence
- [ ] Verify marker extraction from responses

### 1.2 Command Implementation
- [ ] `/harness` — creates session, shows intro
- [ ] `/gather` — adds context file, updates session
- [ ] `/shape` — renders scratchpad, prompts interview
- [ ] `/critique` — renders scratchpad, applies 6 techniques
- [ ] `/synthesize` — produces thesis document
- [ ] `/session list` — shows all sessions
- [ ] `/resume` — loads session, renders scratchpad

### 1.3 Scratchpad Logic
- [ ] Extract markers from response text
- [ ] Merge into session (deduplicate)
- [ ] Track confidence from response
- [ ] Check termination conditions
- [ ] Compact session when too large

### 1.4 Testing
- [ ] Run through full workflow manually
- [ ] Test resume after conversation close
- [ ] Test with real source materials
- [ ] Validate marker extraction regex

**Deliverable**: Installable plugin that works in vanilla Claude Code

---

## Phase 2: Tauri Shell
**Goal**: Desktop app with embedded terminal

### 2.1 Project Setup
- [ ] Initialize Tauri + React + TypeScript
- [ ] Configure Vite for development
- [ ] Set up Zustand stores (sessions, ui)
- [ ] Import design tokens (CSS variables)

### 2.2 Vista Background
- [ ] Create Vista.tsx component
- [ ] Implement layered SVG landscape
- [ ] Add subtle parallax on window resize (optional)
- [ ] Test performance

### 2.3 Terminal Integration
- [ ] Add xterm.js dependency
- [ ] Create Terminal.tsx wrapper
- [ ] Implement PTY management (Rust side)
- [ ] Spawn Claude Code process
- [ ] Bidirectional I/O (terminal ↔ PTY)
- [ ] Apply warm color theme to xterm

### 2.4 Session Window
- [ ] Create SessionWindow.tsx (floating, draggable)
- [ ] Embed Terminal component
- [ ] Window chrome (title, controls, status)
- [ ] Multiple windows support
- [ ] Z-index management

### 2.5 Persistent Input
- [ ] Create PersistentInput.tsx
- [ ] Route input to active terminal
- [ ] Handle slash commands
- [ ] Show placeholder based on state

**Deliverable**: Desktop app with terminal that spawns Claude Code

---

## Phase 3: File Watching & UI Sync
**Goal**: UI reacts to Claude Code's file changes

### 3.1 File Watcher (Rust)
- [ ] Watch .dialectic/ directory
- [ ] Debounce rapid changes
- [ ] Parse session.json on change
- [ ] Emit events to frontend

### 3.2 Session Store
- [ ] Create sessions Zustand store
- [ ] Subscribe to file watcher events
- [ ] Update state on session.json change
- [ ] Derive UI state (claims count, tensions, confidence)

### 3.3 Palette Components
- [ ] Create Palette.tsx (snappable)
- [ ] Files palette — show context files
- [ ] Sessions palette — show session list
- [ ] Snap-to-edge behavior
- [ ] Drag to undock

### 3.4 UI Updates
- [ ] Session window shows live confidence
- [ ] Tension badges update
- [ ] Status indicator (gathering/shaping/etc)
- [ ] Pass progress (optional)

**Deliverable**: UI reflects Claude Code activity in real-time

---

## Phase 4: Kanban Board
**Goal**: Visual workflow management

### 4.1 Board View
- [ ] Create KanbanBoard.tsx
- [ ] Columns: Inbox, Gathering, Shaping, Critiquing, Synthesized
- [ ] Render session cards from store

### 4.2 Session Cards
- [ ] Create SessionCard.tsx
- [ ] Show title, status, confidence
- [ ] Tension count badge
- [ ] Click to focus session

### 4.3 Drag & Drop
- [ ] Implement drag between columns
- [ ] On drop: update session status
- [ ] On drop: auto-run command (if forward movement)
- [ ] Visual feedback during drag

### 4.4 Card → Terminal Integration
- [ ] Click card → focus terminal
- [ ] Click card → load context files
- [ ] Drag card → send command

**Deliverable**: Full kanban workflow with Claude Code integration

---

## Phase 5: Polish & Scrap Bin
**Goal**: Complete the vision

### 5.1 Field Guide Viewer
- [ ] Create FieldGuide.tsx
- [ ] Warm paper background with ruled lines
- [ ] Margin notes display
- [ ] "Add to Session" action
- [ ] Double-click file → open viewer

### 5.2 Scrap Bin View
- [ ] Create ScrapBin.tsx
- [ ] Widget grid layout
- [ ] Placeholder widgets (RSS, bookmarks, etc.)
- [ ] Collage/staging area
- [ ] "Start Session" with collage items

### 5.3 View Switching
- [ ] Terminal / Board / Scrap navigation
- [ ] Keyboard shortcuts (⌘1, ⌘2, ⌘3)
- [ ] Smooth transitions

### 5.4 Settings & Preferences
- [ ] Remember palette positions
- [ ] Remember window positions
- [ ] Theme customization (future)

### 5.5 Packaging
- [ ] Build for macOS
- [ ] Build for Windows
- [ ] Build for Linux
- [ ] Auto-update setup (optional)

**Deliverable**: Shippable desktop app

---

## Future / Backlog

### MCP Integration
- [ ] Gmail MCP for newsletter widget
- [ ] Readwise MCP for highlights
- [ ] Twitter/X bookmarks widget

### Thesis Library
- [ ] Browse past theses
- [ ] Search by topic
- [ ] Link related theses
- [ ] Revision triggers dashboard

### Collaboration (way future)
- [ ] Share session state
- [ ] Real-time collaboration
- [ ] Comments on tensions

---

## Timeline Estimate

| Phase | Duration | Dependency |
|-------|----------|------------|
| Phase 1: Plugin MVP | 1-2 weeks | None |
| Phase 2: Tauri Shell | 2-3 weeks | Phase 1 |
| Phase 3: File Watching | 1-2 weeks | Phase 2 |
| Phase 4: Kanban | 1-2 weeks | Phase 3 |
| Phase 5: Polish | 2-3 weeks | Phase 4 |

**Total**: 7-12 weeks to shippable

**Shortcut**: Phase 1 alone is usable. You can use the plugin in vanilla Claude Code immediately while building the UI.

---

## Next Actions

1. **Today**: Test plugin structure loads in Claude Code
2. **This week**: Get `/harness` and `/session` commands working
3. **Next week**: Full plugin workflow end-to-end
4. **After**: Start Tauri shell

---

## Open Questions

- [ ] Claude Code plugin API stability — is the format finalized?
- [ ] Can plugins hook into `onResponse`? (need to verify)
- [ ] xterm.js + Tauri PTY — any gotchas?
- [ ] Plugin distribution — npm? Local install only?

---

## Success Criteria

**MVP**: Can run a multi-pass analysis with session persistence, resume later

**v1.0**: Desktop app where clicking a kanban card loads context and lets you continue thinking
