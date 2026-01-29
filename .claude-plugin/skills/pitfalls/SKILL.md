---
name: pitfalls
description: Audit thesis quality for cognitive biases. Detect confirmation bias, narrative fallacy, recency bias, and other pitfalls that degrade strategic reasoning.
allowed-tools: Read, Grep, AskUserQuestion
argument-hint: check | <pitfall-name> | stases | alpha
---

# Cognitive Pitfalls Pattern

**Category:** Strategy Quality Assurance

## Overview

This skill applies behavioral economics and epistemological rigor to strategic thesis work. It detects and counters seven cognitive pitfalls that degrade AI-assisted strategy, and frames strategic questions through the classical four stases (conjecture, definition, quality, procedure).

Use this skill to audit thesis quality, prevent thought drift, and ensure AI output strengthens rather than weakens strategic reasoning.

## Core Philosophy

> The question isn't whether AI can help with strategy. The question is whether it can help without making us *worse* at it—without producing the fluent, agreeable, narrative-coherent output that feels like insight but degrades the actual cognitive work.

## Invocation Patterns

```bash
/pattern check              # Run full diagnostic on current session
/pattern <pitfall-name>     # Focus on specific pitfall
/pattern stases             # Review foundational questions
/pattern alpha              # Examine alpha generation claim
```

---

## The Four Stases (Foundational Questions)

### 1. CONJECTURE: Does the problem even exist?

When invoked with `/pattern stases`, begin here:

**Positions to examine:**
- Does the strategist actually need help organizing theses?
  - Counter: Maybe top performers trust instinct over tools
- Is AI output too diffuse for strategy work?
  - Counter: Or have users not learned proper prompting?
- Are people already doing thesis work effectively?
  - Counter: Or is this only a narrow band of operators?

**Core uncertainty:** Is there a market beyond the middle tier? Top performers trust instinct; bottom performers don't engage with macro. CANNON targets people who *want* to think better but lack scaffolding.

**Diagnostic questions for current work:**
- Who is this thesis for?
- Would a top-tier strategist need this analysis?
- What problem does organizing this solve?

---

### 2. DEFINITION: What counts as strategic insight vs. analysis?

**Critical distinctions:**
- **Analysis** (organizing information) vs **Insight** (seeing implications)
- **Productivity** (acting faster) vs **Alpha** (acting better)
- **Density** (fewer words) vs **Compression** (preserved signal)

**The definition fight:** Is strategic insight *reducible* to process (thesis formation, multi-pass, compression)? Or is it irreducibly tacit—something developed through experience, not scaffolded by tools?

**Diagnostic questions for current work:**
- Is this analysis or insight?
- What does this tell us that wasn't obvious from the data?
- Could a junior analyst produce this with more time?
- Is there asymmetric upside here, or just organized information?

---

### 3. QUALITY: Does AI output harm strategic thinking?

**The accusation:**
> AI output is *adjacent to slop*. It lacks economy. Insights get buried in bloat. Over time, the paper implodes—becomes contradictory. Synonyms cause thought drift.

If true, AI isn't just unhelpful—it's *actively harmful* to strategic reasoning. It creates the *appearance* of insight while degrading actual cognitive work.

**Diagnostic questions for current work:**
- Does this output feel fluent but hollow?
- Are key insights buried in elaboration?
- Has terminology drifted across sections?
- Would this be clearer at half the length?

---

### 4. PROCEDURE: Can architecture solve this, or is it a training problem?

**Architectural solution** | **Training solution**
Multi-pass + compression preserves signal | Better base models will produce denser output
Semantic markers prevent drift | Fine-tuning on strategic corpora solves this
The harness *creates* conditions for density | The model just needs better prompting

**Key question:** If the problem is architectural, CANNON is defensible. If it's just prompting/training, it's a feature that gets absorbed into base models.

**Diagnostic questions for current work:**
- Could better prompting have produced this quality?
- What architectural constraint created value here?
- Is this solving a systems problem or a model problem?

---

## The Seven Cognitive Pitfalls

### 1. Confirmation Bias / Thesis Entrenchment

**What it is:**
Operators find evidence for what they already believe. AI is especially dangerous: it's agreeable, elaborates your frame, makes you feel smart.

**Detection heuristics:**
- All evidence points one direction
- Counterarguments feel weak or strawmanned
- You feel increasingly confident as the analysis proceeds
- Alternative frames aren't genuinely explored

**Architectural counter:**
The critique phase must be *genuinely* adversarial, not performative. Six questioning techniques aren't enough if they're all gentle.

**User counter:**
- Start with "What would make me wrong?"
- Generate the strongest possible counterargument
- Explicitly name assumptions that, if false, would invalidate the thesis

