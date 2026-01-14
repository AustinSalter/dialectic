# Multi-Pass Reasoning Harness

## Trigger
Activate for any complex strategic question requiring deep analysis. This skill implements iterative scratchpad → compress cycles that enable higher-order reasoning than single-pass generation.

## Core Principle

**Single-pass generation conflates thinking and reporting.** The model simultaneously explores, validates, prioritizes, and formats—producing either shallow thinking (rushed to output) or verbose output (couldn't compress).

**Multi-pass separates concerns:**
- **Expansion**: Explore freely without premature convergence
- **Compression**: Distill to decision-relevant insights
- **Iteration**: Continue until analysis is complete, not at fixed N

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  REASONING LOOP                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── CYCLE until TERMINATE ───┐                                │
│  │                             │                                │
│  │  SCRATCHPAD (Expansion)     │  Think freely, mark findings   │
│  │  ├── Explore the space      │  No filtering, no structure    │
│  │  ├── Mark with tags         │  Breadcrumbs for compression   │
│  │  ├── Follow threads         │  Second-order, third-order...  │
│  │  └── Query tools if needed  │  Data to inform exploration    │
│  │                             │                                │
│  │  COMPRESS (Distillation)    │  Extract signal from noise     │
│  │  ├── What matters for the   │  Decision-relevance filter     │
│  │  │   decision at hand?      │                                │
│  │  ├── What's high confidence │  Assign confidence scores      │
│  │  │   vs speculative?        │                                │
│  │  ├── What tensions remain?  │  Unresolved conflicts          │
│  │  └── Update working memory  │  Carry forward to next cycle   │
│  │                             │                                │
│  │  TERMINATE?                 │  Dynamic decision              │
│  │  ├── CONTINUE if:           │                                │
│  │  │   - New threads opened   │  Expansion found new ground    │
│  │  │   - Confidence < 0.7     │  Key claims still uncertain    │
│  │  │   - Tensions unresolved  │  Conflicting evidence remains  │
│  │  │   - Depth not reached    │  Second-order not explored     │
│  │  │                          │                                │
│  │  ├── STOP if:               │                                │
│  │  │   - Saturation reached   │  No new insights emerging      │
│  │  │   - Confidence > 0.7     │  Core claims validated         │
│  │  │   - Tensions resolved    │  Clear path forward            │
│  │  │   - Depth sufficient     │  Higher-order effects mapped   │
│  │  │                          │                                │
│  └──────────────────────────────┘                                │
│                                                                  │
│  SYNTHESIZE (Final)             │  Produce structured output    │
│  ├── Recommendation             │  Clear, actionable            │
│  ├── Confidence + reasoning     │  Show the work                │
│  ├── What would change this     │  Flip conditions              │
│  └── Key uncertainties          │  Honest about gaps            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Semantic Tags (Compression Breadcrumbs)

These tags mark content during expansion for efficient compression. They are **retrieval markers**, not the insight itself.

| Tag | Purpose | Compression Action |
|-----|---------|-------------------|
| `[INSIGHT]` | Non-obvious finding | KEEP if evidence supports |
| `[EVIDENCE]` | Specific data point | KEEP as support for insights |
| `[RISK]` | Potential downside | KEEP, assess severity |
| `[COUNTER]` | Argument against | KEEP, must address |
| `[TENSION]` | Conflicting evidence | RESOLVE or carry forward |
| `[QUESTION]` | Needs investigation | ANSWER or flag as uncertainty |
| `[THREAD]` | Worth exploring deeper | FOLLOW in next expansion |

**During expansion**: Tag liberally. Over-tag rather than under-tag.
**During compression**: Use tags to efficiently scan for what matters.

---

## Working Memory Structure

Between cycles, maintain this state:

```yaml
working_memory:
  cycle: 1  # Current cycle number

  insights:  # Validated findings
    - claim: "..."
      confidence: 0.XX
      evidence: ["..."]

  tensions:  # Unresolved conflicts
    - description: "..."
      sides: ["...", "..."]
      resolution_attempted: false

  threads:  # Worth exploring next
    - topic: "..."
      why: "..."

  confidence:  # Overall assessment
    recommendation: 0.XX
    key_claims:
      - claim: "..."
        confidence: 0.XX

  termination:
    should_continue: true/false
    reason: "..."
```

---

## Expansion Phase Instructions

**Goal**: Explore the problem space freely. Generate observations, follow threads, query data.

**Mindset**: You are thinking out loud. This is a scratchpad, not a deliverable.

**Instructions**:

1. **Start with the core question**: What's actually being asked? What decision does this inform?

2. **Explore first-order effects**: What are the direct implications of each option/claim?

3. **Push to second-order**: "And then what?" For each first-order effect, what follows?

4. **Push to third-order if warranted**: Some problems require seeing three moves ahead.

5. **Challenge the frame**: Is the question itself well-posed? What assumptions does it embed?

6. **Query tools when needed**: Get data to inform exploration, but don't let data gathering replace thinking.

7. **Tag as you go**: Mark findings for compression. Don't worry about over-tagging.

8. **Follow [THREAD] markers**: When you note something worth exploring, actually explore it.

**Quality signals for good expansion**:
- Multiple [COUNTER] tags (you're not just confirming the obvious)
- At least one [TENSION] (you've found conflicting evidence)
- [THREAD] tags that got followed (you went deep, not just wide)
- Second-order effects explored (you asked "and then what?")

---

## Compression Phase Instructions

**Goal**: Distill expansion to decision-relevant insights. Assign confidence. Identify what's resolved vs. unresolved.

**Process**:

1. **Scan expansion for tags**: Use markers to quickly find candidate insights

2. **For each [INSIGHT]**:
   - Is there supporting [EVIDENCE]?
   - Does any [COUNTER] significantly weaken it?
   - Assign confidence (0.0-1.0):
     - 0.90+: Multiple evidence, no significant counters
     - 0.70-0.89: Solid evidence, some uncertainty
     - 0.50-0.69: Reasonable hypothesis, needs more data
     - <0.50: Speculative, significant counters exist

3. **For each [TENSION]**:
   - Can it be resolved with the evidence at hand?
   - If yes: resolve it, note the resolution
   - If no: carry forward to next cycle or flag as key uncertainty

4. **For each [THREAD]**:
   - Was it followed in this expansion?
   - If no and still relevant: add to threads for next cycle

5. **Update working memory**:
   - Add validated insights with confidence
   - Update tension status
   - List threads for next cycle
   - Assess: should we continue?

**Output format for compression**:

```markdown
## Cycle N Compression

### Validated Insights
1. [Claim] — Confidence: 0.XX
   - Evidence: ...
   - Counters addressed: ...

### Tensions
- [Resolved] [Description] — Resolution: ...
- [Unresolved] [Description] — Needs: ...

### Threads for Next Cycle
- [Topic] — Why: ...

### Termination Assessment
- Should continue: YES/NO
- Reason: [saturation/confidence/unresolved/depth]
```

---

## Termination Logic

**CONTINUE** to next cycle if ANY of these are true:
- New [THREAD] tags opened but not yet explored
- Any key insight has confidence < 0.7
- Any critical [TENSION] remains unresolved
- Second-order effects not yet mapped
- Compression revealed gaps in expansion

**STOP** and synthesize if ALL of these are true:
- No new threads worth exploring
- Key insights at confidence > 0.7
- Critical tensions resolved or acknowledged
- Sufficient depth for the decision at hand

**Maximum cycles**: 5 (prevent infinite loops, but aim for 2-3 typically)

---

## Synthesis Phase Instructions

**Goal**: Produce structured output that enables a decision.

**Trigger**: Only run synthesis when termination criteria are met.

**Structure**:

```markdown
## [Topic] Analysis

### Recommendation
**Action**: [Clear, specific recommendation]
**Confidence**: X.XX
**Key Condition**: [What must remain true for this to hold]

### Reasoning
[2-3 paragraphs explaining the logic. Reference key insights.]

### What Would Change This
1. [Specific condition that would flip the recommendation]
2. [Another flip condition]
3. [Third flip condition if relevant]

### Key Uncertainties
- [What we don't know that matters]
- [Another uncertainty]

### Risks to Monitor
| Risk | Likelihood | Impact | Trigger |
|------|------------|--------|---------|
| ... | H/M/L | H/M/L | [What to watch] |
```

---

## Anti-Patterns

1. **Premature synthesis**: Don't jump to recommendations before expansion is complete

2. **Shallow expansion**: Just listing pros/cons is not exploration. Push to second-order effects.

3. **Compression without confidence**: Every validated insight needs a confidence score

4. **Ignoring counters**: If you tagged [COUNTER], you must address it in compression

5. **Fixed N**: Don't stop at 3 cycles because "that's the process." Stop when done.

6. **Verbose synthesis**: Synthesis should be tight. The work happened in expansion/compression.

7. **Hiding uncertainty**: If confidence is low, say so. Don't hedge with weasel words.

---

## Example Cycle

**Question**: "Should we enter the European market given current competitive dynamics?"

**Cycle 1 Expansion** (scratchpad):
```
Let me think through this...

[INSIGHT] European market is fragmented - no single dominant player holds >15% share. This suggests opportunity for a focused entrant.

[EVIDENCE] Top 5 players combined have 45% share vs 78% in US market.

[COUNTER] Fragmentation might reflect structural barriers (regulatory, language, logistics) rather than opportunity. Need to investigate why no one has consolidated.

[THREAD] What happened to previous US entrants? Did they fail, and why?

[RISK] GDPR compliance costs could be 2-3x higher than US privacy compliance.

[TENSION] Market is large ($4B) but growth is slowing (8% -> 4% YoY). Is this maturation or saturation?

[THREAD] What does the regulatory pipeline look like? Any changes that could help or hurt?

[QUESTION] Do we have the operational capability to handle 6+ languages for customer support?
```

**Cycle 1 Compression**:
```markdown
## Cycle 1 Compression

### Validated Insights
1. European market fragmentation creates entry opportunity — Confidence: 0.55
   - Evidence: Top 5 at 45% combined share
   - Counters: Fragmentation might be structural (needs investigation)

### Tensions
- [Unresolved] Large market vs slowing growth — Needs: Historical analysis

### Threads for Next Cycle
- Previous US entrant failures — Why: Need to learn from precedent
- Regulatory pipeline — Why: Could change competitive dynamics

### Termination Assessment
- Should continue: YES
- Reason: Key insight at 0.55 confidence, two threads unexplored
```

**Cycle 2**: Would explore the threads, investigate the fragmentation question, etc.

---

## Integration Notes

This skill replaces the single-pass strategy-protocol for complex questions. For simple queries (definition lookups, quick calculations), skip the harness and respond directly.

Indicators that harness is needed:
- Question involves tradeoffs
- Multiple valid approaches exist
- Second-order effects matter
- Stakes are high
- Uncertainty is significant
