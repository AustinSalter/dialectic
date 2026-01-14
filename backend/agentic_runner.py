#!/usr/bin/env python3
"""
Agentic Strategy Runner - True multi-turn thesis refinement.

This is a REFERENCE IMPLEMENTATION showing the full agentic architecture:
- Working memory that persists across iterations
- N-pass reasoning (expansion -> compression)
- Self-critique before deciding to continue/conclude/pivot
- Streaming output to observe reasoning in real-time
- Context budget tracking

Note: Tool execution and scenario loading require additional setup.
See harness_lite.py for a simpler, self-contained implementation.
"""

import argparse
import asyncio
import json
import os
import sys
import time
import yaml
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional, Generator
import anthropic

from working_memory import ThesisState, create_initial_state, Evidence, StructuredWorkingMemory
from context_tracker import ContextBudget, ThesisRouter, EnhancedThesisRouter, InsightMetrics, analyze_response_quality

# API key from environment
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


# =============================================================================
# Stub implementations - replace with your tool infrastructure
# =============================================================================

def load_config(mode: str) -> dict:
    """Load configuration for the given mode. Stub - implement for your use case."""
    return {"mode": mode, "tools": []}


def build_tool_definitions(config: dict) -> list:
    """Build tool definitions from config. Stub - implement for your use case."""
    return []


async def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool and return result. Stub - implement for your use case."""
    return f"Tool '{tool_name}' not implemented. Input: {tool_input}"

EXPERIMENTS_DIR = Path(__file__).parent
OUTPUTS_DIR = EXPERIMENTS_DIR / "outputs" / "agentic"


def load_thesis_scenarios() -> dict:
    """Load thesis-focused scenarios from YAML."""
    with open(EXPERIMENTS_DIR / "thesis_scenarios.yaml") as f:
        return yaml.safe_load(f)


# =============================================================================
# Prompts for N-Pass Reasoning
# =============================================================================

EXPANSION_SYSTEM_PROMPT = """You are a strategic analyst in EXPANSION mode. Your task is to explore broadly and gather evidence.

## Working Memory
{working_memory}

## Instructions for Expansion Pass
1. EXPLORE broadly - consider multiple angles
2. USE TOOLS to gather data - respect the context budget
3. MARK your reasoning with semantic markers:
   - [INSIGHT] for non-obvious conclusions
   - [EVIDENCE] for data points supporting conclusions
   - [RISK] for potential downsides or failure modes
   - [COUNTER] for arguments against the thesis
   - [QUESTION] for open questions to investigate

4. DO NOT conclude yet - your goal is to expand the search space
5. After tool use, synthesize what you learned with markers

Output your reasoning with markers. End with a section listing:
- New evidence found (for/against)
- New questions raised
- Areas you couldn't investigate yet
"""

COMPRESSION_SYSTEM_PROMPT = """You are a strategic analyst in COMPRESSION mode. Your task is to synthesize findings and update the thesis.

## Working Memory
{working_memory}

## Expansion Output
{expansion_output}

## Instructions for Compression Pass
1. SYNTHESIZE the expansion findings into decision-relevant conclusions
2. UPDATE the thesis if evidence warrants changes
3. UPDATE your confidence level based on evidence balance
4. IDENTIFY the next priority question to investigate

Output in this exact JSON format:
```json
{{
    "thesis_update": "Updated thesis statement (or 'no change' if unchanged)",
    "confidence": 0.X,
    "confidence_reasoning": "Why this confidence level",
    "evidence_summary": {{
        "supporting": ["key point 1", "key point 2"],
        "challenging": ["key point 1", "key point 2"]
    }},
    "next_priority": "Most important question to investigate next",
    "areas_investigated": ["area1", "area2"]
}}
```
"""

ESCAPE_HATCH_PROMPT = """You are a strategic analyst who has reached the maximum iterations without achieving high confidence. This is an ESCAPE HATCH - be honest about limitations.

## Working Memory
{working_memory}

## Analysis History
{analysis_history}

## Instructions
Your analysis did not converge to a confident conclusion. This is OKAY - intellectual honesty is valuable.