**Check command output:**
```
CONFIRMATION BIAS CHECK
─────────────────────────
□ Multiple competing frames explored?
□ Counterarguments feel strong, not strawmanned?
□ Confidence trajectory is non-monotonic?
□ Evidence actively sought against thesis?
□ Assumptions explicitly named and tested?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

### 2. Narrative Fallacy (Taleb)

**What it is:**
Humans compulsively impose story structure on noise. AI is *optimized* to produce narrative coherence—that's what RLHF trains for.

**Detection heuristics:**
- The explanation feels too clean
- Causality is asserted without mechanism
- Timeline creates artificial coherence
- Uncertainty is cosmetic, not structural

**Architectural counter:**
Explicit uncertainty bounds. "What would change this conclusion?" isn't optional—it's load-bearing.

**User counter:**
- Remove the narrative connectors—does the logic hold?
- What's the null hypothesis version of this story?
- Which causal claims are actually tested vs. asserted?

**Check command output:**
```
NARRATIVE FALLACY CHECK
─────────────────────────
□ Causal claims have explicit mechanisms?
□ Uncertainty is structural, not cosmetic?
□ Null hypothesis explicitly considered?
□ Timeline required or imposed?
□ Alternative explanations given equal weight?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

### 3. Availability Heuristic / Recency Bias

**What it is:**
Overweighting recent or vivid information. AI context windows mechanically encode recency.

**Detection heuristics:**
- Recent data dominates conclusions
- Vivid examples crowd out base rates
- Historical context is mentioned but not integrated
- Latest touchpoints feel more important than they are

**Architectural counter:**
Key evidence protection. Facts that anchor conclusions can't be crowded out by recent tokens.

**User counter:**
- Explicitly weight historical vs. recent evidence
- Check if conclusions change when you reverse chronology
- Ask: "Is this important or just recent?"

**Check command output:**
```
RECENCY BIAS CHECK
─────────────────────────
□ Historical evidence weighted appropriately?
□ Base rates integrated, not mentioned?
□ Recent data contextualized vs. trend?
□ Key anchoring facts protected?
□ Vivid examples checked against distributions?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

### 4. Illusion of Explanatory Depth

**What it is:**
Thinking you understand something because you can describe it. AI *massively* amplifies this: it produces fluent descriptions of things it doesn't understand.

**Detection heuristics:**
- Explanations feel satisfying but shallow
- Mechanisms are named but not explained
- You can't predict edge cases
- The description works for multiple different mechanisms

**Architectural counter:**
"Aporia engineering"—force the model through uncertainty before conclusion. Productive confusion precedes insight.

**User counter:**
- Can you predict what happens in a novel scenario?
- Explain the mechanism to a 10-year-old
- What would a true expert add to this explanation?

**Check command output:**
```
EXPLANATORY DEPTH CHECK
─────────────────────────
□ Mechanisms explained, not just named?
□ Edge cases predictable from model?
□ Uncertainty phase preceded conclusion?
□ Explanation distinguishes between competing theories?
□ True domain expert would add little?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

### 5. Synonym Drift / Concept Slippage

**What it is:**
Using different words for the same thing, creating the illusion of distinct concepts. Over long documents, synonyms accumulate and reasoning becomes incoherent.

**Detection heuristics:**
- Key concepts have multiple labels
- Terminology shifts between sections
- You're not sure if two terms mean the same thing
- Arguments rely on subtle definitional shifts

**Architectural counter:**
Semantic markers must *lock* terminology. `[THESIS: X]` can't become "the central idea" three pages later.

**User counter:**
- Create explicit glossary of key terms
- Search for all variations of core concepts
- Rewrite using only canonical terms

**Check command output:**
```
SYNONYM DRIFT CHECK
─────────────────────────
□ Core concepts have single canonical labels?
□ Terminology consistent across sections?
□ Semantic markers used and preserved?
□ No arguments rely on definitional shifts?
□ Glossary of key terms exists and is followed?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

### 6. Density Collapse

**What it is:**
Every added sentence dilutes the core insight. AI has no internal model of "importance per token"—it just generates.

**Detection heuristics:**
- Key insights are buried in elaboration
- You can't extract the core claim in one sentence
- Multiple paragraphs say similar things
- Compression would preserve 90%+ of value

**Architectural counter:**
Compression phase needs a *ruthlessness* parameter. What's the minimum viable articulation of this insight?

**User counter:**
- State the thesis in one sentence
- Remove every sentence that doesn't add information
- Ask: "Would this be clearer at half the length?"

**Check command output:**
```
DENSITY COLLAPSE CHECK
─────────────────────────
□ Core thesis extractable in one sentence?
□ No redundant paragraphs?
□ Each sentence adds new information?
□ Compression tested (≤50% length)?
□ Insights at the surface, not buried?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

