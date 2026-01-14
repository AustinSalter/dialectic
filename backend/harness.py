"""
Multi-Pass Reasoning Harness

Implements the validated architecture from TESTING.md:
- EXP-004: Multi-pass enables meta-level thinking unavailable in single-pass
- EXP-005: Accumulated context (not partitioned) enables frame-level reframing
- EXP-007: Structured self-critique (6 techniques) finds 9x more flaws
- EXP-008: Semantic markers extract 3x more insights per token

Uses Claude Agent SDK with:
- ClaudeSDKClient for session continuity across passes
- Subagents for specialized stages (expander, compressor, critic, synthesizer)
- Scratchpad injected as context (not MCP tool - simpler and proven to work)
"""

import asyncio
import re
from typing import Callable, Any
from dataclasses import dataclass, field
from datetime import datetime

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AgentDefinition,
    AssistantMessage,
    TextBlock,
    ResultMessage,
)

from scratchpad import Scratchpad
from thesis_router import ThesisRouter, RouteType, RouterResult


# Six questioning techniques from EXP-007 (validated 9x more flaws than naive)
SIX_QUESTIONING_TECHNIQUES = """
## Six Questioning Techniques for Structured Critique

1. **INVERSION**: What if the opposite were true? Steel-man the counter-position.
   - If this thesis is wrong, what's the most likely reason?
   - What would have to be true for the opposite conclusion?

2. **SECOND-ORDER**: What are the downstream effects?
   - If everyone acted on this insight, what happens to the market?
   - What second-order consequences haven't been considered?

3. **FALSIFICATION**: What evidence would disprove this?
   - Name 3 specific, observable conditions that would invalidate this thesis.
   - What's the "kill switch" - the single most important thing to watch?

4. **BASE RATES**: What do priors suggest?
   - How often do theses like this turn out to be correct?
   - What's the historical success rate for this type of bet?

5. **INCENTIVE AUDIT**: Who benefits from this being believed?
   - What are the hidden incentives in the sources?
   - Who gains from this narrative, regardless of truth?

6. **ADVERSARY SIMULATION**: How would a smart skeptic attack this?
   - If you were short this thesis, what's your best argument?
   - What would Munger/Buffett/Soros critique about this reasoning?
"""


@dataclass
class PassResult:
    """Result from a single pass"""
    pass_type: str  # 'expansion', 'compression', 'critique', 'synthesis'
    content: str
    confidence: float
    duration_ms: int
    tokens_used: int


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