Explain clearly:
1. **Information Gap** - What specific data would you need to reach a confident conclusion?
2. **Unresolvable Tension** - What conflicting evidence or logic could not be reconciled?
3. **Model Limitation** - What aspects of this problem are beyond current analysis capability?
4. **Best Estimate** - Given the uncertainty, what is your best guess? (With explicit caveats)
5. **Decision Recommendation** - Should the investor: wait for more data, hedge, or accept uncertainty?

Be specific. "More research needed" is not acceptable. Name the exact data sources or analysis that would help.

End your response with the exact token:
[ANALYSIS_BLOCKED]

This signals the analysis could not reach confident conclusion. Do not include any text after this token.

Output your escape hatch analysis below:
"""

SYNTHESIS_PROMPT = """You are a strategic analyst completing a multi-pass analysis. Provide your final synthesis.

## Working Memory
{working_memory}

## Analysis History
{analysis_history}

## Instructions
Synthesize your findings into a final thesis with:
1. **Final Thesis Statement** - Clear, specific, actionable
2. **Confidence Level** - Calibrated to evidence (not just gut feel)
3. **Key Evidence** - Top 3 supporting and top 3 challenging points
4. **Investment Implications** - What would a smart investor do?
5. **Monitoring Triggers** - What would change this thesis?

When you have completed your synthesis, you MUST end your response with the exact token:
[ANALYSIS_COMPLETE]

This token signals the analysis is finished. Do not include any text after this token.

Output your synthesis below:
"""

CRITIQUE_SYSTEM_PROMPT = """You are a strategic analyst in STRUCTURED SELF-CRITIQUE mode. Apply these 6 questioning techniques rigorously.

## Current Thesis State
{working_memory}

## Recent Analysis
{recent_analysis}

## 6 QUESTIONING TECHNIQUES - Apply ALL of these:

### 1. CHALLENGE VAGUENESS
Quote specific vague claims from the analysis. For each, demand:
- What exactly does "significant" mean? Give a number.
- What timeframe is "soon" or "growing"?
- Who specifically is "stakeholders" or "the market"?

### 2. DEMAND EVIDENCE
For each claim, rate evidence strength 1-5:
- 5: Observed data with citation (financials, metrics)
- 4: Reported by credible source
- 3: Inferred from patterns
- 2: Assumed based on general knowledge
- 1: Speculation / no evidence
Flag any claim rated 1-2 as an "evidence gap".

### 3. QUESTION FREQUENCY & IMPACT
For each risk or opportunity identified:
- How often does this actually happen? (frequency)
- What is the real cost/benefit if it does? (magnitude)
- Is this a 1-in-100 risk or a 1-in-2 risk?

### 4. LOOK FOR SIMPLER ALTERNATIVES
- Could a naive explanation account for this?
- Is there a simpler thesis that fits the evidence?
- Are we overcomplicating with unnecessary nuance?

### 5. CALL OUT NON-PROBLEMS
- Which identified "risks" are actually negligible?
- Which "opportunities" have trivial upside?
- What would we ignore in a real decision?

### 6. TEST FOR REAL NEED
- What breaks if we do nothing?
- Is the status quo actually problematic?
- Would a smart investor care about this analysis?

## DECISION FRAMEWORK
After applying all 6 techniques:
- CONTINUE: If evidence gaps are addressable with more data
- CONCLUDE: If thesis is robust against all 6 challenges
- PIVOT: If critique reveals fundamental flaw in thesis