### 7. Overconfidence from Fluency

**What it is:**
Fluent output feels true, even when wrong. AI is dangerously fluent.

**Detection heuristics:**
- Confidence increases monotonically
- Conclusions feel certain despite ambiguity
- Caveats are cosmetic, not structural
- You feel smarter after reading but can't articulate why

**Architectural counter:**
Non-monotonic confidence trajectories. The Netflix finding (0.75→0.65→0.65) is the signature of real reasoning. Monotonically increasing confidence is suspicious.

**User counter:**
- Track confidence claims across document
- Identify where uncertainty should increase, not decrease
- Check if caveats actually constrain conclusions

**Check command output:**
```
FLUENCY OVERCONFIDENCE CHECK
─────────────────────────────
□ Confidence trajectory is non-monotonic?
□ Uncertainty increases where appropriate?
□ Caveats structurally constrain conclusions?
□ You can articulate *why* you're more confident?
□ Fluency doesn't substitute for rigor?

RISK LEVEL: [LOW | MEDIUM | HIGH]
```

---

## The Alpha Question

When invoked with `/pattern alpha`, examine:

### The Pessimistic Case
- Alpha is information asymmetry + judgment
- AI democratizes information → compresses alpha to zero
- Judgment is irreducibly tacit → can't be scaffolded
- **Therefore:** AI tools are efficiency plays, not alpha generators

### The Optimistic Case
- Alpha isn't just information—it's *frame*
- Most operators are stuck in wrong frames (incrementality, point estimates, prediction)
- Multi-pass can shift frame (the 25% finding from experiments)
- Frame shifts *are* asymmetric upside
- **Therefore:** A tool that reliably produces frame shifts is an alpha tool

### The Key Claim
CANNON doesn't find alpha by having better data. It finds alpha by asking better questions. The 25% of cases where multi-pass reached different conclusions are exactly where alpha lives—where the obvious answer is wrong and the frame itself needs questioning.

**Diagnostic questions:**
- Does this work change the frame, or operate within it?
- Would a consensus view reach the same conclusion?
- Is there asymmetric upside, or just faster analysis?
- What question is being asked that others miss?

---

## Architecture Implications Table

When running `/pattern check`, output this summary:

| Pitfall | Architectural Response | Current Status |
|---------|------------------------|----------------|
| Confirmation bias | Adversarial critique must be genuinely adversarial | [✓/✗/⚠] |
| Narrative fallacy | Uncertainty structural, not cosmetic | [✓/✗/⚠] |
| Availability/recency | Key evidence protected from context crowding | [✓/✗/⚠] |
| Illusion of depth | Engineer aporia—force uncertainty before conclusion | [✓/✗/⚠] |
| Synonym drift | Semantic markers lock terminology | [✓/✗/⚠] |
| Density collapse | Compression with ruthlessness metric | [✓/✗/⚠] |
| Fluency overconfidence | Non-monotonic confidence trajectory | [✓/✗/⚠] |

---

## Execution Instructions

### When invoked with `/pattern check`:

1. Analyze the current session/thesis work
2. Run detection heuristics for all seven pitfalls
3. Output risk assessment for each (LOW/MEDIUM/HIGH)
4. Generate architecture implications table
5. Provide prioritized recommendations

### When invoked with `/pattern <pitfall-name>`:

1. Load the specific pitfall section
2. Run detailed detection heuristics
3. Provide examples from current work
4. Suggest specific architectural + user counters
5. Output detailed check command results

### When invoked with `/pattern stases`:

1. Present all four stases as questions
2. Apply diagnostic questions to current work
3. Identify which stasis is most active/relevant
4. Recommend framing for current thesis

### When invoked with `/pattern alpha`:

1. Present pessimistic vs optimistic case
2. Examine current work for frame shifts
3. Assess whether work generates alpha or efficiency
4. Output diagnostic questions with answers

---

## Integration with CANNON Workflow

This skill should be invoked:
- **Before synthesis pass** - Check for pitfalls in expansion output
- **After compression pass** - Verify density and prevent fluency overconfidence
- **During critique phase** - Ensure adversarial rigor
- **Before thesis publication** - Full diagnostic check

The skill output should feed back into the strategy protocol, triggering additional passes or refinements when risk levels are HIGH.

---

## Meta-Diagnostic

Finally, apply this skill to itself:

**Confirmation bias?** Does this framework impose a predetermined structure on strategy evaluation?
**Narrative fallacy?** Is the "seven pitfalls" framing artificially clean?
**Synonym drift?** Do terms like "insight" and "alpha" shift meaning across sections?
**Density collapse?** Could this skill be half the length and twice as useful?

A good framework should be able to critique itself. If this skill can't pass its own tests, it's not ready for production.
