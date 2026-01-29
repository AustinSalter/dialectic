# Dialectic: Multi-Pass Reasoning for Strategy

**Version**: 4.0
**Status**: Skill-based architecture

---

## Executive Summary

Dialectic is **Claude Code for strategists**. The same agentic power that transforms software engineering workflows, applied to high-stakes decision-making.

**Core Thesis**: Strategy isn't prediction—it's structured navigation through uncertainty. LLMs fail at strategy because they optimize for answers when strategists need frameworks for thinking.

**The Breakthrough**: Multi-pass reasoning enables meta-level thinking that single-pass generation cannot access. Our experiments show:
- **25%** of decisions reached different conclusions with multi-pass
- **75%** correct on HBR cases vs 50% multi-agent
- **9x** more flaws found with structured critique

**V4 Architecture**: Skill-based methodology with collaborative Kanban workflow and on-demand multi-pass reasoning.

---

## Two Modes: Collaborative vs Deep Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DIALECTIC V4                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   KANBAN WORKFLOW                          DEEP ANALYSIS                    │
│   (Collaborative)                          (Multi-Pass)                     │
│   ───────────────                          ─────────────                    │
│                                                                             │
│   /spark → /shape → /stress-test           /dialectic <question>            │
│   → /sharpen                               2-5 cycles of:                   │
│                                            Expansion → Compression →        │
│   User-driven exploration                  Critique → (loop or conclude)    │
│   with structured questions                                                 │
│                                            Autonomous deep reasoning        │
│   Hours to days                            ~10-15 minutes                   │
│                                                                             │
│   Output: Evolved understanding            Output: Synthesis with           │
│   through dialogue                         confidence + evidence            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Kanban Workflow (Collaborative)

**Purpose**: Extended research and thesis development through dialogue
**Duration**: Hours to days across sessions
**Driver**: User questions, with Claude as thinking partner

| Stage | Skill | What Happens |
|-------|-------|--------------|
| **Spark** | `/spark` | Brainstorm angles, gather sources, establish framing |
| **Shape** | `/shape` | Take positions on claims through structured probing |
| **Stress-Test** | `/stress-test` | Challenge assumptions, surface contradictions |
| **Sharpen** | `/sharpen` | Crystallize thesis with confidence calibration |

### Deep Analysis (Multi-Pass)

**Purpose**: Autonomous deep analysis on bounded problems
**Duration**: ~10-15 minutes
**Driver**: Iterative self-critique with termination conditions

The `/dialectic` skill runs expansion → compression → critique cycles until reaching confidence thresholds or saturation.

---

## Validated Findings

### Finding 1: Multi-Pass Enables Meta-Level Thinking

**Evidence**: 25% of cases reached different conclusions. Multi-pass elevated to higher abstraction:

| Problem | Single-Pass Level | Multi-Pass Level |
|---------|------------------|------------------|
| Portfolio | Company comparison | Fund portfolio construction |
| Netflix | DVD business optimization | Platform transition strategy |
| Kodak | Camera development | Ecosystem ownership |

### Finding 2: Context Accumulation Matters

**Evidence**: Comparing fresh context vs accumulated session context:

| Metric | Fresh Context | Accumulated |
|--------|---------------|-------------|
| Synthesis length | ~6k chars | ~14k chars |
| Quality markers | 4/4 | 4/4 |

**Key insight**: Richer output comes from context accumulation (priming + steering), not just model choice.

### Finding 3: Two-Pass Compression is 6x Efficient

- Two-pass: **83% insight coverage at 300 tokens**
- Verbose single-pass: 83% at 1800 tokens

### Finding 4: Structured Critique Finds 9x More Flaws

| Condition | Flaws Found |
|-----------|-------------|
| Naive ("critique this") | ~2 |
| **Structured** (6 techniques) | **~18** |

---

## The Multi-Pass Engine

### Semantic Markers

| Marker | Purpose |
|--------|---------|
| `[INSIGHT]` | Non-obvious conclusions |
| `[EVIDENCE]` | Supporting data points |
| `[RISK]` | Potential failure modes |
| `[COUNTER]` | Arguments against |
| `[PATTERN]` | Recurring structures |

### Six Questioning Techniques

1. **Inversion**: What if the opposite were true?
2. **Second-Order**: What are the downstream effects?
3. **Falsification**: What evidence would disprove this?
4. **Base Rates**: What do historical priors suggest?
5. **Incentive Audit**: Who benefits from this being believed?
6. **Adversary Simulation**: How would a smart skeptic attack?

### Termination Criteria

| Condition | Trigger |
|-----------|---------|
| Saturation | Confidence delta < 0.05 for 2 cycles |
| Threshold | Confidence >= 0.75 with tensions resolved |
| Max cycles | Hard limit (default: 5) |

---

## 3D Confidence Model

Single scalar confidence conflates reasoning quality, evidence quality, and conclusion certainty. Use three independent dimensions:

- **R (Reasoning)**: Is the logic sound? (0.0-1.0)
- **E (Evidence)**: Is evidence complete? (0.0-1.0)
- **C (Conclusion)**: How certain given R and E? (0.0-1.0)

**Composite**: `(R + E + C) / 3` — NOT multiplicative.

Example: Strong logic (R=0.9) + weak evidence (E=0.4) + uncertain conclusion (C=0.5) = 0.6 composite, clearly signaling where improvement is needed.

---

## Quality Assurance: Cognitive Pitfalls

The `/pitfalls` skill detects reasoning degradation:

| Pitfall | Detection | Counter |
|---------|-----------|---------|
| Confirmation bias | All evidence points one way | Adversarial critique must be genuine |
| Narrative fallacy | Explanation too clean | Uncertainty structural, not cosmetic |
| Recency bias | Recent data dominates | Key evidence protected from crowding |
| Illusion of depth | Satisfying but shallow | Force uncertainty before conclusion |
| Synonym drift | Terms shift meaning | Semantic markers lock terminology |
| Density collapse | Insights buried in bloat | Compression with ruthlessness |
| Fluency overconfidence | Monotonic confidence | Non-monotonic trajectory required |

---

## Who This Is For

| Persona | Pain Points | Value |
|---------|-------------|-------|
| **Investment Analyst** | Ad-hoc thesis development | Persistent beliefs, evidence tracking |
| **Strategy Consultant** | Starting from scratch each engagement | Pattern library, session persistence |
| **Corporate Strategist** | Board materials, no systematic learning | Deliverable generation, outcome tracking |
| **Founder/Operator** | Can't afford dedicated strategy staff | Affordable structured thinking |

---

## Philosophy

**Copilot, not Agent.** The system augments human judgment rather than replacing it. Strategic decisions operate in domains of irreducible uncertainty—the model cannot absorb accountability for outcomes it cannot fully predict.

**Prioritize over Predict.** In low-feedback, high-variance markets, the right question isn't "what will happen?" but "what should we do first given constraints?"

**Tension is Signal.** Unresolved contradictions aren't failures. They're the interesting parts. The system preserves them rather than papering over them.

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this architecture earns its keep.