Output in this exact JSON format:
```json
{{
    "vagueness_issues": [
        {{"claim": "quoted vague claim", "demand": "what specific info is needed"}}
    ],
    "evidence_gaps": [
        {{"claim": "claim with weak evidence", "current_strength": 2, "needed": "what evidence would strengthen"}}
    ],
    "frequency_impact_checks": [
        {{"item": "risk/opportunity", "frequency": "how often", "magnitude": "how big", "verdict": "material|negligible"}}
    ],
    "simpler_alternative": "Is there a simpler thesis? If so, what?",
    "non_problems": ["things identified as issues that are actually negligible"],
    "real_need_test": "What actually breaks if we do nothing?",
    "strongest_counter": "The single strongest argument against the thesis",
    "decision": "CONTINUE|CONCLUDE|PIVOT",
    "decision_reasoning": "Specific reasoning based on the 6 techniques above"
}}
```
"""


# =============================================================================
# Streaming Output Utilities
# =============================================================================

class StreamingPrinter:
    """Print streaming output with formatting."""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.current_section = None

    def section(self, title: str, char: str = "="):
        """Print section header."""
        if self.enabled:
            width = 70
            print(f"\n{char * width}")
            print(f"  {title}")
            print(f"{char * width}")
            self.current_section = title

    def subsection(self, title: str):
        """Print subsection header."""
        if self.enabled:
            print(f"\n--- {title} ---")

    def memory_state(self, state: ThesisState):
        """Print working memory state."""
        if self.enabled:
            print(f"\n[MEMORY] Iteration {state.iteration}/{state.max_iterations}")
            print(f"[MEMORY] Thesis: {state.current_thesis[:80]}...")
            print(f"[MEMORY] Confidence: {state.confidence:.0%}")
            print(f"[MEMORY] Evidence: +{len(state.evidence_for)} -{len(state.evidence_against)}")
            open_qs = state.get_open_questions()
            if open_qs:
                print(f"[MEMORY] Open Questions: {len(open_qs)}")

    def tool_call(self, name: str, input_data: dict):
        """Print tool call."""
        if self.enabled:
            input_str = json.dumps(input_data, default=str)[:60]
            print(f"  [TOOL] {name}({input_str}...)")

    def tool_result(self, success: bool, summary: str = None):
        """Print tool result."""
        if self.enabled:
            status = "OK" if success else "FAIL"
            if summary:
                print(f"  [TOOL] -> {status}: {summary[:80]}...")
            else:
                print(f"  [TOOL] -> {status}")

    def stream_text(self, text: str):
        """Stream text character by character (or chunk by chunk)."""
        if self.enabled:
            # For now, print in chunks to simulate streaming
            sys.stdout.write(text)
            sys.stdout.flush()

    def insight(self, marker: str, text: str):
        """Print highlighted insight."""
        if self.enabled:
            colors = {
                "INSIGHT": "\033[92m",  # Green
                "EVIDENCE": "\033[94m",  # Blue
                "RISK": "\033[91m",  # Red
                "COUNTER": "\033[93m",  # Yellow
                "QUESTION": "\033[95m",  # Magenta
            }
            reset = "\033[0m"
            color = colors.get(marker, "")
            print(f"{color}[{marker}]{reset} {text}")

    def decision(self, decision: str, reasoning: str):
        """Print decision."""
        if self.enabled:
            colors = {
                "CONTINUE": "\033[93m",  # Yellow
                "CONCLUDE": "\033[92m",  # Green
                "PIVOT": "\033[91m",  # Red
            }
            reset = "\033[0m"
            color = colors.get(decision, "")
            print(f"\n{color}>>> DECISION: {decision}{reset}")
            print(f"    Reasoning: {reasoning}")

    def metrics(self, metrics: dict):
        """Print metrics summary."""
        if self.enabled:
            print("\n[METRICS]")
            for k, v in metrics.items():
                if isinstance(v, float):
                    print(f"  {k}: {v:.2f}")
                else:
                    print(f"  {k}: {v}")


# =============================================================================
# Agentic Runner Core
# =============================================================================

class AgenticStrategyRunner:
    """Run multi-turn thesis refinement with N-pass reasoning."""

    def __init__(
        self,
        mode: Literal["baseline", "graph"] = "baseline",
        stream: bool = True,
        max_iterations: int = 5
    ):
        self.mode = mode
        self.config = load_config(mode)
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.tools = build_tool_definitions(self.config)
        self.printer = StreamingPrinter(enabled=stream)
        self.max_iterations = max_iterations

        # Context tracking
        self.budget = ContextBudget()
        self.router = ThesisRouter()
        self.thesis_router = EnhancedThesisRouter()  # Pass 0 context loading

    def _extract_tickers(self, text: str) -> list[str]:
        """Extract stock tickers from text."""
        import re
        # Common tech tickers
        known_tickers = {
            "NVDA", "AMD", "INTC", "TSM", "META", "GOOGL", "GOOG", "MSFT",
            "AAPL", "AMZN", "TSLA", "NFLX", "CRM", "ORCL", "IBM", "CSCO",
            "ADBE", "NOW", "SNOW", "PLTR", "NET", "DDOG", "MDB", "CRWD"
        }
        # Find all caps words that might be tickers
        potential = re.findall(r'\b[A-Z]{2,5}\b', text)
        # Filter to known tickers
        found = [t for t in potential if t in known_tickers]
        # Also check for company names
        name_to_ticker = {
            "nvidia": "NVDA", "amd": "AMD", "intel": "INTC",
            "meta": "META", "google": "GOOGL", "microsoft": "MSFT",
            "apple": "AAPL", "amazon": "AMZN", "tesla": "TSLA"
        }
        text_lower = text.lower()
        for name, ticker in name_to_ticker.items():
            if name in text_lower and ticker not in found:
                found.append(ticker)
        return list(set(found))

    async def run_scenario(self, scenario: dict) -> dict:
        """Run a thesis scenario through the agentic loop."""
        scenario_id = scenario["id"]
        prompt = scenario["prompt"]

        self.printer.section(f"SCENARIO: {scenario_id}", "=")
        print(f"Category: {scenario.get('category', 'unknown')}")
        print(f"Mode: {self.mode}")

        # Initialize working memory
        state = create_initial_state(
            scenario_prompt=prompt,
            scenario_id=scenario_id,
            thesis_type=scenario.get("thesis_type", "neutral"),
            max_iterations=self.max_iterations
        )

        # Wrap in StructuredWorkingMemory for anchored iterative compression
        self.working_memory = StructuredWorkingMemory.from_thesis_state(state)

        # PASS 0: Load relevant thesis context
        self.printer.section("PASS 0: CONTEXT LOADING", "-")
        tickers = self._extract_tickers(prompt)
        pass0_context = self.thesis_router.build_pass0_context(prompt, tickers)
        self.pass0_context = pass0_context
        print(f"Loaded context for tickers: {tickers if tickers else 'none detected'}")
        if "No directly relevant theses" not in pass0_context:
            print(pass0_context[:500] + "..." if len(pass0_context) > 500 else pass0_context)

        self.printer.section("INITIAL STATE", "-")
        self.printer.memory_state(state)

        # Track metrics
        start_time = time.time()
        all_metrics = []

        # Main agentic loop
        while state.should_continue():
            state.start_iteration()
            iteration_start = time.time()

            self.printer.section(f"ITERATION {state.iteration}", "=")
            self.printer.memory_state(state)

            # PASS 1: EXPANSION
            self.printer.subsection("PASS 1: EXPANSION")
            expansion_result = await self._run_expansion_pass(state, prompt)

            # PASS 2: COMPRESSION
            self.printer.subsection("PASS 2: COMPRESSION")
            compression_result = await self._run_compression_pass(state, expansion_result)

            # Update state from compression
            self._update_state_from_compression(state, compression_result)

            # PASS 3: SELF-CRITIQUE
            self.printer.subsection("PASS 3: SELF-CRITIQUE")
            critique_result = await self._run_critique_pass(state, expansion_result, compression_result)

            # Apply decision
            self._apply_critique_decision(state, critique_result)

            # Check for saturation (override decision if saturated)
            if state.decision == "continue" and self._check_saturation(state):
                print("\n>>> Forcing conclusion due to saturation")
                state.decision = "conclude"

            # Track iteration metrics
            iteration_metrics = {
                "iteration": state.iteration,
                "elapsed": time.time() - iteration_start,
                "confidence": state.confidence,
                "evidence_for": len(state.evidence_for),
                "evidence_against": len(state.evidence_against),
                "open_questions": len(state.get_open_questions()),
                "decision": critique_result.get("decision", "unknown"),
            }
            all_metrics.append(iteration_metrics)
            self.printer.metrics(iteration_metrics)

        # Build analysis history for final passes
        analysis_history = f"""
