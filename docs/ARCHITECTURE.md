# Architecture

## Dialectic: A Workbench for High-Stakes Thinking

This document describes the system architecture for strategic reasoning.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DIALECTIC                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   KANBAN WORKFLOW                           REASONING ENGINE                     │
│   (Collaborative)                           (Multi-Pass)                         │
│   ───────────────                           ─────────────                        │
│                                                                                  │
│   ┌─────────┐                               ┌──────────────────┐                 │
│   │  SPARK  │ ← Brainstorm, gather sources  │    /dialectic    │                 │
│   └────┬────┘                               │  Expansion →     │                 │
│        ↓                                    │  Compression →   │                 │
│   ┌─────────┐                               │  Critique →      │                 │
│   │  SHAPE  │ ← Form positions on claims    │  Synthesis       │                 │
│   └────┬────┘                               └──────────────────┘                 │
│        ↓                                             ↑                           │
│   ┌───────────┐                                      │                           │
│   │STRESS-TEST│ ← Challenge assumptions      Invoke on demand                    │
│   └────┬──────┘                                      │                           │
│        ↓                                             │                           │
│   ┌──────────┐                                       │                           │
│   │ SHARPEN  │ ← Crystallize thesis ─────────────────┘                           │
│   └────┬─────┘                                                                   │
│        ↓                                                                         │
│   ThesisDocument                                                                 │
│   • confidence                                                                   │
│   • triggers                                                                     │
│   • key evidence                                                                 │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          QUALITY ASSURANCE (/pitfalls)                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                          │   │
│   │   Detects: Confirmation bias │ Narrative fallacy │ Recency bias         │   │
│   │            Illusion of depth │ Synonym drift │ Density collapse         │   │
│   │            Fluency overconfidence                                        │   │
│   │                                                                          │   │
│   │   If HIGH risk → triggers refinement or additional exploration          │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Kanban Workflow

The collaborative workflow moves through stages, each with a dedicated skill:

| Stage | Skill | Purpose | Tools |
|-------|-------|---------|-------|
| **Spark** | `/spark` | Brainstorm, gather sources, establish framing | WebSearch, WebFetch, AskUserQuestion |
| **Shape** | `/shape` | Form positions on claims through probing | AskUserQuestion, Read, Grep |
| **Stress-Test** | `/stress-test` | Challenge assumptions, surface contradictions | WebSearch, AskUserQuestion, Read |
| **Sharpen** | `/sharpen` | Crystallize thesis with confidence calibration | AskUserQuestion, Write, Read |

Each stage is **collaborative**—the user and Claude work together through structured questions and exploration.

---

## Multi-Pass Reasoning Engine

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

### Semantic Markers

| Marker | Purpose | Extraction Priority |
|--------|---------|---------------------|
| `[INSIGHT]` | Non-obvious conclusions | High |
| `[EVIDENCE]` | Supporting data points | High |
| `[RISK]` | Potential failure modes | High |
| `[COUNTER]` | Arguments against | Critical |
| `[PATTERN]` | Recurring structures | Medium |
| `[DECISION]` | Action recommendations | High |

### Structured Critique

Six questioning techniques (validated to find 9x more flaws than naive critique):

1. **Inversion**: What if the opposite were true?
2. **Second-Order**: What are the downstream effects?
3. **Falsification**: What evidence would disprove this?
4. **Base Rates**: What do historical priors suggest?
5. **Incentive Audit**: Who benefits from this being believed?
6. **Adversary Simulation**: How would a smart skeptic attack this?

### Termination Criteria

| Strategy | Condition | Rationale |
|----------|-----------|-----------|
| Saturation | Δconfidence < 0.05 for 2 cycles | No new signal |
| Threshold | confidence ≥ 0.75 + tensions resolved | Good enough |
| Max cycles | Hard limit (default: 5) | Cost control |

---

## Desktop Architecture

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
│      └── dialectic-plugin (skills + hooks)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend (React)

| Component | Purpose |
|-----------|---------|
| `FloatingWindow` | Draggable session windows with embedded terminal |
| `BoardView` | Kanban board with workflow columns |
| `XTerminal` | xterm.js terminal with PTY connection |
| `GlobalInputBar` | Quick session creation |

### Backend (Tauri/Rust)

| Module | Purpose |
|--------|---------|
| `terminal.rs` | PTY management for embedded Claude Code |
| `session.rs` | Session state persistence |
| `watcher.rs` | File watching for budget alerts |
| `context/` | Token budget management |
| `obsidian/` | Vault integration |

---

## Plugin Architecture

The dialectic-plugin provides skills and hooks for Claude Code:

```
.claude-plugin/
├── plugin.json           # Manifest (skills, hooks)
├── skills/
│   ├── dialectic/        # Multi-pass reasoning
│   │   ├── SKILL.md
│   │   ├── EXPANSION.md
│   │   ├── COMPRESSION.md
│   │   ├── CRITIQUE.md
│   │   └── SYNTHESIS.md
│   ├── spark/            # Workflow: ideation
│   ├── shape/            # Workflow: position-forming
│   ├── stress-test/      # Workflow: adversarial critique
│   ├── sharpen/          # Workflow: thesis crystallization
│   ├── pitfalls/         # Cognitive bias detection
│   └── brief/            # Context management
└── hooks/
    ├── pre-submit-hook.sh  # Budget injection
    └── stop-hook.sh        # Loop management
```

---

## Philosophy

**Copilot, not Agent.** The system augments human judgment rather than replacing it.

**Prioritize over Predict.** The right question isn't "what will happen?" but "what should we do first given constraints?"

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this architecture earns its keep.
