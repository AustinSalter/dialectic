# Critique Pass (Dialectic)

Sublation-enhanced critique with structured questioning. Goal: find what the thesis is really trying to say, then decide whether to continue, conclude, or elevate.

**Core principle**: "The goal is not to find what's wrong. The goal is to find what the thesis is really trying to say."

---

## Phase 0: MARKET STRUCTURE DETECTION

**Before critiquing the thesis, identify the market dynamics at play.** Different structures require different critique intensity on action vs inaction.

### Market Structure Types

| Structure | Characteristics | Critique Implication |
|-----------|-----------------|---------------------|
| **GRADUAL_SHARE** | Incremental competition, continuous dynamics, multiple stable equilibria | Standard critique - balance action/inaction |
| **WINNER_TAKE_MOST** | Network effects, tipping points, 70-90% to winner | **Force inaction critique** - "wait and see" has hidden cost |
| **WINNER_TAKE_ALL** | Platform lock-in, zero-sum, second place = zero | **Aggressive inaction critique** - delay may be fatal |
| **DISRUPTION** | Incumbent advantages become liabilities, S-curve dynamics | Critique incumbent logic for internal contradictions |
| **COMMODITY** | Low differentiation, price competition, no moats | Critique differentiation claims skeptically |

### Detection Signals

```
WINNER_TAKE_MOST / WINNER_TAKE_ALL signals:
- "network effects," "platform," "two-sided market"
- "market share," "first mover," "tipping point"
- "land grab," "blitzscaling," "growth over profit"
- Comparisons to: eBay/Yahoo Auctions, Facebook/MySpace, Uber/Lyft

DISRUPTION signals:
- "innovator's dilemma," "cannibalization"
- Incumbent's profit center = vulnerability
- New entrant with worse product winning specific segment

COMMODITY signals:
- "price war," "margin compression," "undifferentiated"
- Multiple providers with similar offerings
- Customer switching costs low
```

### Inaction Critique (MANDATORY for WTA/WTM)

For WINNER_TAKE_MOST or WINNER_TAKE_ALL markets, apply these probes **regardless of problem type**:

1. **What happens if competitor wins while we deliberate?**
   - In WTA markets, the winner doesn't sell
   - "Wait and acquire" success rate: ~5%

2. **What's the cost of being second in this market?**
   - Gradual share: Second place gets 30% → viable
   - WTA: Second place gets 5% → death spiral

3. **Is "prudent caution" actually risk-seeking?**
   - In continuous markets, caution reduces risk
   - In WTA markets, caution INCREASES risk (market tips)

4. **Historical base rate for "wait and see" in WTA:**
   - Yahoo waiting on Google: Lost
   - Blockbuster waiting on Netflix: Lost
   - MySpace waiting vs Facebook: Lost
   - Success rate of "catch up later": Near zero

```
MARKET_STRUCTURE_OUTPUT:
├── detected_structure: [GRADUAL_SHARE | WINNER_TAKE_MOST | WINNER_TAKE_ALL | DISRUPTION | COMMODITY]
├── confidence: [HIGH | MEDIUM | LOW]
├── signals_found: [list of detection signals]
├── inaction_critique_required: [TRUE | FALSE]
├── analogous_cases: [list of historical parallels from patterns library]
└── asymmetric_risk_note: [if WTA: "Caution increases risk; aggression reduces it"]
```

**See**: [PATTERNS.md](PATTERNS.md) for domain-specific market structure patterns.

---

## Sublation Protocol

Every critique must simultaneously:
1. **Negate** — identify limitation or one-sidedness
2. **Preserve** — retain what is true or insightful
3. **Elevate** — transform into higher unity explaining why tension existed

**Critique that only negates produces abstraction drift.**

---

## Phase 1: STASIS CHECK

Before critique, locate where the thesis operates. Disagreement at different stases produces noise, not insight.

| Stasis | Core Question | Strategic Form |
|--------|---------------|----------------|
| **FACT** | What is happening? | Market dynamics, competitor actions |
| **DEFINITION** | What is it? | Is this disruption or evolution? |
| **QUALITY** | Is it good/bad/wise? | Should we pursue this? |
| **PROCEDURE** | What should be done? | Resource allocation, timing |

