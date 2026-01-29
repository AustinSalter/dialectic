# Dialectic

**A workbench for high-stakes thinking.**

Dialectic is a desktop application that provides a focused UI for strategic reasoning — powered by Claude Code under the hood, with a methodology codified as skills and hooks.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DIALECTIC DESKTOP (Tauri + React)                              │
├─────────────────────────────────────────────────────────────────┤
│  Vista UI — landscape backgrounds, calm space                   │
│  Floating Windows — session conversations with embedded terminal│
│  Kanban Board — workflow visualization (Spark → Ship)           │
│  Snappable Rails — files, sessions, notes                       │
├─────────────────────────────────────────────────────────────────┤
│  Embedded Terminal (xterm.js + portable-pty)                    │
│  └── Claude Code (user's own installation)                      │
│      └── dialectic-plugin (skills + hooks + CLI)                │
└─────────────────────────────────────────────────────────────────┘
```

**You bring:** Claude Code (with your own API key or Max subscription)
**We provide:** The thinking methodology, the UI, the workflow

## The Plugin System

Dialectic's reasoning methodology is packaged as a Claude Code plugin with three components:

### 1. Skills

| Skill | Purpose |
|-------|---------|
| `/dialectic <question>` | Multi-pass reasoning with expansion, compression, critique cycles |
| `/brief resume <id>` | Resume session, inject context scratchpad |
| `/brief budget` | Show token budget status |
| `/brief compact` | Trigger context compression |
| `/brief vault <query>` | Search Obsidian vault |

### 2. Hooks

| Hook | Purpose |
|------|---------|
| `pre-submit` | Injects budget status at start of every turn |
| `stop` | Manages dialectic loop continuation/termination |

### 3. CLI (`dialectic`)

A Rust CLI binary that skills and hooks shell out to:

```bash
dialectic session budget <id>     # Get budget status (JSON)
dialectic session resume <id>     # Get resume context (JSON)
dialectic vault search "<query>"  # Search Obsidian vault
dialectic tokens count "<text>"   # Count tokens
dialectic compress suggest <id>   # Get compression suggestions
```

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/claude-code) installed
- Node.js 20+ and Rust (for development)

### Install

```bash
# Clone
git clone https://github.com/AustinSalter/dialectic.git
cd dialectic

# Install dependencies
npm install

# Build the CLI
cd packages/desktop/src-tauri
cargo build --release --bin dialectic

# Add CLI to path (or copy to /usr/local/bin)
export PATH="$PATH:$(pwd)/target/release"
```

### Run

```bash
# Development mode
npm run tauri dev

# Or build for release
npm run tauri build
```

### Install the Plugin

The dialectic-plugin provides skills and hooks for Claude Code:

```bash
# Option 1: Symlink to Claude Code plugins directory
ln -s $(pwd)/.claude-plugin ~/.claude/plugins/dialectic

# Option 2: Copy to plugins directory
cp -r .claude-plugin ~/.claude/plugins/dialectic
```

See the [dialectic-plugin repository](https://github.com/AustinSalter/dialectic-plugin) for standalone installation.

## Context Management

Dialectic manages context across sessions with a tiered paper trail system:

```
PAPER TRAIL TIERS
────────────────────────────────────────────────────────────────

  TIER 1: HEAD                          ~500 tokens
  Core thesis, confidence, triggers.    Always loaded.

  TIER 2: KEY_EVIDENCE                  ~1,500 tokens
  Verbatim claims marked [KEY].         Always loaded.

  TIER 3: RECENT                        ~3,000 tokens
  Last 2-3 session traces.              Compress after 7 days.

  TIER 4: HISTORICAL                    ~1,000 tokens
  Older compressed summaries.           Compress after 30 days.

  TIER 5: ARCHIVED                      0 tokens
  Full logs on disk.                    Searchable only.
```

### Budget Thresholds

| Usage | Status | Action |
|-------|--------|--------|
| < 70% | Normal | Continue normally |
| 70-84% | Auto Compress | Tier 4 auto-compressed |
| 85-94% | Warn User | Alert shown in pre-submit hook |
| 95%+ | Force Compress | Mandatory compression triggered |

The pre-submit hook shows budget at the start of every turn:
```
✓ BUDGET: 62% (44,640/72,000 tokens) [normal]
⚠️ BUDGET: 87% (62,640/72,000 tokens) [warn_user]
```

## Multi-Pass Reasoning

The `/dialectic` skill implements iterative reasoning:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  EXPANSION  │────▶│ COMPRESSION │────▶│   CRITIQUE  │
│  (diverge)  │     │  (converge) │     │  (decide)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────┐
                    ▼                          ▼      ▼
              [CONTINUE]                 [CONCLUDE] [PIVOT]
              loop back                  synthesis  reframe
```

### Critique Techniques

1. **Inversion**: What if the opposite were true?
2. **Second-Order**: What are downstream effects?
3. **Falsification**: What evidence would disprove this?
4. **Base Rates**: What do historical priors suggest?
5. **Incentive Audit**: Who benefits from this being believed?
6. **Adversary Simulation**: How would a smart skeptic attack?

## Project Structure

```
dialectic/
├── packages/desktop/
│   ├── src/                    # React frontend
│   │   ├── components/         # UI components
│   │   │   ├── Terminal/       # xterm.js integration
│   │   │   ├── Board/          # Kanban board
│   │   │   └── Window/         # Floating windows
│   │   └── hooks/
│   │       ├── useTerminal.ts  # PTY management
│   │       └── useBudgetMonitor.ts  # Budget alerts
│   │
│   └── src-tauri/
│       ├── src/
│       │   ├── main.rs         # Tauri entry
│       │   ├── terminal.rs     # PTY management
│       │   ├── session.rs      # Session persistence
│       │   ├── watcher.rs      # File watching + budget alerts
│       │   ├── context/        # Token budget management
│       │   ├── obsidian/       # Vault integration
│       │   └── bin/
│       │       └── dialectic.rs  # CLI binary
│       └── Cargo.toml
│
├── .claude-plugin/             # Claude Code plugin
│   ├── plugin.json             # Plugin manifest
│   ├── commands/
│   │   ├── dialectic.md        # /dialectic skill
│   │   ├── brief.md            # /brief skill
│   │   └── cancel-dialectic.md
│   └── hooks/
│       ├── pre-submit-hook.sh  # Budget injection
│       └── stop-hook.sh        # Loop management
│
├── .claude/skills/             # Skill implementations
│   ├── dialectic/              # Multi-pass reasoning
│   │   ├── SKILL.md
│   │   ├── EXPANSION.md
│   │   ├── COMPRESSION.md
│   │   ├── CRITIQUE.md
│   │   └── SYNTHESIS.md
│   └── brief/                  # Context management
│       ├── SKILL.md
│       └── SCRATCHPAD.md
│
└── docs/
    └── overhaul/
        ├── design-doc-backend-context.md  # Full architecture
        ├── CONTEXT_MANAGEMENT.md          # Session resume
        └── ARCHITECTURE.md                # Desktop architecture
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/overhaul/ARCHITECTURE.md) | Desktop app architecture, terminal integration |
| [Context Management](./docs/overhaul/design-doc-backend-context.md) | Token budgets, paper trail tiers, CLI interface |
| [Session Resume](./docs/overhaul/CONTEXT_MANAGEMENT.md) | Scratchpad format, skill-based loading |

## Philosophy

**Copilot, not Agent.** Dialectic augments your judgment. It surfaces what you might miss, challenges what you assume, structures what you conclude. It does not decide for you.

**Tension is Signal.** Unresolved contradictions aren't failures. They're the interesting parts. The system preserves them rather than papering over them.

**The Obvious Decisions Don't Need This.** Use Dialectic for decisions where the frame itself might be wrong — where you need to be argued with, not agreed with.

## Related Repositories

- [dialectic-plugin](https://github.com/AustinSalter/dialectic-plugin) — Standalone Claude Code plugin (skills + hooks)

## License

MIT
