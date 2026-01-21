# Dialectic Documentation

This folder contains the core documentation for Dialectic.

## Contents

| Document | Description |
|----------|-------------|
| [DIALECTIC.md](./DIALECTIC.md) | Core concepts, V3 dual-mode architecture, token budget, session segments |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data flow, backend/frontend architecture, roadmap |
| [EXPERIMENTS.md](./EXPERIMENTS.md) | Validation experiments and findings (EXP-004 through EXP-019) |

## Quick Reference

**Two Modes:**
- **Decision Mode** — Bounded analysis (~10 min), uses `harness_lite.py`
- **Ideas Mode** — Extended research (hours to days), uses SDK with session continuity

**Key Findings:**
- 25% different conclusions with multi-pass vs single-pass
- 75% vs 50% correct on HBR cases (multi-pass vs multi-agent)
- 9x more flaws found with structured critique
- 6x compression efficiency with two-pass

See the [root README](../README.md) for quick start instructions.