Iterations completed: {state.iteration}
Final confidence: {state.confidence:.0%}
Evidence balance: +{len(state.evidence_for)} -{len(state.evidence_against)}
Decision: {state.decision}
"""

        # Check if we need escape hatch (low confidence at max iterations)
        final_synthesis = None
        escape_analysis = None

        if state.iteration >= state.max_iterations and state.confidence < 0.5:
            # Escape hatch - analysis blocked
            escape_analysis = await self._run_escape_hatch(state, analysis_history)
            state.decision = "blocked"
        elif state.decision == "conclude":
            # Normal conclusion - run synthesis
            self.printer.subsection("FINAL SYNTHESIS")
            final_synthesis = await self._run_synthesis_pass(state, analysis_history)

        # Final summary
        self.printer.section("FINAL THESIS", "=")
        print(f"\n{state.current_thesis}")
        print(f"\nConfidence: {state.confidence:.0%}")
        print(f"Iterations: {state.iteration}")
        print(f"Evidence Balance: +{len(state.evidence_for)} -{len(state.evidence_against)}")
        if state.decision == "blocked":
            print(f"\n[ANALYSIS BLOCKED - see escape hatch output above]")

        # Analyze output quality
        insight_metrics = analyze_response_quality(state.current_thesis)
        self.printer.subsection("INSIGHT METRICS")
        self.printer.metrics(insight_metrics.summary())

        # Build result
        result = {
            "scenario_id": scenario_id,
            "mode": self.mode,
            "status": "blocked" if state.decision == "blocked" else "completed",
            "timestamp": datetime.now().isoformat(),
            "final_thesis": state.current_thesis,
            "final_confidence": state.confidence,
            "iterations": state.iteration,
            "decision": state.decision,
            "iteration_metrics": all_metrics,
            "insight_metrics": insight_metrics.summary(),
            "evidence_summary": state.get_evidence_summary(),
            "context_budget": self.budget.summary(),
            "elapsed_seconds": time.time() - start_time,
            "final_synthesis": final_synthesis,
            "escape_analysis": escape_analysis,
        }

        # Save results
        self._save_results(result, scenario, state)

        return result

    async def _run_expansion_pass(self, state: ThesisState, scenario_prompt: str) -> str:
        """Run expansion pass with tool use."""
        # Use structured working memory if available
        if hasattr(self, 'working_memory'):
            memory_context = self.working_memory.compress_at_boundary()
        else:
            memory_context = state.to_context_string()

        # Inject Pass 0 context on first iteration
        if state.iteration == 1 and hasattr(self, 'pass0_context'):
            memory_context = self.pass0_context + "\n\n" + memory_context

        system_prompt = EXPANSION_SYSTEM_PROMPT.format(
            working_memory=memory_context
        )

        # Build initial message
        open_questions = state.get_open_questions()
        question_text = "\n".join([f"- [{q.priority}] {q.question}" for q in open_questions[:3]])

        user_message = f"""## Scenario
{scenario_prompt}

