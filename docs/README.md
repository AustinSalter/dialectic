# Dialectic Documentation

## Current Documentation

The primary documentation lives in the `overhaul/` directory:

| Document | Description |
|----------|-------------|
| [Architecture](./overhaul/ARCHITECTURE.md) | Desktop app architecture, terminal integration, project structure |
| [Backend & Context](./overhaul/design-doc-backend-context.md) | Rust backend, token budgets, paper trail tiers, CLI interface |
| [Session Resume](./overhaul/CONTEXT_MANAGEMENT.md) | Scratchpad format, skill-based context loading |
| [Skill Definition](./overhaul/SKILL.md) | Multi-pass reasoning skill specification |

## Quick Reference

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DIALECTIC DESKTOP (Tauri + React)                              │
├─────────────────────────────────────────────────────────────────┤
│  Vista UI — Floating Windows — Kanban Board — Rails             │
├─────────────────────────────────────────────────────────────────┤
│  Embedded Terminal (xterm.js + portable-pty)                    │
│  └── Claude Code                                                │
│      └── dialectic-plugin (skills + hooks + CLI)                │
└─────────────────────────────────────────────────────────────────┘
```

### Plugin Components

| Component | Purpose |
|-----------|---------|
| `/dialectic` skill | Multi-pass reasoning (expand/compress/critique) |
| `/brief` skill | Context management (resume/budget/compact/vault) |
| `pre-submit` hook | Budget status injection every turn |
| `stop` hook | Dialectic loop management |
| `dialectic` CLI | JSON backend for skills and hooks |

### Key Files

```
.claude-plugin/           # Claude Code plugin
├── plugin.json           # Manifest
├── commands/             # Skill definitions
│   ├── dialectic.md
│   └── brief.md
└── hooks/
    ├── pre-submit-hook.sh
    └── stop-hook.sh

.claude/skills/           # Skill implementations
├── dialectic/            # Multi-pass reasoning
└── brief/                # Context management

packages/desktop/src-tauri/
├── src/bin/dialectic.rs  # CLI binary
├── src/context/          # Token budget management
└── src/obsidian/         # Vault integration
```

## Legacy Documentation

The following documents describe earlier versions of the architecture:

| Document | Description |
|----------|-------------|
| [DIALECTIC.md](./DIALECTIC.md) | V3 dual-mode architecture (deprecated) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design with Python backend (deprecated) |
| [EXPERIMENTS.md](./EXPERIMENTS.md) | Validation experiments (still relevant) |

Note: The Python backend (`harness_lite.py`, `harness.py`, etc.) has been removed. The current architecture uses Claude Code with skills and hooks.

See the [root README](../README.md) for installation and quick start.
