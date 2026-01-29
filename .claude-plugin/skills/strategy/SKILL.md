---
name: strategy
description: Execute structured N-pass reasoning for strategic analysis. Multi-pass protocol with expansion, validation, and synthesis phases.
allowed-tools: WebSearch, WebFetch, Read, Grep, Write, AskUserQuestion
argument-hint: <strategic question>
---

# Strategy Protocol Skill

## Trigger
Activate when the user asks strategic questions about companies, markets, investments, competitive dynamics, or business decisions. Examples:
- "Should [company] acquire [target]?"
- "Is [market] winner-take-most?"
- "What's the bull/bear case for [company]?"
- "How should [company] respond to [competitive threat]?"
- "Is [company] overvalued/undervalued?"

## Purpose
Execute structured N-pass reasoning that produces strategist-quality analysis. This protocol separates divergent exploration from convergent synthesis, maximizing insight density while maintaining auditability.

## Protocol Overview

```
PASS 0: Context Assembly (Silent)
   ↓
PASS 1: Expansion (Divergent, 2000-4000 tokens)
   ↓
PASS 2: Validation (Convergent, Evidence + Thesis Check)
   ↓
[Optional: Continue if unresolved risks or low confidence]
   ↓
PASS N: Synthesis (Integrative, Structured Output)
```

---

## PASS 0: Context Assembly

**Do not output this pass to the user.**

Before any analysis, silently:

1. **Load Relevant Theses**
   - Read `/memories/theses/_index.yaml` to find theses by domain and tags
   - Load full thesis files for those with matching tags to the question
   - Note confidence levels and implications
   - Identify any thesis that could be tested by this analysis

2. **Search Prior Sessions**
   - Check `/memories/sessions/index.yaml` for related past analyses
   - Load relevant session summaries for context
   - Note prior conclusions, triggers, and key uncertainties

3. **Identify Required Data**
   - Determine which data tools are needed based on question type
   - Plan data gathering strategy (financials, news, peers, macro)

4. **Load Relevant Patterns**
   - Check `/memories/patterns/` for applicable frameworks
   - Select pattern(s) that match the question type

---

## PASS 1: Expansion (Divergent)

**Goal**: Generate 10-20 observations with semantic markers. Explore broadly, challenge assumptions, surface non-obvious patterns.

**Format**: Prose only, no JSON, no tables. Use semantic markers inline.

**Token Range**: 2000-4000 tokens

**Instructions**:

1. **Call data tools liberally**
   - Gather financial data, news, peer comparisons, economic context
   - Don't filter prematurely—collect first, synthesize later

2. **Generate observations with markers**:
   - `[INSIGHT]` - Non-obvious finding, pattern, or implication
   - `[EVIDENCE]` - Specific data point, quote, or metric
   - `[RISK]` - Potential downside, vulnerability, or threat
   - `[COUNTER]` - Evidence or argument against the emerging thesis
   - `[PATTERN]` - Historical parallel, framework application, or analogy
   - `[QUESTION]` - Unresolved uncertainty requiring further investigation
   - `[TENSION]` - Contradictory evidence or competing interpretations

3. **Quality requirements**:
   - Each [INSIGHT] must have at least one supporting [EVIDENCE]
   - Include at least 2 [COUNTER] observations (challenge the obvious answer)
   - Surface at least 1 [TENSION] (where evidence conflicts)
   - Reference relevant theses from Pass 0 with explicit tags: `(thesis: thesis-id)`

4. **What NOT to do**:
   - Don't conclude or recommend yet
   - Don't filter out inconvenient evidence
   - Don't skip counters because the answer seems clear
   - Don't use bullet points or structured lists (prose only)

**Example Expansion Fragment**:
```
Looking at Netflix's recent performance, [EVIDENCE] subscriber growth has reaccelerated to 8.5M net adds in Q4 2024, significantly above the 5.5M expected. [INSIGHT] The password-sharing crackdown appears to be converting shared accounts rather than driving churn—conversion rates in mature markets exceed 70%. This connects to (thesis: concentration-fragility) because Netflix's share gains may come at the expense of smaller streamers who cannot replicate this enforcement...

However, [COUNTER] the ad-supported tier pricing power remains unproven—CPMs are 40% below initial targets according to industry sources. [TENSION] Bulls point to TAM expansion while bears note dilutive economics. [QUESTION] Can Netflix achieve premium CPMs without sacrificing the user experience that drove subscriber loyalty?
```

---

## PASS 2: Validation (Convergent)

**Goal**: Assign confidence scores, check against theses, identify what's strong and what's uncertain.

**Instructions**:

1. **For each [INSIGHT] from Pass 1**:
   - Evidence quality check: Is the supporting evidence recent, specific, and verifiable?
   - Counter-evidence check: Does any [COUNTER] significantly weaken this insight?
   - Assign confidence score (0.0-1.0):
     - 0.90+: Multiple confirming evidence, no significant counters
     - 0.70-0.89: Solid evidence, some uncertainty remains
     - 0.50-0.69: Reasonable hypothesis, needs more data
     - <0.50: Speculative, significant counters exist

