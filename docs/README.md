# Dialectic Documentation

## Architecture Overview

Dialectic is a desktop app for high-stakes thinking, powered by Claude Code with custom skills.

```
┌─────────────────────────────────────────────────────────────────┐
│  DIALECTIC DESKTOP (Tauri + React)                              │
├─────────────────────────────────────────────────────────────────┤
│  Vista UI — Floating Windows — Kanban Board — Rails             │
├─────────────────────────────────────────────────────────────────┤
│  Embedded Terminal (xterm.js + portable-pty)                    │
│  └── Claude Code                                                │
│      └── dialectic-plugin (skills + hooks)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Skills

Skills are the core methodology, defined in `.claude-plugin/skills/`. Each skill file contains the full specification.

### Workflow Skills (Kanban Stages)

| Skill | File | Purpose |
|-------|------|---------|
| `/spark` | [spark/SKILL.md](../.claude-plugin/skills/spark/SKILL.md) | Brainstorm, gather sources, establish framing |
| `/shape` | [shape/SKILL.md](../.claude-plugin/skills/shape/SKILL.md) | Form positions on claims through probing |
| `/stress-test` | [stress-test/SKILL.md](../.claude-plugin/skills/stress-test/SKILL.md) | Challenge assumptions, surface contradictions |
| `/sharpen` | [sharpen/SKILL.md](../.claude-plugin/skills/sharpen/SKILL.md) | Crystallize thesis with confidence calibration |

### Reasoning Skills

| Skill | File | Purpose |
|-------|------|---------|
| `/dialectic` | [dialectic/SKILL.md](../.claude-plugin/skills/dialectic/SKILL.md) | Multi-pass reasoning (expand/compress/critique) |
| `/pitfalls` | [pitfalls/SKILL.md](../.claude-plugin/skills/pitfalls/SKILL.md) | Cognitive bias detection and audit |

### Context Management

| Skill | File | Purpose |
|-------|------|---------|
| `/brief` | [brief/SKILL.md](../.claude-plugin/skills/brief/SKILL.md) | Session resume, budget, compression, vault search |

## Experiments

See [EXPERIMENTS.md](./EXPERIMENTS.md) for validation experiments that informed the architecture:

- Multi-pass enables meta-level thinking (25% different conclusions)
- Structured critique finds 9x more flaws than naive
- Two-pass compression is 6x more efficient
- Semantic markers extract 3x more insights per token

## Philosophy

**Copilot, not Agent.** Augments human judgment rather than replacing it.

**Tension is Signal.** Contradictions are preserved, not papered over.

**The Obvious Decisions Don't Need This.** Use for decisions where the frame itself might be wrong.

## See Also

- [Root README](../README.md) - Installation, quick start, project structure
- [Plugin Manifest](../.claude-plugin/plugin.json) - Registered skills and hooks
