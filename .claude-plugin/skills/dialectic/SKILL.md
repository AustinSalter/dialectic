---
name: dialectic
description: Multi-pass strategic reasoning with expansion, compression, and critique cycles. Analyzes complex strategic questions through iterative exploration and structured synthesis. Use when facing ambiguous problems requiring deep analysis, thesis validation, or confidence-calibrated recommendations.
argument-hint: <thesis or question>
---

# N-Pass Strategic Reasoning

Iterative reasoning architecture that separates divergent exploration from convergent synthesis.

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  EXPANSION  │────▶│ COMPRESSION │────▶│   CRITIQUE  │
│  (diverge)  │     │  (converge) │     │  (decide)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
              [CONTINUE]                 [CONCLUDE]                  [PIVOT]
              loop back                  to synthesis              revise thesis
```

## Pass Selection

| Pass | When to Use | Output |
|------|-------------|--------|
| **Expansion** | Starting analysis or exploring new threads | Marked reasoning with `[INSIGHT]`, `[EVIDENCE]`, etc. |
| **Compression** | After expansion, to synthesize findings | Structured state (insights, tensions, threads, confidence) |
| **Critique** | After compression, to decide next action | Decision (CONTINUE/CONCLUDE/PIVOT) with reasoning |
| **Synthesis** | When concluding, to produce final output | Final thesis with confidence and key evidence |
| **Escape Hatch** | Max iterations reached with low confidence | Honest assessment of blockers and limitations |

## Working Memory Format

Passes receive working memory as context. Standard format:

```
## Working Memory (After Cycle N)

### Validated Insights
1. [claim] — Confidence: 0.XX

### Unresolved Tensions
- [description of conflicting evidence]

### Threads to Explore
- [topic]: [why it matters]

### Overall Confidence: 0.XX
```

## Pass Instructions

**Expansion**: See [EXPANSION.md](EXPANSION.md)
**Compression**: See [COMPRESSION.md](COMPRESSION.md)
**Critique**: See [CRITIQUE.md](CRITIQUE.md) — includes 6 questioning techniques, problem-type routing, 3D confidence
**Synthesis**: See [SYNTHESIS.md](SYNTHESIS.md)
**Escape Hatch**: See [ESCAPE-HATCH.md](ESCAPE-HATCH.md)

## Semantic Markers

All passes use consistent semantic markers. See [MARKERS.md](MARKERS.md) for definitions and usage.

## 3D Confidence Model

Single scalar confidence conflates reasoning quality, evidence quality, and conclusion certainty. Use three independent dimensions:

- **R (Reasoning)**: Is the logic sound? (0.0-1.0)
- **E (Evidence)**: Is evidence complete? (0.0-1.0)
- **C (Conclusion)**: How certain given R and E? (0.0-1.0)

**Composite**: `(R + E + C) / 3` — NOT multiplicative.

See [COMPRESSION.md](COMPRESSION.md) and [CRITIQUE.md](CRITIQUE.md) for details.

## Termination Conditions

Analysis terminates when any of:
1. **Conclusion**: Critique decides thesis is robust (CONCLUDE)
2. **Saturation**: Confidence delta < 0.05 for 2 consecutive cycles
3. **High confidence**: Score ≥ 0.75 with < 2 unresolved questions
4. **Max cycles**: Hard limit reached (triggers escape hatch if confidence < 0.5)

## Quick Start

For a new strategic question:

1. Run **Expansion** pass with the question and empty working memory
2. Run **Compression** pass on the expansion output
3. Run **Critique** pass to decide: CONTINUE, CONCLUDE, or PIVOT
4. If CONTINUE: loop back to step 1 with updated working memory
5. If CONCLUDE: run **Synthesis** pass
6. If PIVOT: revise thesis and loop back to step 1
