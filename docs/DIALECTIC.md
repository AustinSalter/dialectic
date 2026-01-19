# Dialectic: Multi-Pass Reasoning for Strategy

**Version**: 3.0
**Status**: SDK architecture validated

---

## Executive Summary

Dialectic is **Claude Code for strategists**. The same agentic power that transforms software engineering workflows, applied to high-stakes decision-making.

**Core Thesis**: Strategy isn't prediction—it's structured navigation through uncertainty. LLMs fail at strategy because they optimize for answers when strategists need frameworks for thinking.

**The Breakthrough**: Multi-pass reasoning enables meta-level thinking that single-pass generation cannot access. Our experiments show:
- **25%** of decisions reached different conclusions with multi-pass
- **80%** correct on HBR cases vs 70% single-pass
- **9x** more flaws found with structured critique

**V3 Evolution**: SDK-powered architecture with two distinct modes, session continuity, and harness_lite as invokable deep-thinking tool.

---

## Two Modes: Decision vs Ideas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DIALECTIC V3                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DECISION MODE                              IDEAS MODE                     │
│   (Bounded Analysis)                         (Extended Research)            │
│   ─────────────────                          ──────────────────             │
│                                                                             │
│   User submits problem                       Multi-day thesis development   │
│   + evidence (files, URLs, quotes)           + Session continuity           │
│        ↓                                            ↓                       │
│   ┌───────────────┐                         ┌───────────────┐              │
│   │  /deep-think  │ ← harness_lite          │   SDK Agent   │              │
│   │  (2-5 cycles) │   as tool               │   + Tools     │              │
│   └───────┬───────┘                         └───────┬───────┘              │
│           ↓                                         ↓                       │
│   Recommendation                            ┌───────────────┐              │
│   + Evidence Trail                          │  /deep-think  │ ← On demand  │
│   (~10 min)                                 │  when needed  │              │
│                                             └───────┬───────┘              │
│                                                     ↓                       │
│                                             Thesis Updates                  │
│                                             Session Continuity              │
│                                                                             │
│   [Shift+Tab] ←────────── MODE TOGGLE ───────────→ [Shift+Tab]             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision Mode

**Purpose**: Deep analysis on bounded problems
**Duration**: ~10 minutes
**Context Strategy**: Fresh per request, no session accumulation

| Aspect | Specification |
|--------|---------------|
| Trigger | User submits problem + evidence |
| Engine | harness_lite directly |
| Cycles | 2-5 based on complexity |
| Tools | Pre-gathered evidence only |
| Output | Synthesis with conviction markers |
| Memory | Thesis saved, session discarded |

### Ideas Mode

**Purpose**: Extended research and thesis development
**Duration**: Hours to days across sessions
**Context Strategy**: SDK session resume with compaction

| Aspect | Specification |
|--------|---------------|
| Trigger | User exploring or stress-testing |
| Engine | SDK with tool access |
| Tools | Web search, file search, user questions |
| /deep-think | Available on demand |
| Memory | Full session history with compaction |
| Output | Evolving thesis documents |

---

## Token Budget: Context Management

Context is valuable but finite. Three sources compete for the window:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              INJECTION CONTEXT AT SEGMENT START (~20K max)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────┐                                           │
│   │  THESIS DOCUMENT (50%)      │  ← Always included, full document         │
│   │  ~10K tokens max            │    The living strategic artifact          │
│   └─────────────────────────────┘                                           │
│                                                                             │
│   ┌─────────────────────────────┐                                           │
│   │  LAST SESSION SUMMARY (30%) │  ← Structured compression of prior        │
│   │  ~6K tokens max             │    segment (arc, decisions, tensions)     │
│   └─────────────────────────────┘                                           │
│                                                                             │
│   ┌─────────────────────────────┐                                           │
│   │  RELEVANT CLAIMS (20%)      │  ← Semantic retrieval from memory         │
│   │  ~4K tokens max             │    (if continuing prior thread)           │
│   └─────────────────────────────┘                                           │
│                                                                             │
│   WITHIN SEGMENT: Full SDK resume, no token management needed               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design Principle**: Full resume within segments. Controlled injection between segments.

---

## Validated Findings

### Finding 1: Multi-Pass Enables Meta-Level Thinking

**Evidence**: 25% of cases reached different conclusions. Multi-pass elevated to higher abstraction:

| Problem | Single-Pass Level | Multi-Pass Level |
|---------|------------------|------------------|
| Portfolio | Company comparison | Fund portfolio construction |
| Netflix | DVD business optimization | Platform transition strategy |
| Kodak | Camera development | Ecosystem ownership |

### Finding 2: SDK Context Accumulation Matters

**Evidence** (EXP-019): Comparing harness_lite vs SDK session resume:

| Metric | harness_lite | SDK Resume |
|--------|--------------|------------|
| Time | 334s | 3,885s |
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

## The Multi-Pass Harness

Both modes run on the same reasoning engine:

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

## Session Segments

**Architecture**: Session SEGMENTS with full resume within, rich extraction between.

```
SESSION SEGMENT 1 (turns 1-N)
├── Turn 1: Fresh session, inject thesis + last_summary
├── Turn 2-N: resume=session_id ← FULL SDK CONTEXT BENEFITS
├── Track: turn_count, token_estimate
└── Threshold hit → CHECKPOINT

CHECKPOINT
├── Synthesize → update thesis.md
├── Export → sessions/session_001.md (archival)
├── Compress → session_001_summary.md (for loading)
├── Extract → memory/claims.json (searchable)
└── End segment (next query starts fresh)

SESSION SEGMENT 2 (turns N+1 to M)
├── Turn 1: Fresh session, inject updated thesis + segment_1_summary
├── Turn 2-M: resume=session_id ← FULL SDK BENEFITS AGAIN
└── ...
```

**Checkpoint Triggers**:
- Turn count >= 20
- Token estimate >= 80K
- User explicit `/checkpoint`
- Session end

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

**Dialogue as First Principle.** User messages are sacred. They represent human thinking and should never be compressed away.

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this architecture earns its keep.
