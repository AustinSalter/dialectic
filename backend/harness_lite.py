"""
Multi-Pass Reasoning Harness (Lite)

A simplified version using direct Anthropic API that implements
the validated architecture from TESTING.md without full SDK dependency.

This can be used when Agent SDK isn't installed, or for testing.
"""

import asyncio
import json
import os
import re
from typing import Callable, Any
from dataclasses import dataclass, field
from datetime import datetime

import httpx

from scratchpad import Scratchpad, SEMANTIC_MARKERS
from thesis_router import ThesisRouter, RouteType, RouterResult


# Six questioning techniques from EXP-007
SIX_QUESTIONING_TECHNIQUES = """
## Six Questioning Techniques

1. **INVERSION**: What if the opposite were true?
2. **SECOND-ORDER**: What are the downstream effects?
3. **FALSIFICATION**: What evidence would disprove this?
4. **BASE RATES**: What do historical priors suggest?
5. **INCENTIVE AUDIT**: Who benefits from this being believed?
6. **ADVERSARY SIMULATION**: How would a smart skeptic attack this?
"""


@dataclass
class PassResult:
    """Result from a single pass"""
    pass_type: str
    content: str
    confidence: float
    duration_ms: int
    tokens_used: int
    insights_found: int = 0  # New insights extracted (for diminishing returns)
    major_flaws_found: int = 0  # COUNTER + RISK markers (for re-expansion trigger)


@dataclass
class HarnessResult:
    """Final result from multi-pass harness"""
    session_id: str
    title: str
    passes: list[PassResult] = field(default_factory=list)
    final_synthesis: str = ""
    final_confidence: float = 0.5
    confidence_trajectory: list[float] = field(default_factory=list)
    trajectory_analysis: dict = field(default_factory=dict)
    termination_reason: str = ""
    total_duration_ms: int = 0
    total_tokens: int = 0
    scratchpad: Scratchpad | None = None


