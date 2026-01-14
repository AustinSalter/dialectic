# Thesis Management Skill

## Trigger
Activate when the user wants to manage their belief system:
- "Create a thesis about..."
- "Update the thesis on..."
- "What theses do we have about [topic]?"
- "Is our [topic] thesis still valid?"
- "Archive/retire the thesis on..."
- "Show me theses related to [domain]"

## Purpose
Manage the persistent thesis library—the structured beliefs that shape agent reasoning. Theses are alive: they make predictions, specify falsification criteria, and update based on evidence.

## Core Operations

### 1. CREATE - New Thesis

**When**: User identifies a pattern or forms a belief worth tracking

**Process**:

1. **Elicit the Four Components** (per [HBR Investment Thesis Framework](https://hbr.org/2025/04/how-vcs-can-create-a-winning-investment-thesis)):

   a. **What We Know**: Establish foundational facts
   - Current market state and technology landscape
   - Applicable regulations and policies
   - Entry barriers and known limitations

   b. **What We Don't Know**: Acknowledge uncertainties
   - Future market conditions that could change
   - Potential regulatory shifts
   - Data gaps or outdated information

   c. **Core Belief**: The sharp, testable claim
   - Must be specific, not hedged into meaninglessness
   - Must have clear causal mechanism (why it's true)
   - Must have actionable implications

   d. **Validation KPIs**: What would prove it right/wrong
   - Specific metrics or events to monitor
   - Clear falsification criteria
   - Timeframe for testing

2. **Assign Initial Confidence**:
   - 0.90+: Multiple confirming evidence, strong causal model
   - 0.70-0.89: Solid evidence, some uncertainty
   - 0.50-0.69: Reasonable hypothesis, needs more data
   - <0.50: Speculative, use `testing` status

3. **Categorize**:
   - Domain: market-structure, ai-infrastructure, energy-power, geopolitical, operational, or new category
   - Tags: searchable keywords for retrieval

4. **Write to File**:
   - Location: `/memories/theses/{domain}/{thesis-id}.md`
   - Update `/memories/theses/_index.yaml` with metadata
   - Add relationships to related theses

**Output Format**:
```yaml
---
id: {kebab-case-id}
status: active | testing
confidence: 0.XX
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
domain: {domain}
tags: [tag1, tag2, ...]
related: [thesis-id-1, thesis-id-2]
---

# {Thesis Title}

## Thesis
{One crisp sentence}

## Causal Model
{Why this is true—the mechanism, not just correlation}

## Evidence
{Specific numbers, dates, sources}

## Implications
- **Look for**: ...
- **Interpret as bullish**: ...
- **Interpret as bearish**: ...
- **Ignore**: ...

## Falsification
- **Wrong if**: {Specific, testable conditions}
- **Watch for**: {Leading indicators}

## History
- {YYYY-MM-DD}: Initial thesis formed
```

---

### 2. READ - Query Theses

**When**: User asks about existing beliefs or needs context for analysis

**Operations**:

a. **List by Domain**:
   - Read `/memories/theses/_index.yaml`
   - Filter by domain or tags
   - Return summary with confidence levels

b. **Get Full Thesis**:
   - Read specific thesis file
   - Include related theses for context

c. **Search by Relevance**:
   - Match question against thesis tags and summaries
   - Return ranked list of relevant theses

**Output Format** (List):
```markdown
## Theses: {Domain}

| Thesis | Confidence | Summary |
|--------|------------|---------|
| [thesis-id](path) | 0.XX | One-line summary |
```

---

### 3. UPDATE - Refine Thesis

**When**: New evidence supports or challenges an existing thesis

**Critical Rule - Avoid Thesis Drift**:
> "Investors commonly remark that they must avoid 'thesis shift.' This is when new evidence disconfirms your existing thesis, but instead of abandoning it, you decide to reformulate your thesis to incorporate the new evidence. A modified thesis has a higher probability of being wrong." — [Speedwell Research](https://speedwellresearch.com/2024/12/13/what-is-a-fair-investment-assumption/)

**Process**:

1. **Classify the Evidence**:
   - CONFIRMS: Strengthens confidence
   - CHALLENGES: Weakens confidence
   - NEUTRAL: No impact

2. **If CONFIRMS**:
   - Increase confidence (max +0.10 per update)
   - Add evidence to thesis file
   - Update `History` section

3. **If CHALLENGES**:
   - **Minor challenge**: Decrease confidence, add counter-evidence
   - **Major challenge**: Consider falsification (see ARCHIVE)
   - **DO NOT** rewrite the thesis to accommodate disconfirming evidence

4. **Update Metadata**:
   - Update `updated` date
   - Add to `History` section
   - Update `_index.yaml` confidence

**Output Format**:
```markdown
## Thesis Update: {thesis-id}

**Prior Confidence**: 0.XX
**New Evidence**: {summary}
**Classification**: CONFIRMS | CHALLENGES | NEUTRAL
**New Confidence**: 0.XX
**Rationale**: {why confidence changed}

Updated thesis file at: {path}
```

---

### 4. ARCHIVE - Retire Thesis

**When**: A thesis is proven wrong or superseded

**Statuses**:
- `wrong`: Falsified by evidence (valuable negative knowledge)
- `superseded`: Replaced by updated thesis

**Process**:

1. **For Wrong Theses**:
   - Document the falsifying evidence
   - Move to `/memories/theses/archive/wrong/`
   - Update status to `wrong`
   - Add to `_index.yaml` archive section
   - **Preserve as negative knowledge**—knowing what's wrong is valuable

2. **For Superseded Theses**:
   - Link to the new thesis that replaces it
   - Move to `/memories/theses/archive/superseded/`
   - Update status to `superseded`
   - Add `superseded_by` field

**Output Format**:
```markdown
## Thesis Archived: {thesis-id}

**Status**: wrong | superseded
**Reason**: {falsifying evidence or link to new thesis}
**Archived to**: {new path}

This thesis is now part of our negative knowledge base.
```

---

### 5. VALIDATE - Test Against Evidence

**When**: Running analysis or reviewing thesis health

**Process**:

1. **Load Thesis**
2. **Check Each Falsification Criterion**:
   - Has this condition occurred?
   - What's the current state of "Watch for" indicators?
3. **Assess Evidence Freshness**:
   - Is the evidence dated?
   - Have market conditions changed?
4. **Report Thesis Health**

**Output Format**:
```markdown
## Thesis Validation: {thesis-id}

**Confidence**: 0.XX
**Last Updated**: {date}

### Falsification Check
| Criterion | Current Status | Assessment |
|-----------|----------------|------------|
| {criterion 1} | {current state} | SAFE | AT RISK | TRIGGERED |

### Evidence Freshness
- {evidence item}: {age} — {OK | STALE | OUTDATED}

### Recommendation
{Keep active | Update needed | Consider archiving}
```

---

## Thesis Quality Checklist

Before saving any thesis, verify:

- [ ] **Sharp**: One clear claim, not hedged
- [ ] **Testable**: Explicit falsification criteria
- [ ] **Causal**: Explains mechanism, not just correlation
- [ ] **Actionable**: Clear implications for decisions
- [ ] **Evidenced**: Specific numbers, dates, sources
- [ ] **Timebound**: When would we know if it's wrong?

---

## Anti-Patterns

1. **Thesis Drift**: Rewriting thesis to fit disconfirming evidence
2. **Unfalsifiable Claims**: "Could" and "might" without specifics
3. **Stale Evidence**: Using 2022 data for 2025 thesis
4. **Missing Mechanism**: Correlation without causation
5. **Confidence Anchoring**: Not updating confidence as evidence accumulates
6. **Orphan Theses**: Theses with no connection to decisions

---

## Integration with Strategy Protocol

When running strategic analysis (strategy-protocol skill):

1. **Pass 0**: Load relevant theses based on question domain/tags
2. **Pass 2 (Validation)**: Check insights against thesis implications
3. **Synthesis**: Note which theses were confirmed/challenged
4. **Post-Analysis**: Queue thesis updates for review

---

## Sources

This skill incorporates best practices from:
- [HBR: How VCs Create a Winning Investment Thesis](https://hbr.org/2025/04/how-vcs-can-create-a-winning-investment-thesis)
- [Street of Walls: Building an Investment Thesis](https://www.streetofwalls.com/finance-training-courses/hedge-fund-training/building-an-investment-thesis/)
- [Speedwell Research: Fair Investment Assumptions](https://speedwellresearch.com/2024/12/13/what-is-a-fair-investment-assumption/)