**Diagnostic Questions:**
- At which stasis does this thesis operate?
- Are prior stases resolved or assumed?
- Is apparent disagreement actually a stasis mismatch?

```
STASIS_OUTPUT:
├── thesis_stasis: [FACT | DEFINITION | QUALITY | PROCEDURE]
├── prior_stases_resolved: [TRUE | FALSE | ASSUMED]
└── recommendation: [PROCEED | RESOLVE_PRIOR | REFRAME]
```

**Rule:** Cannot critique at a higher stasis than the thesis operates.

---

## Phase 2: ABSTRACTION CHECK

The right thesis operates at the altitude where mechanism meets transferability.

| Level | Symptom | Problem |
|-------|---------|---------|
| **TOO_GRANULAR** | Accurate details, no pattern | Explains THIS but not WHY |
| **TOO_ABSTRACT** | Pattern named, no mechanism | Labels without causal structure |
| **RIGHT_LEVEL** | Mechanism + transferability | Explains WHY, applies beyond this instance |

**The Altitude Test:**
> "If I gave this thesis to someone facing an analogous situation, would they recognize the analogy and know what to do?"

```
ABSTRACTION_OUTPUT:
├── current_level: [TOO_GRANULAR | TOO_ABSTRACT | RIGHT_LEVEL]
├── if TOO_GRANULAR → elevation_direction: [proposed reframe]
├── if TOO_ABSTRACT → grounding_direction: [what specifics needed]
└── transferable_insight: [YES | NO] + one-sentence principle if YES
```

---

## Phase 3: ESSENTIAL TENSION (Adversarial Probes)

**This is where adversarial techniques apply.** Use them to surface INTERNAL contradictions.

### The 6 Questioning Techniques

Apply ALL to probe for internal tension:

#### 1. INVERSION
What if the opposite were true? Challenge the frame itself.

#### 2. SECOND-ORDER
What are the downstream effects? Follow implications 2-3 steps out.

#### 3. FALSIFICATION
What evidence would disprove this? If nothing would, the thesis is unfalsifiable.

#### 4. BASE RATES
What do historical priors suggest? Compare to distributions, not individual cases.

#### 5. INCENTIVE AUDIT
Who benefits from this being believed? Follow the money and power.

#### 6. ADVERSARY SIMULATION
How would a smart skeptic attack this? Generate the steelman counterargument.

### Internal vs External Tension

**Seek INTERNAL tension** (dialectical):
- "Their greatest strength was structurally tied to their greatest vulnerability"
- Contradiction within the situation's own logic

**Not EXTERNAL tension** (not dialectical):
- "Competitors were also failing"
- Opposition from outside factors

```
TENSION_OUTPUT:
├── tension_identified: [TRUE | FALSE]
├── if TRUE:
│   ├── thesis_side: [what thesis emphasizes]
│   ├── antithesis_side: [what thesis downplays]
│   ├── both_legitimate: [TRUE | FALSE]
│   └── tension_type: [INTERNAL | EXTERNAL]
├── thesis_relationship_to_tension: [RESOLVES | DESCRIBES | IGNORES | OBSCURES]
└── strongest_counter: [single strongest argument against thesis]
```

---

## Phase 4: PRESERVATION GATE

**You cannot move to decision until you articulate what is TRUE in what you're critiquing.**

This is the anti-drift mechanism. Abstract negation produces bad aporia. Determinate negation produces elevation.

```
PRESERVATION_OUTPUT:
├── thesis_correctly_identifies: [specific content that is sound]
├── thesis_correctly_frames: [specific framing that is valuable]
├── synthesis_must_retain: [elements that cannot be lost]
└── COMPLETENESS_CHECK: [all fields populated? if NO → return to earlier phase]
```

**Red Flag:** If you cannot complete the preservation output, you have not understood the thesis well enough to critique it.

**Hard Rule:** No branching decision without completed preservation.

---

## Problem-Type Routing