## Priority Questions to Investigate
{question_text}

## Context Budget
You have budget for ~3-5 tool calls. Prioritize high-value data.

Begin your expansion analysis. Use tools to gather evidence, then synthesize with markers.
"""

        messages = [{"role": "user", "content": user_message}]
        expansion_output = ""

        # Tool execution loop
        for _ in range(10):  # Max tool iterations
            response = self.client.messages.create(
                model=self.config["model"]["name"],
                max_tokens=3000,  # Expansion gets more tokens
                system=system_prompt,
                tools=self.tools,
                messages=messages
            )

            # Track tokens
            self.budget.add_reasoning(str(response.usage.output_tokens))

            # Process response
            assistant_content = []
            tool_use_blocks = []

            for block in response.content:
                if block.type == "text":
                    expansion_output += block.text
                    assistant_content.append({"type": "text", "text": block.text})
                    # Stream the text
                    self._stream_with_markers(block.text)
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input
                    })
                    tool_use_blocks.append(block)

            messages.append({"role": "assistant", "content": assistant_content})

            if response.stop_reason == "end_turn":
                break

            # Execute tools
            if tool_use_blocks:
                tool_results = []
                for tool_block in tool_use_blocks:
                    self.printer.tool_call(tool_block.name, tool_block.input)
                    result = await execute_tool(tool_block.name, tool_block.input)
                    self.printer.tool_result(result.get("success", False))

                    # Track data tokens
                    result_str = json.dumps(result)
                    self.budget.add_data(result_str)

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": result_str
                    })

                messages.append({"role": "user", "content": tool_results})

        self.budget.record_pass("expansion")
        return expansion_output

    async def _run_compression_pass(self, state: ThesisState, expansion_output: str) -> dict:
        """Run compression pass to synthesize findings."""
        system_prompt = COMPRESSION_SYSTEM_PROMPT.format(
            working_memory=state.to_context_string(),
            expansion_output=expansion_output[:4000]  # Truncate if needed
        )

        response = self.client.messages.create(
            model=self.config["model"]["name"],
            max_tokens=1500,  # Compression is shorter
            system=system_prompt,
            messages=[{"role": "user", "content": "Synthesize and output JSON."}]
        )

        self.budget.add_reasoning(str(response.usage.output_tokens))
        self.budget.record_pass("compression")

        # Extract JSON from response
        response_text = response.content[0].text
        print(response_text)

        try:
            # Find JSON in response
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Fallback
        return {
            "thesis_update": "no change",
            "confidence": state.confidence,
            "evidence_summary": {"supporting": [], "challenging": []},
            "next_priority": "Continue investigation",
            "areas_investigated": []
        }

    async def _run_critique_pass(self, state: ThesisState, expansion: str, compression: dict) -> dict:
        """Run self-critique to decide next action."""
        recent_analysis = f"""