class MultiPassHarness:
    """
    Multi-pass reasoning harness using Claude Agent SDK.

    Architecture from TESTING.md:
    - Pass 1: EXPANSION with semantic markers
    - Pass 2: COMPRESSION preserving marked content
    - Pass N: CRITIQUE cycles with 6 questioning techniques
    - Scratchpad: Accumulated context across all passes (injected in prompt)
    """

    def __init__(
        self,
        max_cycles: int = 5,
        on_progress: Callable[[str, Any], None] | None = None
    ):
        self.max_cycles = max_cycles
        self.on_progress = on_progress or (lambda *_: None)
        self.scratchpad: Scratchpad | None = None
        self.passes: list[PassResult] = []
        self.router = ThesisRouter()
        self.router_result: RouterResult | None = None

    async def run(
        self,
        title: str,
        claims: list[dict],
        initial_context: str = "",
    ) -> HarnessResult:
        """
        Run multi-pass reasoning on the given claims.

        Args:
            title: Session title
            claims: List of claims from source material
            initial_context: Any initial context to seed the analysis
        """
        start_time = datetime.now()
        session_id = f"harness-{int(start_time.timestamp())}"

        # Initialize scratchpad
        self.scratchpad = Scratchpad(session_id=session_id, title=title)
        self.passes = []

        # Add claims to scratchpad
        for claim in claims:
            self.scratchpad.add_claim(
                claim_id=claim.get('id', ''),
                text=claim.get('text', ''),
                claim_type=claim.get('type', 'claim'),
                snippet=claim.get('snippet', '')
            )

        # PASS 0: Thesis routing
        self.router_result = self.router.route_with_enhancement(title, claims)

        self.on_progress('initialized', {
            'session_id': session_id,
            'claims': len(claims),
            'route_type': self.router_result.route_type.value,
            'route_confidence': self.router_result.confidence,
            'matched_theses': [t.id for t in self.router_result.matched_theses],
            'matched_patterns': [p.id for p in self.router_result.matched_patterns],
        })

        # Configure SDK options with subagents
        options = ClaudeAgentOptions(
            allowed_tools=["Task"],  # Allow subagent invocation
            agents=self._define_agents(),
            system_prompt=self._build_system_prompt(title),
            max_turns=50,  # Allow enough turns for multi-pass
        )

        total_tokens = 0
        termination_reason = None

        async with ClaudeSDKClient(options=options) as client:
            # Run expansion → compression → critique cycles
            while True:
                self.scratchpad.increment_cycle()
                cycle = self.scratchpad.cycle_count
                self.on_progress('cycle_start', {'cycle': cycle})

                # PASS 1: EXPANSION
                expansion_result = await self._run_expansion(client, cycle)
                self.passes.append(expansion_result)
                total_tokens += expansion_result.tokens_used
                self.on_progress('expansion_complete', {
                    'cycle': cycle,
                    'confidence': expansion_result.confidence,
                    'tokens': expansion_result.tokens_used,
                })

                # PASS 2: COMPRESSION
                compression_result = await self._run_compression(client, cycle)
                self.passes.append(compression_result)
                total_tokens += compression_result.tokens_used
                self.on_progress('compression_complete', {
                    'cycle': cycle,
                    'confidence': compression_result.confidence,
                    'tokens': compression_result.tokens_used,
                })

                # PASS 3: CRITIQUE (with 6 questioning techniques)
                critique_result = await self._run_critique(client, cycle)
                self.passes.append(critique_result)
                total_tokens += critique_result.tokens_used
                self.on_progress('critique_complete', {
                    'cycle': cycle,
                    'confidence': critique_result.confidence,
                    'tokens': critique_result.tokens_used,
                })

                # Check termination
                termination_reason = self.scratchpad.check_termination(self.max_cycles)
                if termination_reason:
                    self.on_progress('terminating', {'reason': termination_reason})
                    break

            # Final synthesis
            synthesis_result = await self._run_synthesis(client)
            self.passes.append(synthesis_result)
            total_tokens += synthesis_result.tokens_used
            self.on_progress('synthesis_complete', {
                'confidence': synthesis_result.confidence,
                'tokens': synthesis_result.tokens_used,
            })

        end_time = datetime.now()
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        return HarnessResult(
            session_id=session_id,
            title=title,
            passes=self.passes,
            final_synthesis=synthesis_result.content,
            final_confidence=self.scratchpad.current_confidence,
            confidence_trajectory=[
                *self.scratchpad.confidence_history,
                self.scratchpad.current_confidence
            ],
            trajectory_analysis=self.scratchpad.analyze_trajectory(),
            termination_reason=termination_reason or 'synthesis_complete',
            total_duration_ms=duration_ms,
            total_tokens=total_tokens,
            scratchpad=self.scratchpad,
        )

    def _define_agents(self) -> dict[str, AgentDefinition]:
        """Define subagents for each stage"""
        return {
            "expander": AgentDefinition(
                description="Expansion specialist for divergent thinking. Use for exploring all angles of a thesis.",
                prompt="""You are in EXPANSION mode. Think thoroughly and divergently.

Mark important elements with these tags:
- [INSIGHT] — A non-obvious observation worth preserving
- [EVIDENCE] — A specific data point that supports a claim
- [RISK] — Something that could undermine the analysis or action
- [COUNTER] — A counterargument or alternative interpretation
- [PATTERN] — A generalizable lesson for similar situations
- [QUESTION] — Something that needs validation

Think freely. Don't worry about length. The compression pass will extract what matters.

Consider:
- What patterns would a veteran strategist notice?
- What would competitors argue, and are they right?
- What are the second-order effects?
- What assumptions might be wrong?
- What did we learn that applies beyond this case?""",
                model="sonnet",
            ),
            "compressor": AgentDefinition(
                description="Compression specialist for distilling insights. Use for synthesizing expanded analysis.",
                prompt="""You are in COMPRESSION mode. Extract decision-relevant content from expanded analysis.

Your job is to:
1. Preserve all content marked with [INSIGHT], [EVIDENCE], [RISK], [COUNTER], [PATTERN]
2. Drop hedging language ("it's worth noting", "importantly")
3. Drop redundant restatements
4. Preserve specific numbers and data points
5. Maintain the semantic markers in compressed form

Output should be dense and actionable. Every sentence should earn its place.""",
                model="haiku",  # Haiku is sufficient for compression
            ),
            "critic": AgentDefinition(
                description="Adversarial critic for stress-testing theses. Use for finding flaws and gaps.",
                prompt=f"""You are an ADVERSARIAL CRITIC. Your job is to find flaws in the analysis.

{SIX_QUESTIONING_TECHNIQUES}

Be ruthless but fair. Mark your findings:
- [COUNTER] for counterarguments
- [RISK] for identified risks
- [QUESTION] for unresolved questions

After your critique, state your updated confidence:
CONFIDENCE: 0.XX (brief reasoning why)

Confidence should DECREASE if you found significant flaws.
Non-monotonic confidence trajectories are good - they indicate genuine exploration.""",
                model="sonnet",
            ),
            "synthesizer": AgentDefinition(
                description="Synthesis specialist for forming final thesis. Use for crystallizing conclusions.",
                prompt="""You are in SYNTHESIS mode. Crystallize the analysis into a final thesis.

Your output MUST include these sections:

## Core Belief
One crisp sentence stating the thesis. Must be specific and testable.

## Confidence
A number 0.0-1.0 reflecting genuine uncertainty, with brief reasoning.

## Evidence For
Specific supporting points with @CLAIM-N references where applicable.

## Evidence Against
Acknowledged counterevidence or limitations discovered during critique.

## Triggers
Falsifiable conditions - "what would change this thesis". Be specific.

The thesis should emerge from the accumulated analysis, not be imposed on it.""",
                model="sonnet",
            ),
        }

    def _build_system_prompt(self, title: str) -> str:
        """Build system prompt for the harness"""
        return f"""You are running a multi-pass reasoning harness for: {title}

## Your Role
You are the orchestrator of a rigorous analysis process. Each cycle consists of:
1. **EXPANSION**: Divergent exploration with semantic markers
2. **COMPRESSION**: Distill to decision-relevant content
3. **CRITIQUE**: Adversarial stress-testing with 6 questioning techniques

## Key Principles (from validated experiments)
- Accumulated context enables frame-level reframing
- Semantic markers ([INSIGHT], [EVIDENCE], etc.) extract 3x more insights per token
- Non-monotonic confidence trajectories indicate genuine exploration
- Structured critique finds 9x more flaws than naive critique

## Semantic Markers
Use these tags to mark important content:
- [INSIGHT] — Non-obvious observations
- [EVIDENCE] — Specific data points
- [RISK] — Threats to the analysis
- [COUNTER] — Counterarguments
- [PATTERN] — Generalizable lessons
- [QUESTION] — Unresolved questions
- [DECISION] — Key decisions made
- [META] — Meta-observations about the analysis itself

## Process
For each pass, I will provide you with:
1. The current scratchpad (accumulated analysis)
2. Instructions for that pass
3. The specific subagent to use

You MUST use the specified subagent for each pass (expander, compressor, critic, synthesizer).
After each pass, report your current CONFIDENCE level (0.0-1.0).
"""

    async def _run_pass(
        self,
        client: ClaudeSDKClient,
        pass_type: str,
        prompt: str,
    ) -> PassResult:
        """Run a single pass and collect results"""
        start = datetime.now()

        await client.query(prompt)

        content = ""
        tokens = 0
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        content += block.text
            if isinstance(message, ResultMessage):
                tokens = message.usage.get('output_tokens', 0) if message.usage else 0

        # Extract and merge marked content into scratchpad
        self.scratchpad.extract_and_merge(content)

        # Extract confidence update if present
        confidence_match = re.search(r'CONFIDENCE:\s*(0\.\d+)', content, re.IGNORECASE)
        if confidence_match:
            new_confidence = float(confidence_match.group(1))
            self.scratchpad.update_confidence(new_confidence)

        duration_ms = int((datetime.now() - start).total_seconds() * 1000)

        return PassResult(
            pass_type=pass_type,
            content=content,
            confidence=self.scratchpad.current_confidence,
            duration_ms=duration_ms,
            tokens_used=tokens,
        )

    async def _run_expansion(self, client: ClaudeSDKClient, cycle: int) -> PassResult:
        """Run expansion pass"""
        # Include thesis context from Pass 0 routing
        thesis_context = ""
        if self.router_result:
            thesis_context = f"""
### Relevant Context (from Pass 0 Routing)
**Route Type**: {self.router_result.route_type.value.upper()} | **Confidence**: {self.router_result.confidence:.0%}
**Reasoning**: {self.router_result.reasoning}

{self.router_result.assembled_context}
"""

        prompt = f"""
## Cycle {cycle} - EXPANSION PASS
{thesis_context}
### Current Scratchpad
{self.scratchpad.render()}

### Instructions
Use the **expander** subagent to explore new angles on the analysis.

Focus on:
- What haven't we considered yet?
- What are the second-order implications?
- What would a skeptic say?
- What patterns emerge from the claims?

Mark all findings with semantic markers ([INSIGHT], [EVIDENCE], [RISK], [COUNTER], [PATTERN], [QUESTION]).

End with: CONFIDENCE: 0.XX (reasoning)
"""
        return await self._run_pass(client, 'expansion', prompt)

    async def _run_compression(self, client: ClaudeSDKClient, cycle: int) -> PassResult:
        """Run compression pass"""
        prompt = f"""
## Cycle {cycle} - COMPRESSION PASS

### Current Scratchpad
{self.scratchpad.render()}

### Instructions
Use the **compressor** subagent to distill the analysis.

Focus on:
- Preserve ALL content marked with [INSIGHT], [EVIDENCE], [RISK], [COUNTER], [PATTERN]
- Drop hedging language and redundancy
- Keep specific numbers and data points
- Maintain semantic markers

Output the compressed analysis with markers preserved.

End with: CONFIDENCE: 0.XX (reasoning)
"""
        return await self._run_pass(client, 'compression', prompt)

    async def _run_critique(self, client: ClaudeSDKClient, cycle: int) -> PassResult:
        """Run critique pass with 6 questioning techniques"""
        prompt = f"""
## Cycle {cycle} - CRITIQUE PASS

### Current Scratchpad
{self.scratchpad.render()}

### Instructions
Use the **critic** subagent to stress-test the analysis.

Apply ALL six questioning techniques:
1. **INVERSION**: What if the opposite were true?
2. **SECOND-ORDER**: What are the downstream effects?
3. **FALSIFICATION**: What evidence would disprove this?
4. **BASE RATES**: What do historical priors suggest?
5. **INCENTIVE AUDIT**: Who benefits from this being believed?
6. **ADVERSARY SIMULATION**: How would a smart skeptic attack?

Mark findings with [COUNTER], [RISK], and [QUESTION].

If you found significant flaws, your confidence should DECREASE.
Non-monotonic confidence trajectories indicate genuine exploration.

End with: CONFIDENCE: 0.XX (reasoning based on critique findings)
"""
        return await self._run_pass(client, 'critique', prompt)

    async def _run_synthesis(self, client: ClaudeSDKClient) -> PassResult:
        """Run final synthesis pass"""
        trajectory_str = ' → '.join(
            f"{c*100:.0f}%"
            for c in [*self.scratchpad.confidence_history, self.scratchpad.current_confidence]
        )

        prompt = f"""
## FINAL SYNTHESIS PASS

### Complete Scratchpad
{self.scratchpad.render()}

### Confidence Trajectory
{trajectory_str}

### Trajectory Analysis
- Is monotonic: {self.scratchpad.analyze_trajectory()['is_monotonic']}
- Max dip: {self.scratchpad.analyze_trajectory()['max_dip']:.0%}
- Final trend: {self.scratchpad.analyze_trajectory()['final_trend']}

### Instructions
Use the **synthesizer** subagent to form the final thesis.

Your synthesis MUST include:
1. **Core Belief** - One testable sentence
2. **Confidence** - 0.0-1.0 with reasoning
3. **Evidence For** - With @CLAIM-N references
4. **Evidence Against** - Limitations discovered
5. **Triggers** - What would change this thesis

This is the final output. Make it actionable and specific.
"""
        return await self._run_pass(client, 'synthesis', prompt)


# Convenience function
async def run_harness(
    title: str,
    claims: list[dict],
    max_cycles: int = 5,
    on_progress: Callable[[str, Any], None] | None = None,
) -> HarnessResult:
    """Run multi-pass harness on claims"""
    harness = MultiPassHarness(max_cycles=max_cycles, on_progress=on_progress)
    return await harness.run(title, claims)


# CLI for testing
if __name__ == "__main__":
    import json

    async def main():
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

        print("Running multi-pass harness with Claude Agent SDK...")
        print("=" * 60)

        result = await run_harness(
            title="Context Graphs Investment Thesis",
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
        print(f"\nPasses: {len(result.passes)}")
        for p in result.passes:
            print(f"  - {p.pass_type}: {p.tokens_used} tokens, {p.duration_ms}ms, conf={p.confidence:.0%}")
        print("\nSYNTHESIS:")
        print(result.final_synthesis)

    asyncio.run(main())
