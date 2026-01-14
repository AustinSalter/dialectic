# Dialectic: Multi-Pass Reasoning for Strategy

**Version**: 2.1
**Status**: Core hypotheses validated

---

## Executive Summary

Dialectic is **Claude Code for strategists**. The same agentic power that transforms software engineering workflows, applied to high-stakes decision-making.

**Core Thesis**: Strategy isn't prediction—it's structured navigation through uncertainty. LLMs fail at strategy because they optimize for answers when strategists need frameworks for thinking.

**The Breakthrough**: Multi-pass reasoning enables meta-level thinking that single-pass generation cannot access. Our experiments show 25% of decisions reached different conclusions with multi-pass. When tested head-to-head against multi-agent orchestration on HBR cases, multi-pass achieved **75% correct conclusions vs 50%**—finding frame-level insights that multi-agent missed entirely.

---

## The Problem

Current AI tools fail strategists in predictable ways:

| What AI Does | What Strategists Need |
|--------------|----------------------|
| Retrieves similar content | Navigates causal relationships |
| Provides point estimates | Maps distributions of outcomes |
| Answers questions | Challenges assumptions |
| Single-pass response | Iterative refinement |
| Forgets everything | Compounds learning over time |

## The Solution

A **strategy copilot** that:

1. **Thinks in passes** — Separates exploration from synthesis
2. **Holds beliefs** — Manages theses that update with evidence
3. **Preserves memory** — Never loses critical evidence
4. **Challenges itself** — Structured self-critique with adversarial techniques
5. **Knows when to stop** — Dynamic termination based on insight saturation

---

## Validated Findings

### Finding 1: Multi-Pass Enables Meta-Level Thinking

**Evidence**: In our validation experiments:
- Multi-pass reached **different conclusions** in 25% of cases
- Example: VC portfolio problem—single-pass picked "safe" Company A, multi-pass picked contrarian Company C by elevating to "fund returner" portfolio-level reasoning

**Mechanism**: Iteration enables higher-order thinking:

| Problem | Single-Pass Level | Multi-Pass Level |
|---------|------------------|------------------|
| Portfolio | Company comparison | Fund portfolio construction |
| Thesis update | Data interpretation | Thesis methodology critique |
| Competitive | Tactical response | Industry evolution dynamics |
| TAM | Data presentation | Board decision process design |

**When to use**: High-stakes decisions with long feedback loops, contrarian positions that need justification, complex problems with second-order effects.

---

### Finding 2: Two-Pass Compression is 6x More Efficient

**Evidence**:
- Two-pass achieved **83% insight coverage at 300 tokens**
- Verbose single-pass achieved 83% at 1800 tokens
- That's **6x more efficient**

**Mechanism**: Expansion → Compression separates concerns:
- **Pass 1 (Expansion)**: Divergent exploration with semantic markers `[INSIGHT]`, `[EVIDENCE]`, `[RISK]`, `[COUNTER]`
- **Pass 2 (Compression)**: Convergent synthesis preserving decision-relevant content

---

### Finding 3: Accumulated Context Beats Partitioned

**Evidence**: Testing three context strategies:
- **Accumulated**: ~90% frame-level insights preserved
- **Partitioned**: ~60% frame-level insights (lost cross-domain connections)
- **Fresh each pass**: ~40% (no compounding)

**Implication**: Context must compound within session. The magic happens when Pass 3 can reference insights from Pass 1.

---

### Finding 4: Structured Critique Finds 9x More Flaws

**Evidence**: Comparing critique approaches:
- Naive ("now critique this"): ~2 flaws found
- Structured (6 techniques): ~18 flaws found
- External adversary: ~15 flaws found

**The Six Questioning Techniques**:
1. **Inversion**: What if the opposite were true?
2. **Second-Order**: What are the downstream effects?
3. **Falsification**: What evidence would disprove this?
4. **Base Rates**: What do historical priors suggest?
5. **Incentive Audit**: Who benefits from this being believed?
6. **Adversary Simulation**: How would a smart skeptic attack this?

---

## Architecture

### Multi-Pass Harness

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MULTI-PASS HARNESS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Source Material                                                   │
│        ↓                                                            │
│   ┌─────────────────┐                                               │
│   │    EXPANSION    │  ← Divergent exploration                      │
│   │    (Pass 1)     │    Semantic markers: [INSIGHT] [EVIDENCE]     │
│   └────────┬────────┘    [RISK] [COUNTER] [PATTERN]                 │
│            ↓                                                        │
│   ┌─────────────────┐                                               │
│   │   COMPRESSION   │  ← Convergent synthesis                       │
│   │    (Pass 2)     │    Preserve decision-relevant content         │
│   └────────┬────────┘                                               │
│            ↓                                                        │
│   ┌─────────────────┐                                               │
│   │    CRITIQUE     │  ← 6 questioning techniques                   │
│   │    (Pass 3)     │    Adversarial self-examination               │
│   └────────┬────────┘                                               │
│            ↓                                                        │
│   ┌─────────────────┐                                               │
│   │   SYNTHESIS     │  ← Final thesis formation                     │
│   │    (Pass 4)     │    Confidence calibration                     │
│   └────────┬────────┘                                               │
│            ↓                                                        │
│   Thesis Document                                                   │
│   • Core belief                                                     │
│   • Supporting evidence                                             │
│   • Triggers to monitor                                             │
│   • Confidence score                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Termination Criteria

The harness stops when:
- **Saturation**: Confidence delta < 0.05 for 2 consecutive cycles
- **Threshold**: Confidence ≥ 0.75 with tensions resolved
- **Max cycles**: Hard limit (typically 5)

---

## Who This Is For

| Persona | Pain Points | Value Proposition |
|---------|-------------|-------------------|
| **Investment Analyst** | Thesis development is ad-hoc, patterns depend on memory | Persistent beliefs, evidence tracking |
| **Strategy Consultant** | Each engagement starts from scratch | Pattern library, session persistence |
| **Corporate Strategist** | Board materials are painful, no systematic learning | Deliverable generation, outcome tracking |
| **Founder/Operator** | Can't afford dedicated strategy staff | Affordable structured thinking |

---

## Philosophy

**Copilot, not Agent.** The system augments human judgment rather than replacing it. Strategic decisions operate in domains of irreducible uncertainty—the model cannot absorb accountability for outcomes it cannot fully predict.

**Prioritize over Predict.** In low-feedback, high-variance markets, the right question isn't "what will happen?" but "what should we do first given constraints?"

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this architecture earns its keep.