**Critical**: Critique intensity depends on problem type AND market structure.

| Problem Type | Intensity | Approach |
|--------------|-----------|----------|
| Competitive response | HEAVY | Full dialectic, aggressive tension probing |
| Market disruption | HEAVY | Seek internal contradictions in incumbent logic |
| M&A evaluation | HEAVY | Easy to rationalize; need pushback |
| **Winner-take-most** | HEAVY + INACTION | Standard critique PLUS mandatory inaction probe |
| Turnaround/distress | LIGHT | Streamlined dialectic, emphasize preservation |
| Execution-focused | LIGHT | Overthinking kills momentum |

### Classification Signals

**Heavy**: "competitor," "market share," "disruption," "cannibalize," strategic pivot, new entrant

**Heavy + Inaction (WTA)**: "network effects," "platform," "land grab," "first mover," "tipping point"

**Light**: "turnaround," "crisis," "survival," "urgent," execution focus

### Market Structure Override

If Phase 0 detects WINNER_TAKE_MOST or WINNER_TAKE_ALL:
- Override to HEAVY + INACTION regardless of problem type
- Apply Null Hypothesis Critique to "wait and see" options
- Weight asymmetric payoffs: cost of losing WTA market >> cost of over-investing

---

## The Null Hypothesis Critique

**Critical for turnaround/distress AND winner-take-most situations.**

Heavy critique finds problems with action but rarely critiques *inaction*. Before concluding:

1. **What happens if we do nothing?** Trace the trajectory of decline.
2. **What's the cost of delay?** Each month of analysis has real cost.
3. **Is "more analysis" actually avoidance?** Perfect information doesn't exist.
4. **Is imperfect action better than perfect inaction?** In distress: almost always yes.

### Extended Null Hypothesis for WTA Markets

For WINNER_TAKE_MOST or WINNER_TAKE_ALL (from Phase 0):

