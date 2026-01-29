# Strategic Patterns Library

Domain-specific patterns for market structure detection and strategic framing. This library is seedable - add patterns for new domains as needed.

---

## Market Structure Patterns

### Winner-Take-Most (WTM)

**Defining characteristics:**
- Network effects present (direct or indirect)
- Tipping point dynamics
- Winner captures 70-90% of value
- Second place is viable but marginal

**Historical exemplars:**

| Case | Year | Winner | Loser | Tipping Signal |
|------|------|--------|-------|----------------|
| Online Auctions | 1998-2000 | eBay | Yahoo Auctions | Seller liquidity concentration |
| Social Networks | 2005-2008 | Facebook | MySpace | College network density |
| Ride-sharing | 2012-2016 | Uber | Lyft | Driver/rider liquidity by city |
| Short-term Rentals | 2011-2015 | Airbnb | Wimdu, HomeAway | Supply quality + review density |
| Search | 1998-2002 | Google | Yahoo, AltaVista | Query → result quality loop |

**Detection signals:**
- Two-sided marketplace
- Cross-side network effects
- "Land grab" language
- Aggressive unit economics (growth over profit)
- Competitor acquisition attempts

**Critique implications:**
- "Wait and acquire" success rate: ~5%
- Due diligence delay may be the primary risk
- Asymmetric payoff: cost of aggression << cost of losing market

---

### Winner-Take-All (WTA)

**Defining characteristics:**
- Platform lock-in / high switching costs
- Standards competition
- Second place = zero (not just marginal)
- Often technology/infrastructure markets

**Historical exemplars:**

| Case | Year | Winner | Loser | Lock-in Mechanism |
|------|------|--------|-------|-------------------|
| Desktop OS | 1985-1995 | Microsoft | Apple, OS/2 | ISV application library |
| Mobile OS | 2008-2012 | iOS/Android | BlackBerry, Windows Phone | App store ecosystem |
| Cloud Infrastructure | 2010-2018 | AWS | Azure (caught up), Others | Enterprise migration costs |
| Video Streaming (early) | 2007-2012 | Netflix | Blockbuster | Content licensing + catalog |

**Detection signals:**
- API/ecosystem lock-in
- Developer platform dynamics
- "Standards war" language
- High customer switching costs
- Incumbent with distribution fighting new entrant with technology

**Critique implications:**
- Second place may not be viable at all
- "Catch up later" almost never works
- Faster to concede and find adjacent market than fight losing WTA battle

---

### Disruption (Christensen Pattern)

**Defining characteristics:**
- Incumbent's profit center = vulnerability
- New entrant starts with "worse" product
- Incumbent rationally ignores (margins too low)
- Entrant improves until good enough for mainstream

**Historical exemplars:**

| Case | Year | Disruptor | Disrupted | Incumbent's Blindspot |
|------|------|-----------|-----------|----------------------|
| Steel | 1970s-1990s | Mini-mills | US Steel | Rebar margins too low |
| Disk Drives | 1980s-1990s | 5.25" → 3.5" | Each generation | New form factor customers |
| Streaming | 2007-2015 | Netflix | Blockbuster | Late fees = profit center |
| Digital Photography | 1990s-2000s | Digital cameras | Kodak | Film margins |
| Electric Vehicles | 2012-present | Tesla | Legacy OEMs | ICE manufacturing infrastructure |

**Detection signals:**
- "Worse product winning somewhere"
- "We could do that but margins are terrible"
- New entrant targeting non-consumption or low-end
- Incumbent's best customers don't want the new thing

**Critique implications:**
- Incumbent logic is internally consistent but strategically fatal
- "Our customers don't want that" may be correct AND irrelevant
- Self-cannibalization almost always preferable to competitor cannibalization

---

### Gradual Share Competition

**Defining characteristics:**
- Multiple stable equilibria possible
- Incremental competition
- No tipping points
- Market share gains/losses are continuous

**Historical exemplars:**

| Case | Market | Equilibrium |
|------|--------|-------------|
| Cola | Soft drinks | Coke ~45%, Pepsi ~25%, others |
| Airlines | US domestic | Top 4 each ~15-25% |
| Banks | US retail | Top 5 each ~10-15% |
| CPG | Most categories | Multiple brands viable |

**Detection signals:**
- Established players with stable shares
- No network effects
- Customer switching is possible and happens
- Brand/preference differentiation > technology differentiation