## Expansion Summary
{expansion[:2000]}

## Compression Result
{json.dumps(compression, indent=2)}
"""

        system_prompt = CRITIQUE_SYSTEM_PROMPT.format(
            working_memory=state.to_context_string(),
            recent_analysis=recent_analysis
        )

        response = self.client.messages.create(
            model=self.config["model"]["name"],
            max_tokens=1000,
            system=system_prompt,
            messages=[{"role": "user", "content": "Critique your reasoning and decide."}]
        )

        self.budget.record_pass("critique")

        # Extract JSON
        response_text = response.content[0].text
        print(response_text)

        try:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                result = json.loads(json_str)

                self.printer.decision(
                    result.get("decision", "CONTINUE"),
                    result.get("decision_reasoning", "")
                )
                return result
        except json.JSONDecodeError:
            pass

        # Default to continue
        return {"decision": "CONTINUE", "decision_reasoning": "Unable to parse critique"}

    def _update_state_from_compression(self, state: ThesisState, compression: dict):
        """Update working memory from compression output."""
        # Update thesis if changed
        thesis_update = compression.get("thesis_update", "no change")
        if thesis_update != "no change":
            state.update_thesis(thesis_update)

        # Update confidence
        new_confidence = compression.get("confidence", state.confidence)
        if isinstance(new_confidence, (int, float)):
            state.update_confidence(float(new_confidence))

        # Add evidence
        evidence_summary = compression.get("evidence_summary", {})
        for point in evidence_summary.get("supporting", []):
            state.add_evidence(point, "compression", 0.6, "supports")
        for point in evidence_summary.get("challenging", []):
            state.add_evidence(point, "compression", 0.6, "challenges")

        # Update investigated areas
        for area in compression.get("areas_investigated", []):
            if area not in state.investigated_areas:
                state.investigated_areas.append(area)

        # Add next priority question
        next_q = compression.get("next_priority")
        if next_q:
            state.add_question(next_q, "high")

        # Update StructuredWorkingMemory if available
        if hasattr(self, 'working_memory'):
            # Add insights from compression reasoning
            confidence_reasoning = compression.get("confidence_reasoning", "")
            if confidence_reasoning:
                self.working_memory.add_insight(confidence_reasoning, new_confidence)

            # Add next priority as a thread
            if next_q:
                self.working_memory.add_thread(next_q, "high")

    def _apply_critique_decision(self, state: ThesisState, critique: dict):
        """Apply structured critique decision to state."""
        decision = critique.get("decision", "CONTINUE").upper()

        # Add strongest counter as challenging evidence
        counter = critique.get("strongest_counter")
        if counter:
            state.add_evidence(counter, "self_critique", 0.8, "challenges")

        # Add evidence gaps as high-priority questions
        for gap in critique.get("evidence_gaps", []):
            claim = gap.get("claim", "")
            needed = gap.get("needed", "")
            if needed:
                state.add_question(f"Evidence needed: {needed} (for claim: {claim[:50]}...)", "high")

        # Add vagueness issues as questions to address
        for issue in critique.get("vagueness_issues", [])[:2]:  # Limit to top 2
            demand = issue.get("demand", "")
            if demand:
                state.add_question(f"Clarify: {demand}", "medium")

        # Log the real need test result
        real_need = critique.get("real_need_test")
        if real_need and real_need.lower() not in ["n/a", "none", ""]:
            # If real need test shows no actual problem, flag it
            if "nothing" in real_need.lower() or "no impact" in real_need.lower():
                state.add_evidence(f"Real need test: {real_need}", "self_critique", 0.7, "challenges")

        # Apply decision
        if decision == "CONCLUDE":
            state.decision = "conclude"
        elif decision == "PIVOT":
            state.decision = "pivot"
            state.pivot_reason = critique.get("decision_reasoning")
        else:
            state.decision = "continue"

    def _check_completion_token(self, text: str) -> bool:
        """Check if response contains the [ANALYSIS_COMPLETE] token."""
        return "[ANALYSIS_COMPLETE]" in text

    def _check_blocked_token(self, text: str) -> bool:
        """Check if response contains the [ANALYSIS_BLOCKED] token."""
        return "[ANALYSIS_BLOCKED]" in text

    def _check_saturation(self, state: ThesisState) -> bool:
        """
        Check if analysis has saturated and should conclude.

        Returns True if we should force conclusion.
        """
        saturation = state.detect_saturation()

        if saturation["saturated"]:
            self.printer.subsection("SATURATION DETECTED")
            for reason in saturation["reasons"]:
                print(f"  - {reason}")
            print(f"  Score: {saturation['saturation_score']:.1f}")
            print(f"  Recommendation: {saturation['recommendation']}")
            return saturation["recommendation"] == "conclude"

        return False

    async def _run_synthesis_pass(self, state: ThesisState, analysis_history: str) -> str:
        """
        Run final synthesis pass when concluding.

        Returns synthesis text with [ANALYSIS_COMPLETE] token.
        """
        system_prompt = SYNTHESIS_PROMPT.format(
            working_memory=state.to_context_string(compress_evidence=False),
            analysis_history=analysis_history[:3000]  # Truncate if needed
        )

        response = self.client.messages.create(
            model=self.config["model"]["name"],
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": "Provide your final synthesis."}]
        )

        synthesis = response.content[0].text
        print(synthesis)

        # Verify completion token
        if not self._check_completion_token(synthesis):
            print("\n[WARNING] Synthesis missing [ANALYSIS_COMPLETE] token")

        return synthesis

    async def _run_escape_hatch(self, state: ThesisState, analysis_history: str) -> str:
        """
        Run escape hatch when analysis is blocked (max iterations with low confidence).

        Returns escape hatch analysis with [ANALYSIS_BLOCKED] token.
        """
        self.printer.subsection("ESCAPE HATCH ACTIVATED")
        print(f"Confidence: {state.confidence:.0%} (below threshold)")
        print(f"Iterations: {state.iteration}/{state.max_iterations}")

        system_prompt = ESCAPE_HATCH_PROMPT.format(
            working_memory=state.to_context_string(compress_evidence=False),
            analysis_history=analysis_history[:3000]
        )

        response = self.client.messages.create(
            model=self.config["model"]["name"],
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": "Explain why this analysis is blocked."}]
        )

        escape_analysis = response.content[0].text
        print(escape_analysis)

        # Verify blocked token
        if not self._check_blocked_token(escape_analysis):
            print("\n[WARNING] Escape hatch missing [ANALYSIS_BLOCKED] token")

        return escape_analysis

    def _stream_with_markers(self, text: str):
        """Print text with semantic markers highlighted."""
        # Simple marker detection and highlighting
        markers = ["[INSIGHT]", "[EVIDENCE]", "[RISK]", "[COUNTER]", "[QUESTION]"]

        lines = text.split("\n")
        for line in lines:
            highlighted = False
            for marker in markers:
                if marker in line:
                    marker_name = marker.strip("[]")
                    self.printer.insight(marker_name, line.replace(marker, "").strip())
                    highlighted = True
                    break
            if not highlighted and line.strip():
                print(line)

    def _save_results(self, result: dict, scenario: dict, state: ThesisState):
        """Save experiment results."""
        output_dir = OUTPUTS_DIR / self.mode / scenario["id"]
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save full state
        state.save(output_dir / "state.json")

        # Save result summary
        with open(output_dir / "result.json", "w") as f:
            json.dump(result, f, indent=2, default=str)

        # Save readable report
        with open(output_dir / "report.md", "w") as f:
            f.write(f"# Agentic Analysis: {scenario['id']}\n\n")
            f.write(f"**Mode**: {self.mode}\n")
            f.write(f"**Iterations**: {state.iteration}\n")
            f.write(f"**Final Confidence**: {state.confidence:.0%}\n")
            f.write(f"**Decision**: {state.decision}\n\n")

            f.write("## Final Thesis\n\n")
            f.write(f"{state.current_thesis}\n\n")

            f.write("## Evidence\n\n")
            f.write("### Supporting\n")
            for e in state.evidence_for:
                f.write(f"- [{e.source}] {e.content}\n")
            f.write("\n### Challenging\n")
            for e in state.evidence_against:
                f.write(f"- [{e.source}] {e.content}\n")

            f.write("\n## Confidence History\n\n")
            for iteration, conf in state.confidence_history:
                f.write(f"- Iteration {iteration}: {conf:.0%}\n")

        print(f"\nResults saved to: {output_dir}")


# =============================================================================
# Main
# =============================================================================

async def run_agentic_experiment(
    mode: Literal["baseline", "graph"],
    scenario_filter: str = "all",
    stream: bool = True,
    max_iterations: int = 5
):
    """Run agentic experiment."""
    scenarios_data = load_thesis_scenarios()
    scenarios = scenarios_data["scenarios"]

    # Filter
    if scenario_filter != "all":
        scenarios = {k: v for k, v in scenarios.items() if v["id"] == scenario_filter}

    if not scenarios:
        print(f"No scenarios found matching: {scenario_filter}")
        return

    runner = AgenticStrategyRunner(
        mode=mode,
        stream=stream,
        max_iterations=max_iterations
    )

    results = []
    for name, scenario in scenarios.items():
        try:
            result = await runner.run_scenario(scenario)
            results.append(result)
        except Exception as e:
            print(f"\nError in {name}: {e}")
            import traceback
            traceback.print_exc()

    # Summary
    print("\n" + "=" * 70)
    print("EXPERIMENT COMPLETE")
    print("=" * 70)

    completed = sum(1 for r in results if r["status"] == "completed")
    print(f"Completed: {completed}/{len(scenarios)}")

    if completed > 0:
        avg_iterations = sum(r["iterations"] for r in results if r["status"] == "completed") / completed
        avg_confidence = sum(r["final_confidence"] for r in results if r["status"] == "completed") / completed
        print(f"Avg iterations: {avg_iterations:.1f}")
        print(f"Avg final confidence: {avg_confidence:.0%}")


def main():
    parser = argparse.ArgumentParser(description="Run agentic strategy experiment")
    parser.add_argument(
        "--mode",
        choices=["baseline", "graph"],
        default="baseline",
        help="Which mode to run"
    )
    parser.add_argument(
        "--scenario",
        default="st-1",
        help="Scenario ID or 'all'"
    )
    parser.add_argument(
        "--no-stream",
        action="store_true",
        help="Disable streaming output"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=5,
        help="Maximum iterations per scenario"
    )

    args = parser.parse_args()

    asyncio.run(run_agentic_experiment(
        mode=args.mode,
        scenario_filter=args.scenario,
        stream=not args.no_stream,
        max_iterations=args.max_iterations
    ))


if __name__ == "__main__":
    main()
