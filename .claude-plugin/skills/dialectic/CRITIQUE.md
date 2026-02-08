---
name: dialectic-critique
description: Test thesis adequacy against gathered evidence and selected frame. Use after expansion pass to determine if thesis actually protects what it claims. Runs meta-probes, checks preservation gate, outputs Continue/Conclude/Elevate decision.
---

# Critique Pass

Test whether thesis *actually protects* what it claims to protect.

## Input Required

Needs completed expansion with:
- Frame (protecting, altitude, domain)
- Evidence (supporting, challenging)
- Tensions identified

If no expansion exists, run expansion first.

## Meta-Probes

Run all five against the framed thesis:

| Probe | Question | Failure Mode |
|-------|----------|--------------|
| Contingency | Does this depend on something that could change? | Temporary vs structural |
| Mechanism | Is the causal path specified? | Assertion without causation |
| Anomaly | Is counter-evidence addressed? | Ignored disconfirmation |
| Model Dependency | Do model assumptions still hold? | Outdated model |
| Implementation | Does this assume rational response? | Perverse/irrational response |

**For domain-specific probes:** See patterns/{domain}.md

## Preservation Gate (Required)

Cannot decide without answering:

1. **What does thesis correctly identify?** (sound content)
2. **What does thesis correctly frame?** (valuable framing)
3. **What must any elevation retain?** (non-negotiables)

*If you can't complete this, you haven't understood the thesis. Return to expansion.*

## Decision

| Decision | When | Required Output |
|----------|------|-----------------|
| CONTINUE | Evidence gaps exist, addressable with data | What specific data resolves it? |
| CONCLUDE | Thesis robust at right altitude | The bet + falsification trigger |
| ELEVATE | Wrong altitude OR internal tension | Elevated thesis + what it preserves + what it resolves |

**CONCLUDE only when you can state:**
- The bet: "X > Y because mechanism Z"
- Falsification: What specific conditions would flip this?

**ELEVATE requires:**
- The elevated thesis (what it was reaching for)
- What it preserves from original
- What tension it resolves

## Output Format

```yaml
probes:
  contingency: [STRUCTURAL | CONTINGENT] — [why]
  mechanism: [SPECIFIED | MISSING] — [why]
  anomaly: [ADDRESSED | IGNORED] — [what]
  model_dependency: [VALID | CHANGED | N/A] — [why]
  implementation: [REALISTIC | ASSUMES_RATIONAL] — [why]

preservation:
  correctly_identifies: [specific sound content]
  correctly_frames: [valuable framing to keep]
  must_retain: [non-negotiable elements]

decision: [CONTINUE | CONCLUDE | ELEVATE]

# Include ONE of the following based on decision:

if_continue:
  data_needed: [specific gaps]
  resolution_conditions: [what would decide]

if_conclude:
  the_bet: "[X] > [Y] because [mechanism Z]"
  falsification: [specific conditions that would flip]

if_elevate:
  original_thesis: [as stated]
  elevated_thesis: [what it's really trying to say]
  preserves: [from original]
  resolves: [what tension]
```

## Example: Stripe (After Expansion)

**Input from expansion:**
```yaml
frame:
  protecting: Investment in payments company
  altitude: TOO_GRANULAR → needs elevation to infrastructure
  domain: Infrastructure
evidence:
  supporting: [YC adoption, platform expansion]
  challenging: [features copyable]
tensions:
  - PayPal founders investing against own company
```

**Critique:**

```yaml
probes:
  contingency: CONTINGENT — "better docs" can be copied
  mechanism: MISSING — no causal path from features to durable advantage
  anomaly: IDENTIFIED — PayPal founders' investment unexplained by "better product" thesis
  model_dependency: N/A — no model cited
  implementation: N/A — not a policy thesis

preservation:
  correctly_identifies: Developer experience matters for adoption
  correctly_frames: Payments as infrastructure, not product
  must_retain: Developer-centric insight

decision: ELEVATE

if_elevate:
  original_thesis: "Stripe has better documentation and easier integration"
  elevated_thesis: "Developer experience is the wedge into financial infrastructure. Companies choose payment APIs early, before procurement. Once integrated, Stripe becomes merchant of record, compliance layer, billing system. Switching costs compound. The moat isn't docs—it's infrastructure lock-in."
  preserves: Developer experience as key lever
  resolves: Why PayPal founders would invest against their own company (they see infrastructure play, not product competition)
```

## Quick Reference: Domain Patterns

| Domain | Key Probes | File |
|--------|------------|------|
| Marketplace | Liquidity, geographic scope, trust portability | patterns/marketplace.md |
| Infrastructure | Decision-maker, switching costs, copyability | patterns/infrastructure.md |
| Financial | Model regime, correlation, counterparty, incentives | patterns/financial.md |
| Policy | Implementation gap, precedent validity, institutional response | patterns/policy.md |
| Disruption | Incumbent response, cost curve, metric shift, physics vs politics | patterns/disruption.md |