**Critique implications:**
- Standard cost/benefit analysis applies
- "Wait and see" may be reasonable
- Incremental improvement strategies viable

---

### Commodity Dynamics

**Defining characteristics:**
- Low differentiation
- Price is primary decision factor
- Margins compress over time
- No sustainable competitive advantage

**Historical exemplars:**

| Case | Commodity Trigger |
|------|------------------|
| PC Hardware | Wintel standardization |
| DRAM | Technology standardization |
| Airlines (leisure routes) | Price transparency |
| Generic Pharma | Patent expiration |

**Detection signals:**
- "Price war" language
- Declining margins industry-wide
- Customer switching with zero friction
- Products/services functionally identical

**Critique implications:**
- Differentiation claims should be heavily scrutinized
- "We're different" often wishful thinking
- Exit or consolidation may be best strategy

---

## Domain-Specific Pattern Seeders

### Technology / Platform Markets

**Default assumption**: Check for WTM/WTA first
- Most tech markets have some network effect
- API/ecosystem dynamics common
- "Disruption" pattern relevant for incumbents

**Key questions:**
- Is there a platform layer? (If yes → likely WTM/WTA)
- Are there cross-side network effects? (If yes → likely WTM)
- Is there developer ecosystem lock-in? (If yes → likely WTA)

### Consumer Goods / Retail

**Default assumption**: Check for Gradual Share or Commodity
- Brand matters but switching possible
- Multiple equilibria common
- Disruption less common (but see D2C trends)

**Key questions:**
- Can customers easily switch? (If yes → Gradual or Commodity)
- Is price the primary decision factor? (If yes → Commodity)
- Is there a digital/platform dimension? (If yes → check for WTM patterns)

### B2B / Enterprise

**Default assumption**: Check for switching costs
- High switching costs can create WTA dynamics
- Long sales cycles slow tipping
- Incumbent advantage stronger

**Key questions:**
- What are customer switching costs? (If high → WTA-like dynamics)
- Is there standards competition? (If yes → likely WTA)
- Is procurement price-driven? (If yes → Commodity tendencies)

### Media / Entertainment

**Default assumption**: Check for attention dynamics
- Attention is zero-sum → WTM tendencies
- But multiple successful properties possible
- Content vs distribution distinction matters

**Key questions:**
- Is this distribution or content? (Distribution → more WTA; Content → more Gradual)
- Are there network effects in consumption? (Social viewing, recommendations → WTM)
- Is attention fragmenting or consolidating? (Consolidating → WTA)

---

## Using This Library

### In Critique (Phase 0)

1. **Identify domain** from case context
2. **Check domain-specific seeder** for default assumption
3. **Look for detection signals** in case materials
4. **Match to historical exemplars** for analogical reasoning
5. **Apply critique implications** based on detected structure

### Adding New Patterns

When encountering a new domain or pattern:

1. **Document the pattern** with defining characteristics
2. **Add historical exemplars** with specific cases
3. **Identify detection signals** that indicate this pattern
4. **Note critique implications** for how analysis should differ
5. **Add to domain seeder** if domain-specific

### Pattern Conflicts

Sometimes cases exhibit multiple patterns:

- **Disruption + WTA**: Disruptor is building WTA platform (e.g., Netflix)
- **WTM + Commodity**: WTM in platform layer, commodity in product layer
- **Gradual + Disruption**: Gradual incumbent facing potential disruption

When patterns conflict, weight by **which dynamic dominates the strategic decision**:
- If deciding about platform investment → weight WTA/WTM
- If deciding about product differentiation → weight Gradual/Commodity
- If deciding about incumbent response → weight Disruption

---

## Asymmetric Payoff Structures by Pattern

| Pattern | Cost of Aggressive Action | Cost of Inaction | Asymmetry |
|---------|--------------------------|------------------|-----------|
| **WTA** | $$$ (recoverable) | Business viability (unrecoverable) | **Favor action** |
| **WTM** | $$$ (recoverable) | Major value destruction | **Favor action** |
| **Disruption (incumbent)** | Cannibalization | Obsolescence | **Favor action** |
| **Disruption (entrant)** | Overextension | Missing window | Balanced |
| **Gradual Share** | Overinvestment | Gradual decline | Balanced |
| **Commodity** | Margin destruction | Continued margin compression | **Favor exit** |

---

*Last updated: 2026-01-16*
*To add domain-specific patterns, create a new section or extend existing seeders.*
