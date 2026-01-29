# Compression Pass

Convergent synthesis phase. Goal: distill expansion to decision-relevant state.

## Instructions

1. **Scan for markers** — Process all `[INSIGHT]`, `[EVIDENCE]`, `[COUNTER]`, etc.
2. **Validate insights** — Does evidence support each insight? Do counters weaken it?
3. **Assign confidence** — 0.0-1.0 based on evidence balance
4. **Resolve or carry tensions** — Can conflicting evidence be reconciled?
5. **Flag unexplored threads** — What still needs investigation?

## Evidence Strength Rating

Rate each claim's evidence:
- **5**: Observed data with citation (financials, metrics)
- **4**: Reported by credible source
- **3**: Inferred from patterns
- **2**: Assumed based on general knowledge
- **1**: Speculation / no evidence

Claims rated 1-2 are evidence gaps.

## Output Format (YAML)

```yaml
insights:
  - claim: "..."
    confidence: 0.XX
    evidence: ["..."]
    counters_addressed: ["..."]

tensions:
  - description: "..."
    resolved: true/false
    resolution: "..." # if resolved

threads:
  - topic: "..."
    why: "..."
    explored: true/false

overall_confidence: 0.XX

termination:
  should_continue: true/false
  reason: "saturation|low_confidence|unresolved_tensions|unexplored_threads|sufficient"
```

## Output Format (JSON)

For runners requiring JSON:

```json
{
  "thesis_update": "Updated thesis statement (or 'no change')",
  "confidence": 0.XX,
  "confidence_reasoning": "Why this confidence level",
  "evidence_summary": {
    "supporting": ["key point 1", "key point 2"],
    "challenging": ["key point 1", "key point 2"]
  },
  "next_priority": "Most important question to investigate next",
  "areas_investigated": ["area1", "area2"]
}
```

## 3D Confidence Model

Single scalar confidence conflates three distinct concepts. Use three dimensions:

```
REASONING_QUALITY (R): 0.0-1.0
  - Is the logical structure sound?
  - Are there fallacies in the argument chain?
  - 1.0 = fallacy-free reasoning

EVIDENCE_QUALITY (E): 0.0-1.0
  - Is the evidence complete and verified?
  - Are there gaps, contradictions, or stale data?
  - 1.0 = solid epistemic foundation

CONCLUSION_CONFIDENCE (C): 0.0-1.0
  - Given R and E, how certain is the thesis?
  - Reflects genuine domain uncertainty
  - 0.5 = appropriate for genuinely uncertain situations
```

**Composite**: `(R + E + C) / 3` (weighted average, NOT multiplicative)

Example: R=0.70, E=0.80, C=0.50 → **0.67** (not 0.28 from multiplication)

**Key insight**: Fallacies ≠ Evidence gaps. Different failure modes require different responses:

| Issue Type | Affects | Response |
|------------|---------|----------|
| Fallacy | R (Reasoning) | Fix the logic |
| Evidence Gap | E (Epistemic) | Acknowledge or investigate |
| Domain Uncertainty | C (Conclusion) | Accept as legitimate |

## Confidence Recovery

Confidence should BOUNCE, not just decline. Zero means "thesis inverted," not "accumulated 20 minor issues."

```
If no fallacies this cycle:
    R += 0.1 (recover)
If fallacies found:
    R = max(0.5, 0.9 - count * 0.15)
```

## Confidence Calibration (Legacy Single-Scalar)

| Confidence | Meaning |
|------------|---------|
| 0.0-0.3 | Highly uncertain, major evidence gaps |
| 0.3-0.5 | Leaning but significant counters unaddressed |
| 0.5-0.7 | Moderate confidence, some uncertainties remain |
| 0.7-0.85 | High confidence, minor residual risks |
| 0.85-1.0 | Very high confidence (rare, requires strong evidence) |

## Termination Signals

Set `should_continue: false` when:
- Confidence ≥ 0.75 and < 2 unresolved questions
- Confidence delta < 0.05 for 2 consecutive cycles (saturation)
- All material threads explored

Set `should_continue: true` when:
- Unresolved tensions with material impact
- Unexplored threads that could change the thesis
- Confidence < 0.5 and evidence gaps are addressable
