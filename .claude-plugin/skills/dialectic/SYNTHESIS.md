# Synthesis Pass: Conviction Memo

Final output production. Goal: **incisive recommendation with conviction and actionability**.

**Target output: 800-1200 words.** Long enough to ground the insight, short enough to scan.

## The Problem: Bad Infinity

Most synthesis falls into "Bad Infinity" — endless "on the one hand, on the other hand."

| Bad Infinity (Avoid) | Conviction Memo (Target) |
|----------------------|--------------------------|
| "It depends on context" | "Because X, the only path is Y" |
| Hedge-betting | Position-taking with brief refutatio |
| "Moderate confidence reflects tension" | "High conviction until trigger Z" |
| Preserve both sides | Commit, with explicit off-ramps |

## Core Principle: Bayesian Boldness

**Probability is for calculation. Conviction is for execution.**

- During analysis (Pass 1-N): Use 3D Confidence (R,E,C) honestly
- During synthesis: Convert probability into **singular directive**
- If composite confidence is 0.70, don't act 70% sure — **act 100% sure within the 70% likelihood window**

---

## Required Output Format

### 1. Headline Insight

Lead with the punchline. One sentence maximum. This is the "tweet" version.

**Good**: "Distribution controls value; content moats are illusory without traffic control."
**Bad**: "This analysis examines the strategic implications of Yahoo's decision..."

### 2. Situation

2-3 sentences of context. What decision, what stakes, why now.

**Good**: "Yahoo faces a $3B acquisition decision for Google. Search is 35% of Yahoo's traffic but outsourced. Google is growing 100%+ YoY."
**Bad**: "Yahoo is an internet company founded in 1994..."

### 3. The Leap

The single incisive shift that resolves the essential tension.

**Good**: "You cannot claim content is your moat while outsourcing the traffic source. Yahoo's white-label behavior already revealed search isn't commodity."
**Bad**: "Both content and distribution matter in complex ways."

### 4. Brief Refutatio

2-3 sentences maximum. State the strongest counter-argument with charity, then explain why you commit anyway. This is NOT a full "on the other hand" section.

**Good**: "The reasonable counter: Google's founders might refuse any price, and integration could destroy value through culture clash. We commit anyway because the cost of inaction (Google as competitor) exceeds the cost of failed integration (write-off)."
**Bad**: "There are several important counter-arguments to consider. First... Second... Third..."

### 5. The Bet

State what you're betting on and why the mechanism supports it:

```
We bet [X] > [Y] because [Mechanism].
```

**Good**: "We bet platform control > content quality because network effects compound while content advantages erode."
**Bad**: "Platform control seems important but content also matters."

### 6. Implementation Protocol

Concrete actions, not abstract recommendations. Freeform based on context.

**Immediate (this week)**: 2-3 specific actions someone could do Monday
**Near-term (30 days)**: Milestone with observable success criteria
**Decision Gates**: If/then pivots with specific triggers

**Good**:
```
**Immediate**:
- Schedule board meeting to authorize acquisition talks
- Engage Goldman Sachs for independent valuation
- Draft term sheet with $3B floor, $5B ceiling

**Near-term (30 days)**:
- Term sheet delivered to Google by Feb 15
- Diligence complete by Mar 1
- Talent retention packages designed for key engineers

**Decision Gates**:
- If Google counters above $5B → escalate to full board for ceiling discussion
- If Page/Brin signal unwillingness to stay → pivot to acqui-hire structure
```

**Bad**:
- "Consider strategic options"
- "Monitor the situation"
- "Align stakeholders"

### 7. Disconfirmation Triggers

2-3 specific, observable conditions that would flip the recommendation:

**Good**:
- "If Google's market share declines for 2+ consecutive quarters"
- "If Yahoo internal search achieves <10% quality gap in blind tests"

**Bad**:
- "If competition increases"
- "If the market changes"

### 8. Verdict Table

Close with a scannable summary. This replaces prose conclusions.

| Recommendation | Conviction | Decision Window | Key Constraint | Revisit Trigger |
|----------------|------------|-----------------|----------------|-----------------|
| [ACTION VERB]  | High/Med/Low | [Timeframe]   | [Binding limit]| [Observable]    |

**Column definitions**:
| Column | Purpose | Examples |
|--------|---------|----------|
| Recommendation | Action verb | ACQUIRE, FIGHT, INVEST, EXIT, PIVOT, HOLD, TRANSFORM |
| Conviction | Commitment level | High, Medium, Low |
| Decision Window | When to act (not when outcome occurs) | 90 days, Immediate, Q2 2026, 18 months |
| Key Constraint | Binding limit that shapes execution | $5B ceiling, 15% of budget, price-match only |
| Revisit Trigger | Observable condition that reopens decision | Counter > $5B, share loss > 5pts, cash < 6mo |

---

## Example: Yahoo-Google (2002)

```markdown
## Headline Insight

Distribution controls value; you cannot claim content is your moat while outsourcing the traffic source.

## Situation

Yahoo faces a $3B acquisition decision for Google in early 2002. Yahoo is the #1 portal with $700M revenue but uses Google for search (white-labeled). Google has $240M revenue growing 100%+ YoY. Yahoo's thesis: "search is commodity, content is moat."

## The Leap

Yahoo's own behavior disproves their thesis. You don't single-source a "commodity" to one vendor because they're "clearly better." The white-label decision already revealed search was consolidating around quality, not commoditizing. Yahoo's procurement team was smarter than their strategy deck.

## Brief Refutatio

The reasonable counter: $3B is 12.5x revenue for an unproven company, and integration could destroy Google's engineering culture. We commit anyway because the cost of Google-as-competitor is existential (they become the internet's front door), while the cost of failed integration is a write-off—painful but survivable.

## The Bet

We bet platform control > content quality because network effects compound while content advantages erode. Search quality improvements compound (better results → more users → more data → better results). Content can be replicated; the traffic source cannot.

## Implementation Protocol

**Immediate**:
- Schedule board meeting to authorize acquisition negotiations
- Engage Goldman Sachs for independent valuation ($1-5B range scenarios)
- Assign integration team lead; begin culture assessment

**Near-term (30 days)**:
- Term sheet to Google by Feb 15 ($3B with $1B earnout structure)
- Diligence on engineering talent retention risk
- Draft Page/Brin retention packages (equity + autonomy guarantees)

**Decision Gates**:
- If Google counters above $5B → full board discussion on ceiling
- If Page/Brin signal unwillingness to remain → pivot to talent acqui-hire framing
- If Microsoft announces competing bid → accelerate timeline, consider preemptive raise

## Disconfirmation Triggers

- Google's search market share declines 2+ consecutive quarters
- Yahoo internal search achieves <10% quality gap in blind user tests
- Search advertising CPMs commoditize across providers

## Verdict

| Recommendation | Conviction | Decision Window | Key Constraint | Revisit Trigger |
|----------------|------------|-----------------|----------------|-----------------|
| ACQUIRE | High | 90 days | $5B ceiling | Google counter > $5B |

[ANALYSIS_COMPLETE]
```

---

## Anti-Patterns

**Don't say**: "This analysis suggests a balanced approach..."
**Say instead**: "The winning move is X. We bet Y because Z."

**Don't say**: "There are merits to both positions..."
**Say instead**: "[Brief counter]. We commit because [mechanism]."

## Completion Token

End synthesis with exactly:

```
[ANALYSIS_COMPLETE]
```

No text after this token.