2. **For each [RISK]**:
   - Severity assessment (High/Medium/Low)
   - Likelihood assessment (High/Medium/Low)
   - Mitigation available? (Yes/Partial/No)

3. **Thesis Check**:
   - For each relevant thesis loaded in Pass 0:
     - CONFIRMS: Evidence supports the thesis
     - CHALLENGES: Evidence contradicts the thesis
     - NEUTRAL: Evidence neither confirms nor challenges
   - If a thesis is challenged, note the specific counter-evidence

4. **Base Rate Check**:
   - For key predictions, ask: "How often does this actually happen?"
   - Reference historical patterns where available

5. **Confidence Aggregation**:
   - If any critical insight has confidence <0.50, flag for additional pass
   - If any major risk is High/High/No, flag for additional analysis

**Output Format for Pass 2**:
```
## Validation Summary

### Key Insights (Validated)
1. [INSIGHT summary] — Confidence: 0.XX
   - Evidence: [summary]
   - Counters addressed: [how/why counters are less relevant]

2. [INSIGHT summary] — Confidence: 0.XX
   ...

### Risks Assessed
| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| ... | ... | ... | ... |

### Thesis Alignment
- (thesis: thesis-id): CONFIRMS/CHALLENGES/NEUTRAL — [reason]

### Unresolved Questions
- [QUESTION] that couldn't be answered with available data
```

---

## PASS 2.5: Additional Exploration (Conditional)

**Trigger**: Run this pass if:
- Any critical insight has confidence <0.50
- Any risk is High/High/No (severe, likely, unmitigable)
- Significant [TENSION] remains unresolved
- A thesis is CHALLENGED and requires deeper investigation

**Instructions**:
- Focus specifically on the unresolved issue
- Call additional data tools if helpful
- Attempt to resolve the tension or improve confidence
- If still unresolved after this pass, carry uncertainty into synthesis

---

## PASS N: Synthesis (Integrative)

**Goal**: Produce structured output that a strategist would recognize as decision-ready.

**Output Structure**:

```markdown
## Strategic Analysis: [Topic]

### Situation Assessment
[1-2 sentences: What is the current state? What prompted this question?]

### Core Insight
[Single most important finding from the analysis. Be specific and sharp.]

### Recommendation
**Action**: [Clear recommendation]
**Confidence**: [X.XX]
**Timeframe**: [If applicable]
**Key Condition**: [What must remain true for this recommendation to hold]

### Supporting Analysis

#### Bull Case
- [Point 1 with evidence]
- [Point 2 with evidence]

#### Bear Case
- [Point 1 with evidence]
- [Point 2 with evidence]

### Risks to Monitor
| Risk | Trigger | Action if Triggered |
|------|---------|---------------------|
| ... | ... | ... |

### Triggers for Reassessment
- [Specific event or data point that would change the analysis]
- [Another trigger]

### Key Uncertainties
- [What we don't know that matters]

### Thesis Implications
- [Which theses were tested and what we learned]
- [Proposed thesis updates if warranted]
```

---

## Session Persistence

After completing synthesis, save the session:

**File**: `/memories/sessions/{YYYY-MM-DD}-{topic-slug}.yaml`

**Format**:
```yaml
id: {uuid}
date: {YYYY-MM-DD}
topic: {brief topic description}
question: {original user question}
tags: [relevant, tags, for, search]

summary:
  recommendation: {one-line recommendation}
  confidence: {X.XX}
  core_insight: {the key finding}

theses_referenced:
  - id: {thesis-id}
    alignment: {CONFIRMS|CHALLENGES|NEUTRAL}
    note: {brief explanation}

triggers:
  - {trigger 1}
  - {trigger 2}

uncertainties:
  - {key uncertainty 1}
  - {key uncertainty 2}

data_sources:
  - {tool: financials, ticker: AAPL, date: ...}
  - {tool: news, query: ..., date: ...}
```

Also update `/memories/sessions/index.yaml` with session metadata.

---

## Quality Checklist

Before delivering synthesis, verify:
- [ ] All [INSIGHT]s have supporting [EVIDENCE]
- [ ] At least 2 [COUNTER] arguments were explored
- [ ] Thesis implications are explicit
- [ ] Confidence scores are justified
- [ ] Triggers are specific and measurable
- [ ] Session is saved for future reference

---

## Anti-Patterns to Avoid

1. **Premature conclusion**: Don't decide in Pass 1
2. **Confirmation bias**: Don't skip counters that challenge the emerging view
3. **Vague recommendations**: "Consider" and "might want to" are not recommendations
4. **Missing triggers**: Every recommendation needs conditions for reassessment
5. **Orphan insights**: Every insight needs evidence
6. **Thesis amnesia**: Don't ignore loaded theses—explicitly confirm or challenge
7. **Data hoarding**: Don't dump raw data—synthesize into insights