class MultiPassHarnessLite:
    """
    Multi-pass reasoning using direct Anthropic API.

    Implements:
    - Expansion with semantic markers
    - Compression preserving marked content
    - Critique with 6 questioning techniques
    - Scratchpad for accumulated context
    """

    API_URL = "https://api.anthropic.com/v1/messages"
    MODEL = "claude-sonnet-4-20250514"

    def __init__(
        self,
        api_key: str | None = None,
        max_cycles: int = 5,
        on_progress: Callable[[str, Any], None] | None = None,
        analysis_mode: str = "retrospective",  # "forward" or "retrospective"
    ):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY required")

        self.max_cycles = max_cycles
        self.analysis_mode = analysis_mode  # forward = predicting, retrospective = post-mortem
        # Default to async no-op if no progress handler provided
        async def noop(*_): pass
        self.on_progress = on_progress or noop
        self.scratchpad: Scratchpad | None = None
        self.passes: list[PassResult] = []
        self.router = ThesisRouter()
        self.router_result: RouterResult | None = None

    async def _call_claude(
        self,
        system: str,
        user: str,
        max_tokens: int = 4096,
        retries: int = 3,
    ) -> tuple[str, int]:
        """Make API call to Claude with retry logic"""
        import asyncio

        last_error = None
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(timeout=180.0) as client:
                    response = await client.post(
                        self.API_URL,
                        headers={
                            "x-api-key": self.api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json",
                        },
                        json={
                            "model": self.MODEL,
                            "max_tokens": max_tokens,
                            "system": system,
                            "messages": [{"role": "user", "content": user}],
                        },
                    )
                    response.raise_for_status()
                    data = response.json()

                content = data["content"][0]["text"]
                tokens = data["usage"]["output_tokens"]
                return content, tokens

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_error = e
                if attempt < retries - 1:
                    wait_time = (2 ** attempt) * 2  # 2, 4, 8 seconds
                    print(f"  [RETRY] Attempt {attempt + 1} failed, waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)

        raise last_error

    async def run(
        self,
        title: str,
        claims: list[dict],
        initial_context: str = "",
    ) -> HarnessResult:
        """Run multi-pass reasoning"""
        start_time = datetime.now()
        session_id = f"harness-{int(start_time.timestamp())}"

        # Initialize scratchpad with analysis mode
        self.scratchpad = Scratchpad(session_id=session_id, title=title)
        self.scratchpad.confidence_model.analysis_mode = self.analysis_mode
        self.passes = []

        # Add claims
        for claim in claims:
            self.scratchpad.add_claim(
                claim_id=claim.get('id', ''),
                text=claim.get('text', ''),
                claim_type=claim.get('type', 'claim'),
                snippet=claim.get('snippet', ''),
            )

        # PASS 0: Thesis routing
        self.router_result = self.router.route_with_enhancement(title, claims)

        await self.on_progress('initialized', {
            'session_id': session_id,
            'claims': len(claims),
            'route_type': self.router_result.route_type.value,
            'route_confidence': self.router_result.confidence,
            'matched_theses': [t.id for t in self.router_result.matched_theses],
            'matched_patterns': [p.id for p in self.router_result.matched_patterns],
        })

        total_tokens = 0
        termination_reason = None

        # Run cycles
        while True:
            self.scratchpad.increment_cycle()
            cycle = self.scratchpad.cycle_count
            cycle_insights = 0  # Track insights for diminishing returns detection
            await self.on_progress('cycle_start', {'cycle': cycle})

            # EXPANSION
            expansion = await self._run_expansion(cycle)
            self.passes.append(expansion)
            total_tokens += expansion.tokens_used
            cycle_insights += expansion.insights_found
            await self.on_progress('expansion_complete', {'cycle': cycle, 'confidence': expansion.confidence, 'tokens': expansion.tokens_used})

            # COMPRESSION
            compression = await self._run_compression(cycle)
            self.passes.append(compression)
            total_tokens += compression.tokens_used
            cycle_insights += compression.insights_found
            await self.on_progress('compression_complete', {'cycle': cycle, 'confidence': compression.confidence, 'tokens': compression.tokens_used})

            # CRITIQUE
            critique = await self._run_critique(cycle)
            self.passes.append(critique)
            total_tokens += critique.tokens_used
            cycle_insights += critique.insights_found
            await self.on_progress('critique_complete', {
                'cycle': cycle,
                'confidence': critique.confidence,
                'confidence_model': self.scratchpad.confidence_model.summary,
                'tokens': critique.tokens_used,
                'major_flaws': critique.major_flaws_found,
            })

            # RE-EXPANSION: If critique found major flaws, run targeted re-expansion
            if critique.major_flaws_found >= 3 and cycle < self.max_cycles:
                await self.on_progress('re_expansion_triggered', {'cycle': cycle, 'flaws': critique.major_flaws_found})

                # Targeted re-expansion on identified flaws
                re_expansion = await self._run_targeted_expansion(cycle, critique.content)
                self.passes.append(re_expansion)
                total_tokens += re_expansion.tokens_used
                cycle_insights += re_expansion.insights_found
                await self.on_progress('re_expansion_complete', {'cycle': cycle, 'insights': re_expansion.insights_found})

                # Re-compress after targeted expansion
                re_compression = await self._run_compression(cycle)
                self.passes.append(re_compression)
                total_tokens += re_compression.tokens_used
                cycle_insights += re_compression.insights_found
                # Don't re-critique immediately (avoid infinite loop)

            # Record insight count for this cycle (for diminishing returns detection)
            self.scratchpad.record_cycle_insights(cycle_insights)

            # BRANCHING: Check if conditions warrant creating branches
            if self.scratchpad.should_branch():
                branch_proposals = self.scratchpad.extract_branch_proposals()
                await self.on_progress('branching_triggered', {
                    'cycle': cycle,
                    'confidence': self.scratchpad.current_confidence,
                    'proposals': len(branch_proposals),
                })

                # Create branches for each proposal
                for proposal in branch_proposals[:self.scratchpad.MAX_BRANCHES - len(self.scratchpad.get_active_branches())]:
                    branch = self.scratchpad.create_branch(proposal)
                    await self.on_progress('branch_created', {'branch_id': branch.id, 'thesis': proposal[:80]})

                # Clear processed proposals
                self.scratchpad.clear_branch_proposals()

                # Run one cycle on each active branch
                branch_results = await self._run_branch_cycles(cycle)
                total_tokens += sum(r['tokens'] for r in branch_results)

            # Check termination (now uses combined strategy from EXP-010)
            termination_reason = self.scratchpad.check_termination(self.max_cycles)
            if termination_reason:
                await self.on_progress('terminating', {'reason': termination_reason, 'cycle_insights': cycle_insights})
                break

        # Final synthesis (with branch merging if branches exist)
        synthesis = await self._run_synthesis()
        self.passes.append(synthesis)
        total_tokens += synthesis.tokens_used

        end_time = datetime.now()
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        return HarnessResult(
            session_id=session_id,
            title=title,
            passes=self.passes,
            final_synthesis=synthesis.content,
            final_confidence=self.scratchpad.current_confidence,
            confidence_trajectory=[
                *self.scratchpad.confidence_history,
                self.scratchpad.current_confidence,
            ],
            trajectory_analysis=self.scratchpad.analyze_trajectory(),
            termination_reason=termination_reason or 'synthesis_complete',
            total_duration_ms=duration_ms,
            total_tokens=total_tokens,
            scratchpad=self.scratchpad,
        )

    async def _run_expansion(self, cycle: int) -> PassResult:
        """Expansion pass with semantic markers"""
        start = datetime.now()

        # Include thesis context from Pass 0 routing
        thesis_context = ""
        if self.router_result:
            thesis_context = f"""
## Relevant Context (from Pass 0 Routing)
**Route Type**: {self.router_result.route_type.value.upper()} | **Confidence**: {self.router_result.confidence:.0%}
**Reasoning**: {self.router_result.reasoning}

{self.router_result.assembled_context}
"""

        system = f"""You are in EXPANSION mode for cycle {cycle}. Think thoroughly and divergently.
{thesis_context}
## Current Scratchpad
{self.scratchpad.render()}

## Your Task
Expand on the analysis. Mark important elements with these tags:
- [INSIGHT] — A non-obvious observation worth preserving
- [EVIDENCE] — A specific data point that supports a claim
- [RISK] — Something that could undermine the analysis
- [COUNTER] — A counterargument or alternative interpretation
- [PATTERN] — A generalizable lesson
- [QUESTION] — Something that needs validation

Consider:
- What patterns would a veteran strategist notice?
- What would competitors argue?
- What are the second-order effects?
- What assumptions might be wrong?
"""

        user = f"Cycle {cycle}: Expand on the claims and current analysis. Use semantic markers liberally."

        content, tokens = await self._call_claude(system, user, max_tokens=4000)

        # Extract marked content into scratchpad (returns new insight count)
        insights_found = self.scratchpad.extract_and_merge(content)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='expansion',
            content=content,
            confidence=self.scratchpad.current_confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
            insights_found=insights_found,
        )

    async def _run_compression(self, cycle: int) -> PassResult:
        """Compression pass preserving marked content"""
        start = datetime.now()

        system = f"""You are in COMPRESSION mode for cycle {cycle}. Distill to decision-relevant content.

## Current Scratchpad
{self.scratchpad.render()}

## Your Task
Compress the analysis to its essence:
1. Preserve ALL content marked with [INSIGHT], [EVIDENCE], [RISK], [COUNTER], [PATTERN]
2. Drop hedging language ("it's worth noting", "importantly")
3. Drop redundant restatements
4. Preserve specific numbers and data points
5. Keep semantic markers in your output

Every sentence should earn its place.
"""

        user = f"Cycle {cycle}: Compress the accumulated analysis. Preserve marked content."

        content, tokens = await self._call_claude(system, user, max_tokens=2000)

        # Update scratchpad (returns new insight count)
        insights_found = self.scratchpad.extract_and_merge(content)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='compression',
            content=content,
            confidence=self.scratchpad.current_confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
            insights_found=insights_found,
        )

    async def _run_targeted_expansion(self, cycle: int, critique_content: str) -> PassResult:
        """
        Targeted re-expansion triggered by critique findings.

        When critique identifies >= 3 major flaws (COUNTER + RISK), this method
        runs a focused expansion specifically addressing those issues.
        """
        start = datetime.now()

        # Extract the specific flaws from critique for targeted expansion
        counters = re.findall(r'\[COUNTER\]([^\[]*?)(?=\[|$)', critique_content, re.IGNORECASE | re.DOTALL)
        risks = re.findall(r'\[RISK\]([^\[]*?)(?=\[|$)', critique_content, re.IGNORECASE | re.DOTALL)

        flaws_summary = ""
        if counters:
            flaws_summary += "**Counterarguments to address:**\n"
            for i, c in enumerate(counters[:3], 1):  # Limit to 3
                flaws_summary += f"{i}. {c.strip()}\n"
        if risks:
            flaws_summary += "\n**Risks to investigate:**\n"
            for i, r in enumerate(risks[:3], 1):  # Limit to 3
                flaws_summary += f"{i}. {r.strip()}\n"

        system = f"""You are in TARGETED RE-EXPANSION mode for cycle {cycle}.

The adversarial critique identified significant flaws that need deeper investigation.

## Current Scratchpad
{self.scratchpad.render()}

## Flaws to Address
{flaws_summary}

## Your Task
For EACH identified flaw:
1. Explore whether it invalidates or merely qualifies the thesis
2. Search for evidence that supports OR refutes the counterargument
3. Consider if this reveals a more nuanced position

Mark your findings:
- [INSIGHT] for new understanding
- [EVIDENCE] for supporting/refuting data
- [COUNTER] if you find additional challenges
- [PATTERN] for generalizable lessons

Do NOT dismiss the critique. Either strengthen the thesis against it OR adjust the thesis to accommodate it.
"""

        user = f"Cycle {cycle}: Address the critique's major flaws through targeted expansion."

        content, tokens = await self._call_claude(system, user, max_tokens=3000)

        # Extract marked content (returns new insight count)
        insights_found = self.scratchpad.extract_and_merge(content)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='targeted_expansion',
            content=content,
            confidence=self.scratchpad.current_confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
            insights_found=insights_found,
        )

    async def _run_critique(self, cycle: int) -> PassResult:
        """Critique pass with fallacy detection and evidence quality assessment"""
        start = datetime.now()

        # Mode-specific guidance
        mode = self.analysis_mode
        if mode == "retrospective":
            mode_guidance = """
## Analysis Mode: RETROSPECTIVE (Post-Mortem)
This is a retrospective case study where the outcome is known. The goal is to understand
WHY things happened, not to predict what WILL happen.

In retrospective mode:
- [HINDSIGHT] and [SURVIVORSHIP] are EXPECTED and VALUABLE - mark them to track insights
  derived from knowing the outcome, but do NOT penalize reasoning quality for using them
- These become "retrospective insights" that inform the causal analysis
- Focus fallacy detection on: confirmation bias, false dichotomy, circular reasoning
"""
        else:
            mode_guidance = """
## Analysis Mode: FORWARD (Predictive)
This is forward-looking analysis where the outcome is uncertain. The goal is to predict
what WILL happen based on current information.

In forward mode:
- [HINDSIGHT] is a serious fallacy - using future information to "predict"
- [SURVIVORSHIP] is a serious fallacy - only looking at winners
- Both should reduce reasoning quality score significantly
"""

        system = f"""You are a DIALECTICAL CRITIC for cycle {cycle}. Your job is SUBLATION -
to assess whether we've found the RIGHT insight at the RIGHT level of abstraction,
not just whether our evidence is technically sound.

## Current Scratchpad
{self.scratchpad.render()}

{mode_guidance}

## Your Task: Dialectical Critique (Sublation)

### Part 1: ABSTRACTION CHECK
Is the analysis at the right level? Mark issues:
- [TOO_GRANULAR] Lost in operational details when strategic insight needed
- [TOO_ABSTRACT] Missing concrete mechanisms that explain WHY
- [RIGHT_LEVEL] Analysis is at appropriate strategic abstraction

Ask: "Would a professor circle this as the key insight, or write 'so what?' in the margin?"

### Part 2: ESSENTIAL TENSION
Have we identified the core dilemma/trade-off? Mark:
- [TENSION_FOUND] Clear articulation of the fundamental trade-off or dilemma
- [TENSION_MISSING] Analysis describes WHAT happened but not the underlying tension
- [TENSION_WRONG] Identified a tension but it's not the essential one

Common strategic tensions to look for:
- Innovator's dilemma (profitable present vs uncertain future)
- Exploitation vs exploration
- Scale vs agility
- Short-term vs long-term optimization

### Part 3: FRAMEWORK FIT
Does this map to established strategic concepts?
- [FRAMEWORK] Name the applicable framework (Christensen, Porter, BCG, etc.)
- [NOVEL] Insight doesn't fit existing frameworks - potentially original contribution
- [MISAPPLIED] Framework invoked but doesn't actually fit the situation

### Part 4: TRANSFERABLE INSIGHT
Is there a lesson that applies beyond this specific case?
- [TRANSFERABLE] Clear principle that generalizes
- [CASE_SPECIFIC] Analysis is too tied to particulars of this situation
- [UNIVERSAL] Insight is so general it's not actionable

### Part 5: REFRAME PROPOSALS
If the current thesis is at wrong level or missing the essential tension:
- [REFRAME] Propose a better formulation of the core insight
- [ELEVATE] Suggest how to move from operational to strategic level
- [BRANCH] Fundamentally different interpretation worth exploring

## Confidence Update
REASONING_QUALITY: 0.XX (1.0 = right abstraction level, essential tension found)
EVIDENCE_QUALITY: 0.XX (1.0 = sufficient support for the insight level claimed)
CONCLUSION_CONFIDENCE: 0.XX (confidence this IS the key insight)

{"For RETROSPECTIVE: The goal is to extract the strategic lesson, not to prove causation beyond doubt. Hindsight is the tool, not the enemy." if mode == "retrospective" else "For FORWARD: Focus on whether we're asking the right strategic question."}
"""

        user = f"Cycle {cycle}: Assess reasoning quality, evidence quality, and substantive issues separately."

        content, tokens = await self._call_claude(system, user, max_tokens=3000)

        # Extract marked content (returns new insight count)
        insights_found = self.scratchpad.extract_and_merge(content)

        # Count dialectical issues that warrant re-expansion
        # These indicate we're at wrong abstraction level or missing the insight
        too_granular = len(re.findall(r'\[TOO_GRANULAR\]', content, re.IGNORECASE))
        tension_missing = len(re.findall(r'\[TENSION_MISSING\]', content, re.IGNORECASE))
        tension_wrong = len(re.findall(r'\[TENSION_WRONG\]', content, re.IGNORECASE))
        reframe_proposed = len(re.findall(r'\[REFRAME\]', content, re.IGNORECASE))
        elevate_proposed = len(re.findall(r'\[ELEVATE\]', content, re.IGNORECASE))

        # Re-expand if we need to change abstraction level or find the real tension
        # These are "sublation triggers" - the current thesis needs transcending
        major_flaws_found = (too_granular * 2) + (tension_missing * 2) + tension_wrong + reframe_proposed + elevate_proposed

        # Extract three-part confidence update
        reasoning_match = re.search(r'REASONING_QUALITY:\s*(0\.\d+)', content)
        evidence_match = re.search(r'EVIDENCE_QUALITY:\s*(0\.\d+)', content)
        conclusion_match = re.search(r'CONCLUSION_CONFIDENCE:\s*(0\.\d+)', content)

        if reasoning_match and evidence_match and conclusion_match:
            # Use new three-part confidence model
            self.scratchpad.confidence_model.reasoning_quality = float(reasoning_match.group(1))
            self.scratchpad.confidence_model.evidence_quality = float(evidence_match.group(1))
            conclusion_conf = float(conclusion_match.group(1))
            self.scratchpad.update_confidence_from_critique(content, conclusion_conf)
        else:
            # Fallback to old single confidence
            confidence_match = re.search(r'CONFIDENCE:\s*(0\.\d+)', content)
            if confidence_match:
                new_confidence = float(confidence_match.group(1))
                self.scratchpad.update_confidence(new_confidence)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='critique',
            content=content,
            confidence=self.scratchpad.current_confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
            insights_found=insights_found,
            major_flaws_found=major_flaws_found,
        )

    async def _run_branch_cycles(self, parent_cycle: int) -> list[dict]:
        """
        Run one expansion-compression cycle on each active branch.

        Each branch gets its own focused analysis cycle to develop its thesis.
        Results are stored in the scratchpad for synthesis merging.
        """
        results = []
        active_branches = self.scratchpad.get_active_branches()

        for branch in active_branches:
            self.scratchpad.current_branch_id = branch.id
            await self.on_progress('branch_cycle_start', {'branch_id': branch.id, 'thesis': branch.thesis[:50]})

            # Run focused expansion on this branch's thesis
            branch_expansion = await self._run_branch_expansion(parent_cycle, branch)
            self.passes.append(branch_expansion)

            # Compress
            branch_compression = await self._run_compression(parent_cycle)
            self.passes.append(branch_compression)

            # Quick critique to update branch confidence
            branch_critique = await self._run_branch_critique(parent_cycle, branch)
            self.passes.append(branch_critique)

            # Update branch confidence from critique
            confidence_match = re.search(r'CONFIDENCE:\s*(0\.\d+)', branch_critique.content)
            if confidence_match:
                branch.confidence = float(confidence_match.group(1))

            results.append({
                'branch_id': branch.id,
                'confidence': branch.confidence,
                'tokens': branch_expansion.tokens_used + branch_compression.tokens_used + branch_critique.tokens_used,
            })

            await self.on_progress('branch_cycle_complete', {
                'branch_id': branch.id,
                'confidence': branch.confidence,
            })

        # Reset to no specific branch
        self.scratchpad.current_branch_id = None
        return results

    async def _run_branch_expansion(self, cycle: int, branch) -> PassResult:
        """Run expansion focused on a specific branch thesis."""
        start = datetime.now()

        system = f"""You are in BRANCH EXPANSION mode for cycle {cycle}.

## Branch Context
**Branch ID**: {branch.id}
**Branch Thesis**: {branch.thesis}
**Parent Branch**: {branch.parent_id or 'root'}

## Current Scratchpad
{self.scratchpad.render()}

## Your Task
Explore this specific branch thesis. Assume it is TRUE and develop it:
- What evidence supports this branch over alternatives?
- What are the implications if this branch is correct?
- What conditions must hold for this thesis to be valid?

Mark findings with [INSIGHT], [EVIDENCE], [RISK], [COUNTER], [PATTERN].
Focus on what differentiates this branch from alternatives.
"""

        user = f"Expand on branch '{branch.id}': {branch.thesis[:100]}"

        content, tokens = await self._call_claude(system, user, max_tokens=2500)
        insights_found = self.scratchpad.extract_and_merge(content)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='branch_expansion',
            content=content,
            confidence=branch.confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
            insights_found=insights_found,
        )

    async def _run_branch_critique(self, cycle: int, branch) -> PassResult:
        """Run focused critique on a specific branch."""
        start = datetime.now()

        system = f"""You are critiquing a specific BRANCH thesis for cycle {cycle}.

## Branch Context
**Branch ID**: {branch.id}
**Branch Thesis**: {branch.thesis}

## Current Scratchpad
{self.scratchpad.render()}

## Your Task
Evaluate this specific branch:
1. What is the strongest argument AGAINST this branch thesis?
2. What evidence would DISPROVE this branch?
3. How does this branch compare to alternatives?

Provide your assessment:
CONFIDENCE: 0.XX (how likely is this branch thesis correct?)

Be calibrated - don't inflate or deflate confidence artificially.
"""

        user = f"Critique branch '{branch.id}': {branch.thesis[:100]}"

        content, tokens = await self._call_claude(system, user, max_tokens=1500)
        insights_found = self.scratchpad.extract_and_merge(content)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='branch_critique',
            content=content,
            confidence=branch.confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
            insights_found=insights_found,
        )

    async def _run_synthesis(self) -> PassResult:
        """Final synthesis pass with optional branch merging"""
        start = datetime.now()

        # Check if we have active branches to merge
        active_branches = self.scratchpad.get_active_branches()
        branch_context = ""

        if active_branches:
            branch_context = "\n## Active Branches to Merge\n"
            for b in sorted(active_branches, key=lambda x: x.confidence, reverse=True):
                branch_context += f"- **{b.id}** ({b.confidence*100:.0f}%): {b.thesis}\n"

            branch_context += """
## Branch Merge Strategy
Choose ONE of these approaches:
1. **SELECT**: If one branch clearly dominates (>20% confidence gap), select it as the thesis
2. **CONDITIONAL**: If branches are close, synthesize as "Under condition X, thesis A; under condition Y, thesis B"
3. **RECONCILE**: If branches can be reconciled, find the synthesis that accommodates both

State your merge approach in the output.
"""

        system = f"""You are in FINAL SYNTHESIS mode. Crystallize the analysis into a thesis.

## Complete Scratchpad
{self.scratchpad.render()}

## Confidence Trajectory
{' → '.join(f"{c*100:.0f}%" for c in [*self.scratchpad.confidence_history, self.scratchpad.current_confidence])}

## Trajectory Analysis
{json.dumps(self.scratchpad.analyze_trajectory(), indent=2)}
{branch_context}
## Your Task
Form the final thesis with:

1. **Core Belief**: One testable sentence stating the thesis
2. **Confidence**: 0.0-1.0 reflecting genuine uncertainty
3. **Evidence For**: Specific supporting points with @CLAIM references
4. **Evidence Against**: Acknowledged limitations
5. **Triggers**: Falsifiable conditions - "what would change this"
{f'6. **Branch Resolution**: How branches were merged (if applicable)' if active_branches else ''}

Output as structured markdown.
"""

        user = "Synthesize the final thesis from all accumulated analysis."

        content, tokens = await self._call_claude(system, user, max_tokens=2500)

        # If we had branches, update final confidence based on winning branch
        winning_branch = self.scratchpad.get_winning_branch()
        if winning_branch:
            # Use winning branch confidence as a factor
            self.scratchpad.current_confidence = (
                self.scratchpad.current_confidence * 0.5 +
                winning_branch.confidence * 0.5
            )

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)
        return PassResult(
            pass_type='synthesis',
            content=content,
            confidence=self.scratchpad.current_confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
        )


