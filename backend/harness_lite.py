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
    ):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY required")

        self.max_cycles = max_cycles
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
    ) -> tuple[str, int]:
        """Make API call to Claude"""
        async with httpx.AsyncClient(timeout=120.0) as client:
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

    async def run(
        self,
        title: str,
        claims: list[dict],
        initial_context: str = "",
    ) -> HarnessResult:
        """Run multi-pass reasoning"""
        start_time = datetime.now()
        session_id = f"harness-{int(start_time.timestamp())}"

        # Initialize scratchpad
        self.scratchpad = Scratchpad(session_id=session_id, title=title)
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
            await self.on_progress('critique_complete', {'cycle': cycle, 'confidence': critique.confidence, 'tokens': critique.tokens_used})

            # Record insight count for this cycle (for diminishing returns detection)
            self.scratchpad.record_cycle_insights(cycle_insights)

            # Check termination (now uses combined strategy from EXP-010)
            termination_reason = self.scratchpad.check_termination(self.max_cycles)
            if termination_reason:
                await self.on_progress('terminating', {'reason': termination_reason, 'cycle_insights': cycle_insights})
                break

        # Final synthesis
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

    async def _run_critique(self, cycle: int) -> PassResult:
        """Critique pass with 6 questioning techniques"""
        start = datetime.now()

        system = f"""You are an ADVERSARIAL CRITIC for cycle {cycle}.

## Current Scratchpad
{self.scratchpad.render()}

{SIX_QUESTIONING_TECHNIQUES}

## Your Task
Apply ALL six techniques to stress-test the analysis:

For each technique, mark your findings:
- [COUNTER] for counterarguments
- [RISK] for identified risks
- [QUESTION] for unresolved questions

After your critique, provide a confidence update:
CONFIDENCE: 0.XX (brief reasoning)

If you found significant flaws, confidence should DECREASE.
Non-monotonic trajectories indicate genuine exploration.
"""

        user = f"Cycle {cycle}: Apply all six questioning techniques. Be ruthless but fair."

        content, tokens = await self._call_claude(system, user, max_tokens=3000)

        # Extract marked content (returns new insight count)
        insights_found = self.scratchpad.extract_and_merge(content)

        # Extract confidence update
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
        )

    async def _run_synthesis(self) -> PassResult:
        """Final synthesis pass"""
        start = datetime.now()

        system = f"""You are in FINAL SYNTHESIS mode. Crystallize the analysis into a thesis.

## Complete Scratchpad
{self.scratchpad.render()}

## Confidence Trajectory
{' → '.join(f"{c*100:.0f}%" for c in [*self.scratchpad.confidence_history, self.scratchpad.current_confidence])}

## Trajectory Analysis
{json.dumps(self.scratchpad.analyze_trajectory(), indent=2)}

## Your Task
Form the final thesis with:

1. **Core Belief**: One testable sentence stating the thesis
2. **Confidence**: 0.0-1.0 reflecting genuine uncertainty
3. **Evidence For**: Specific supporting points with @CLAIM references
4. **Evidence Against**: Acknowledged limitations
5. **Triggers**: Falsifiable conditions - "what would change this"

Output as structured markdown.
"""

        user = "Synthesize the final thesis from all accumulated analysis."

        content, tokens = await self._call_claude(system, user, max_tokens=2000)

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
