# Experiment Results

This document summarizes the validation experiments that informed Dialectic's architecture.

---

## Summary

| Finding | Experiment | Result |
|---------|------------|--------|
| Multi-pass enables meta-level thinking | EXP-004, EXP-005 | 25% different conclusions, 75% vs 50% on HBR cases |
| Two-pass compression is 6x efficient | EXP-003 | 83% insight coverage at 300 tokens |
| Accumulated context beats partitioned | EXP-005 | ~90% vs ~60% frame-level insight preservation |
| Structured critique finds 9x more flaws | EXP-007 | 18 vs 2 flaws found |
| Semantic markers extract 3x insights | EXP-008 | Per-token insight density |
| Dynamic termination preserves quality | EXP-010 | 50%+ early termination without quality loss |

---

## EXP-004: Multi-Pass vs Single-Pass

**Hypothesis**: Multi-pass reasoning produces qualitatively different (not just longer) outputs.

**Method**: Same strategic problems, single-pass vs 5-pass reasoning.

**Results**:
- 25% of cases reached **different conclusions**
- Multi-pass elevated reasoning to higher abstraction levels

| Problem | Single-Pass | Multi-Pass |
|---------|-------------|------------|
| VC Portfolio | Company comparison | Fund portfolio construction |
| Thesis Update | Data interpretation | Methodology critique |
| Competitive | Tactical response | Industry evolution |
| TAM Sizing | Data presentation | Board decision process |

**Conclusion**: Multi-pass enables frame-level reframing unavailable in single-pass.

---

## EXP-005: Multi-Pass vs Multi-Agent (HBR Cases)

**Hypothesis**: Multi-pass outperforms multi-agent orchestration on strategic reasoning.

**Method**: 4 HBR historical cases with known outcomes. Compare:
- **Multi-pass**: Single agent, 5 expansion/compression cycles
- **Multi-agent**: 4 specialized agents (researcher, analyst, critic, synthesizer)

**Results**:

| Metric | Multi-Pass | Multi-Agent |
|--------|------------|-------------|
| Correct conclusions | **75%** | 50% |
| Frame-level insights | 8 | 3 |
| Average time | 271s | 73s |

**Key Finding**: Multi-pass found frame-level insights that multi-agent missed entirely. The 3.7x time cost is justified for consequential decisions.

---

## EXP-007: Structured vs Naive Self-Critique

**Hypothesis**: Structured critique techniques find more flaws than "now critique this."

**Method**: Three conditions on same problems:
1. **Naive**: "Now critique your conclusion"
2. **Structured**: Six questioning techniques (inversion, second-order, falsification, base rates, incentive audit, adversary simulation)
3. **External**: Separate adversary agent

**Results**:

| Condition | Flaws Found | Quality Score |
|-----------|-------------|---------------|
| Naive | ~2 | 0.4 |
| **Structured** | **~18** | **0.85** |
| External | ~15 | 0.75 |

**Conclusion**: Structured self-critique finds **9x more flaws** than naive. External adversary adds overhead without proportional benefit.

---

## EXP-008: Prose Structure for Compression

**Hypothesis**: Semantic markers improve insight extraction during compression.

**Method**: Four output conditions:
1. **Unstructured**: Plain prose
2. **Markers**: `[INSIGHT]`, `[EVIDENCE]`, `[RISK]`, `[COUNTER]`
3. **Sections**: Explicit headings
4. **Escapes**: Bold emphasis

**Results**:

| Condition | Insights/Token | Recall Score |
|-----------|----------------|--------------|
| Unstructured | 1.0x | 0.6 |
| **Markers** | **3.2x** | **0.9** |
| Sections | 2.1x | 0.8 |
| Escapes | 1.8x | 0.7 |

**Conclusion**: Semantic markers extract **3x more insights per token** than unstructured prose.

---

## EXP-009: Context Compression Quality

**Hypothesis**: Anchored iterative compression preserves more information than regenerative.

**Method**: Three compression strategies across multiple cycles:
1. **No compression**: Accumulate all (baseline, hits context limit)
2. **Regenerative**: Full summary regenerated each cycle
3. **Anchored iterative**: Sections with merge, key evidence protected

**Evaluation**: RACD probes (Recall, Artifact, Continuation, Decision)

**Results**:

| Strategy | Recall | Artifact | Continuation | Decision |
|----------|--------|----------|--------------|----------|
| No compression | 1.0 | 1.0 | 0.7 | 0.8 |
| Regenerative | 0.6 | 0.5 | 0.8 | 0.7 |
| **Anchored** | **0.9** | **0.85** | **0.9** | **0.9** |

**Conclusion**: Anchored iterative compression preserves critical information while staying within context limits.

---

## EXP-010: Termination Criteria

**Hypothesis**: Dynamic termination can reduce cycles without quality loss.

**Method**: Five termination strategies:
1. **Current**: confidence > 0.7 AND tensions resolved
2. **Saturation**: Δconfidence < 0.05 for 2 cycles
3. **Diminishing**: new_insights < 2 per cycle
4. **Combined**: saturation OR diminishing
5. **Explicit**: Agent outputs `[ANALYSIS_COMPLETE]`

**Results**:

| Strategy | Avg Cycles | Quality Maintained |
|----------|------------|-------------------|
| Current (baseline) | 5.0 | Yes |
| Saturation | 3.2 | Yes |
| Diminishing | 2.8 | Partial |
| **Combined** | **3.0** | **Yes** |
| Explicit | 3.5 | Yes |

**Conclusion**: Combined termination (saturation OR diminishing) reduces cycles by 40% while maintaining quality.

---

## Implications for Architecture

These findings directly shaped Dialectic's design:

1. **Multi-pass harness** (EXP-004, 005): Core architecture uses expansion → compression → critique → synthesis
2. **Semantic markers** (EXP-008): All passes use `[INSIGHT]`, `[EVIDENCE]`, `[RISK]`, `[COUNTER]` markers
3. **Structured critique** (EXP-007): Six questioning techniques built into critique pass
4. **Anchored compression** (EXP-009): Scratchpad preserves key evidence across cycles
5. **Dynamic termination** (EXP-010): Combined strategy for efficient stopping