# Convenience function for simple usage
async def run_harness(
    title: str,
    claims: list[dict],
    api_key: str | None = None,
    max_cycles: int = 5,
    on_progress: Callable[[str, Any], None] | None = None,
) -> HarnessResult:
    """Run multi-pass harness on claims"""
    harness = MultiPassHarnessLite(
        api_key=api_key,
        max_cycles=max_cycles,
        on_progress=on_progress,
    )
    return await harness.run(title, claims)


# CLI for testing
if __name__ == "__main__":
    import sys

    async def main():
        # Test with sample claims
        test_claims = [
            {
                "id": "CLAIM-1",
                "type": "core_thesis",
                "text": "Context graphs represent AI's trillion dollar opportunity",
                "snippet": "Context graphs are the next frontier in AI infrastructure",
            },
            {
                "id": "CLAIM-2",
                "type": "framework",
                "text": "RAG is necessary but insufficient for enterprise AI",
                "snippet": "Retrieval alone cannot capture the rich relationships between entities",
            },
            {
                "id": "CLAIM-3",
                "type": "counter",
                "text": "LLMs may eventually internalize context without explicit graphs",
                "snippet": "As models grow larger, they may learn to reason about relationships implicitly",
            },
        ]

        def on_progress(event: str, data: Any):
            print(f"[{event}] {json.dumps(data, default=str)}")

        print("Running multi-pass harness...")
        result = await run_harness(
            title="Context Graphs Analysis",
            claims=test_claims,
            max_cycles=3,
            on_progress=on_progress,
        )

        print("\n" + "=" * 60)
        print("FINAL RESULT")
        print("=" * 60)
        print(f"Session: {result.session_id}")
        print(f"Confidence: {result.final_confidence:.0%}")
        print(f"Trajectory: {' → '.join(f'{c:.0%}' for c in result.confidence_trajectory)}")
        print(f"Termination: {result.termination_reason}")
        print(f"Duration: {result.total_duration_ms}ms")
        print(f"Tokens: {result.total_tokens}")
        print("\nSYNTHESIS:")
        print(result.final_synthesis)

    asyncio.run(main())