5. **What happens if the market tips while we wait?**
   - Can we acquire the winner later? (Usually no - winners don't sell)
   - Can we catch up with better execution? (Usually no - network effects compound)

6. **Is "prudent due diligence" actually the riskiest path?**
   - In gradual markets: Due diligence reduces risk
   - In WTA markets: Due diligence may BE the risk (delay while market tips)

7. **What's the asymmetric payoff structure?**
   - Cost of acting aggressively and being wrong: $$$ (recoverable)
   - Cost of waiting and market tips: Business viability (unrecoverable)

8. **Historical base rate check:**
   - "We'll wait and acquire if they succeed" → Success rate: ~5%
   - "We'll build our own once the market is proven" → Success rate: ~10%
   - "We'll fight aggressively for the market now" → Success rate: ~40%

---

## 3D Confidence Assessment

```
REASONING_QUALITY (R): 0.0-1.0
  - Is the logical structure sound?
  - 1.0 = fallacy-free reasoning

EVIDENCE_QUALITY (E): 0.0-1.0
  - Is the evidence complete and verified?
  - 1.0 = solid epistemic foundation

CONCLUSION_CONFIDENCE (C): 0.0-1.0
  - Given R and E, how certain is the thesis?
  - 0.5 = appropriate for genuinely uncertain situations
```

**Composite**: `(R + E + C) / 3` (NOT multiplicative)

---

## Tone Guidance

**During Essential Tension (adversarial)**:
> "What if the opposite were true? The evidence for X is Y, but the counterargument would be Z."

**During Preservation/Elevation (collaborative)**:
> "You're onto something with X. The thing I keep bumping into is Y—not as a counterargument exactly, but it feels like there's something underneath. What if the real question is Z?"

---

## Decision Framework

After applying all phases:

| Decision | When to Use | Next Step |
|----------|-------------|-----------|
| **CONTINUE** | Evidence gaps addressable with more data | Another expansion cycle |
| **CONCLUDE** | Thesis robust AND at right abstraction level | → Synthesis with conviction |
| **ELEVATE** | Thesis too granular/abstract OR internal tension requires reframing | Reframe thesis, new cycle |

**Key change**: ELEVATE replaces PIVOT. We don't abandon the thesis; we elevate it to find what it's really trying to say.

### CONCLUDE Criteria (Feeding Synthesis)

CONCLUDE only when you can answer these with conviction:

1. **The Leap is clear**: What single incisive shift resolves the tension?
2. **Determinate Negation is ready**: What "common sense" must be explicitly rejected?
3. **The Bet can be stated**: "We bet X > Y because mechanism Z"
4. **Falsifiability is concrete**: What specific conditions would flip the recommendation?

If any of these are unclear, CONTINUE or ELEVATE. Don't CONCLUDE into hedgy synthesis.

### Catalyst for Specific Action

The critique should not just identify problems — it should **surface the decisive consideration** that makes one path clearly superior.

**Bad**: "There are arguments for acquisition and arguments against."
**Good**: "The acquisition path fails at Phase 3 (internal tension): their greatest asset (culture) is structurally incompatible with integration. This isn't a risk to manage — it's a fatal flaw."

The null hypothesis critique is especially important here: don't just critique action, critique inaction. What's the cost of delay? Is "more analysis" actually avoidance?

---

## Output Format (JSON)

```json
{
  "market_structure": {
    "detected_structure": "GRADUAL_SHARE|WINNER_TAKE_MOST|WINNER_TAKE_ALL|DISRUPTION|COMMODITY",
    "confidence": "HIGH|MEDIUM|LOW",
    "signals_found": ["signal1", "signal2"],
    "inaction_critique_required": true,
    "analogous_cases": ["Yahoo/Google", "Blockbuster/Netflix"],
    "asymmetric_risk_note": "In WTA markets, caution increases risk"
  },
  "stasis_check": {
    "thesis_stasis": "FACT|DEFINITION|QUALITY|PROCEDURE",
    "prior_stases_resolved": true,
    "recommendation": "PROCEED|RESOLVE_PRIOR|REFRAME"
  },
  "abstraction_check": {
    "current_level": "TOO_GRANULAR|TOO_ABSTRACT|RIGHT_LEVEL",
    "direction": "Proposed reframe or grounding if needed",
    "transferable_insight": "One-sentence principle"
  },
  "tension_probing": {
    "inversion": "What if opposite were true?",
    "second_order": "Downstream effects identified",
    "falsification": "What would disprove this",
    "base_rates": "Historical comparison",
    "incentive_audit": "Who benefits",
    "adversary_simulation": "Steelman counter"
  },
  "tension_output": {
    "tension_identified": true,
    "thesis_side": "What thesis emphasizes",
    "antithesis_side": "What thesis downplays",
    "both_legitimate": true,
    "tension_type": "INTERNAL|EXTERNAL"
  },
  "preservation_output": {
    "thesis_correctly_identifies": "Specific sound content",
    "thesis_correctly_frames": "Specific valuable framing",
    "synthesis_must_retain": "Elements that cannot be lost",
    "completeness_check": true
  },
  "problem_type": "competitive|disruption|turnaround|execution",
  "critique_intensity": "HEAVY|LIGHT",
  "null_hypothesis_critique": "Only for turnaround - what happens if we do nothing",
  "confidence_3d": {
    "reasoning_quality": 0.8,
    "evidence_quality": 0.7,
    "conclusion_confidence": 0.6,
    "composite": 0.7
  },
  "strongest_counter": "The single strongest argument against the thesis",
  "decision": "CONTINUE|CONCLUDE|ELEVATE",
  "decision_reasoning": "Reasoning based on all phases above",

  "// If CONCLUDE, prepare for conviction synthesis:": "",
  "synthesis_prep": {
    "the_leap_draft": "Single incisive shift that resolves the tension",
    "determinate_negation_draft": "What common sense we reject",
    "the_bet_draft": "We bet X > Y because mechanism Z",
    "falsifiability_triggers": ["Specific condition 1", "Specific condition 2"]
  }
}
```

**Note on synthesis_prep**: Only complete if decision is CONCLUDE. This ensures you've done the thinking to arrive at conviction, not just concluded because you ran out of patience.
