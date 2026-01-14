"""Working Memory for Agentic Strategy Loop.

This module provides state management for multi-turn thesis refinement.
The agent maintains working memory across iterations, allowing it to:
- Track thesis evolution
- Accumulate evidence
- Remember open questions
- Calibrate confidence
"""

from dataclasses import dataclass, field
from typing import Literal, Optional
from datetime import datetime
import json


@dataclass
class Evidence:
    """A piece of evidence for or against the thesis."""
    content: str
    source: str  # e.g., "get_company_financials", "historical_analogue"
    strength: float  # 0-1, how compelling
    direction: Literal["supports", "challenges", "neutral"]
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "source": self.source,
            "strength": self.strength,
            "direction": self.direction,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Evidence":
        return cls(**d)


@dataclass
class OpenQuestion:
    """An unanswered question that needs investigation."""
    question: str
    priority: Literal["high", "medium", "low"]
    suggested_tools: list[str] = field(default_factory=list)
    status: Literal["open", "investigating", "answered", "deferred"] = "open"

    def to_dict(self) -> dict:
        return {
            "question": self.question,
            "priority": self.priority,
            "suggested_tools": self.suggested_tools,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "OpenQuestion":
        return cls(**d)


@dataclass
class ThesisState:
    """
    Working memory for thesis refinement.

    This is the state that persists across iterations of the agentic loop.
    """
    # Core thesis
    current_thesis: str
    thesis_type: Literal["bull", "bear", "neutral", "contrarian"] = "neutral"

    # Evidence tracking
    evidence_for: list[Evidence] = field(default_factory=list)
    evidence_against: list[Evidence] = field(default_factory=list)

    # Key evidence - NEVER compressed, always shown in full
    # This solves the artifact trail problem identified in lit review
    key_evidence: list[Evidence] = field(default_factory=list)

    # Investigation state
    open_questions: list[OpenQuestion] = field(default_factory=list)
    investigated_areas: list[str] = field(default_factory=list)

    # Confidence tracking
    confidence: float = 0.5  # 0-1
    confidence_history: list[tuple[int, float]] = field(default_factory=list)

    # Iteration tracking
    iteration: int = 0
    max_iterations: int = 5

    # Decision state
    decision: Optional[Literal["continue", "conclude", "pivot"]] = None
    pivot_reason: Optional[str] = None

    # Context tracking
    total_data_tokens: int = 0
    total_reasoning_tokens: int = 0

    # Metadata
    scenario_id: str = ""
    started_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def add_evidence(
        self,
        content: str,
        source: str,
        strength: float,
        direction: Literal["supports", "challenges", "neutral"]
    ):
        """Add a piece of evidence."""
        evidence = Evidence(
            content=content,
            source=source,
            strength=strength,
            direction=direction,
        )
        if direction == "supports":
            self.evidence_for.append(evidence)
        elif direction == "challenges":
            self.evidence_against.append(evidence)
        # Neutral evidence goes to both? Or neither? For now, neither.

    def add_key_evidence(
        self,
        content: str,
        source: str,
        strength: float,
        direction: Literal["supports", "challenges", "neutral"]
    ):
        """
        Add key evidence that should NEVER be compressed.

        Key evidence persists through all compression operations and is
        always shown in full in context strings. Use for critical facts
        that must be preserved across iterations.

        Also adds to regular evidence_for/evidence_against for balance tracking.
        """
        evidence = Evidence(
            content=content,
            source=source,
            strength=strength,
            direction=direction,
        )
        self.key_evidence.append(evidence)

        # Also add to regular evidence lists for balance tracking
        if direction == "supports":
            self.evidence_for.append(evidence)
        elif direction == "challenges":
            self.evidence_against.append(evidence)

    def add_question(
        self,
        question: str,
        priority: Literal["high", "medium", "low"] = "medium",
        suggested_tools: list[str] = None
    ):
        """Add an open question."""
        self.open_questions.append(OpenQuestion(
            question=question,
            priority=priority,
            suggested_tools=suggested_tools or [],
        ))

    def answer_question(self, question: str, answer: str = None):
        """Mark a question as answered."""
        for q in self.open_questions:
            if q.question == question:
                q.status = "answered"
                break

    def update_confidence(self, new_confidence: float, reason: str = None):
        """Update confidence level and track history."""
        self.confidence_history.append((self.iteration, self.confidence))
        self.confidence = new_confidence

    def update_thesis(self, new_thesis: str):
        """Update the current thesis."""
        self.current_thesis = new_thesis

    def start_iteration(self):
        """Called at the start of each iteration."""
        self.iteration += 1

    def should_continue(self) -> bool:
        """Determine if we should continue iterating."""
        if self.iteration >= self.max_iterations:
            return False
        if self.decision == "conclude":
            return False
        if len([q for q in self.open_questions if q.status == "open"]) == 0:
            # No more open questions
            return False
        return True

    def get_open_questions(self) -> list[OpenQuestion]:
        """Get all open questions sorted by priority."""
        priority_order = {"high": 0, "medium": 1, "low": 2}
        open_qs = [q for q in self.open_questions if q.status == "open"]
        return sorted(open_qs, key=lambda q: priority_order[q.priority])

    def get_evidence_summary(self) -> dict:
        """Get summary of evidence balance."""
        for_strength = sum(e.strength for e in self.evidence_for)
        against_strength = sum(e.strength for e in self.evidence_against)

        return {
            "supporting_count": len(self.evidence_for),
            "challenging_count": len(self.evidence_against),
            "supporting_strength": for_strength,
            "challenging_strength": against_strength,
            "balance": for_strength - against_strength,
        }

    def detect_saturation(self, delta_threshold: float = 0.05) -> dict:
        """
        Detect if analysis has saturated (no new information being gained).

        Checks:
        1. Confidence stable for 2+ passes (change < delta_threshold)
        2. No new key evidence in last pass
        3. Open questions decreasing or stable

        Returns:
            dict with:
            - saturated: bool
            - recommendation: "continue" | "conclude"
            - reasons: list of saturation indicators
        """
        reasons = []
        saturation_score = 0

        # 1. Check confidence stability
        if len(self.confidence_history) >= 2:
            recent_deltas = []
            for i in range(max(0, len(self.confidence_history) - 2), len(self.confidence_history)):
                if i > 0:
                    delta = abs(self.confidence_history[i][1] - self.confidence_history[i-1][1])
                    recent_deltas.append(delta)

            if recent_deltas and all(d < delta_threshold for d in recent_deltas):
                reasons.append(f"Confidence stable for {len(recent_deltas)+1} passes (delta < {delta_threshold:.0%})")
                saturation_score += 1

        # 2. Check if confidence is high enough to conclude
        if self.confidence >= 0.75:
            reasons.append(f"High confidence ({self.confidence:.0%})")
            saturation_score += 1
        elif self.confidence <= 0.25:
            reasons.append(f"Low confidence plateau ({self.confidence:.0%})")
            saturation_score += 0.5

        # 3. Check key evidence growth
        # If no new key evidence was added this iteration, that's a signal
        recent_key_evidence = [e for e in self.key_evidence
                               if hasattr(e, 'timestamp')]
        if self.iteration >= 2 and len(self.key_evidence) == 0:
            reasons.append("No key evidence identified")
            saturation_score += 0.5

        # 4. Check open questions
        open_qs = len(self.get_open_questions())
        if open_qs == 0:
            reasons.append("All questions answered")
            saturation_score += 1
        elif open_qs <= 1 and self.iteration >= 2:
            reasons.append(f"Questions converging ({open_qs} remaining)")
            saturation_score += 0.5

        # 5. Check iteration progress
        if self.iteration >= self.max_iterations - 1:
            reasons.append("Approaching max iterations")
            saturation_score += 0.5

        # Determine saturation
        saturated = saturation_score >= 2.0

        # Recommendation logic
        if saturated and self.confidence >= 0.5:
            recommendation = "conclude"
        elif saturated and self.confidence < 0.5:
            recommendation = "conclude"  # Even low confidence, if saturated, conclude
        else:
            recommendation = "continue"

        return {
            "saturated": saturated,
            "recommendation": recommendation,
            "saturation_score": saturation_score,
            "reasons": reasons,
            "confidence": self.confidence,
            "open_questions": open_qs,
            "iteration": self.iteration,
        }

    def to_context_string(self, compress_evidence: bool = True) -> str:
        """
        Convert to string for injection into agent context.

        Args:
            compress_evidence: If True, truncate regular evidence.
                              Key evidence is ALWAYS shown in full.
        """
        lines = [
            "## Working Memory State",
            f"**Iteration**: {self.iteration}/{self.max_iterations}",
            f"**Current Thesis**: {self.current_thesis}",
            f"**Thesis Type**: {self.thesis_type}",
            f"**Confidence**: {self.confidence:.0%}",
            "",
            f"### Evidence Balance",
            f"- Supporting: {len(self.evidence_for)} pieces (strength: {sum(e.strength for e in self.evidence_for):.2f})",
            f"- Challenging: {len(self.evidence_against)} pieces (strength: {sum(e.strength for e in self.evidence_against):.2f})",
            "",
        ]

        # KEY EVIDENCE - Never compressed, always shown in full
        if self.key_evidence:
            lines.append("### Key Evidence (Preserved)")
            for e in self.key_evidence:
                direction_marker = "+" if e.direction == "supports" else "-" if e.direction == "challenges" else "○"
                lines.append(f"- [{direction_marker}][{e.source}][{e.strength:.1f}] {e.content}")
            lines.append("")

        # Regular evidence - can be compressed
        if compress_evidence:
            # Get evidence not in key_evidence
            regular_for = [e for e in self.evidence_for if e not in self.key_evidence]
            regular_against = [e for e in self.evidence_against if e not in self.key_evidence]

            if regular_for:
                lines.append("### Supporting Evidence (Recent)")
                for e in regular_for[-3:]:  # Last 3
                    lines.append(f"- [{e.source}] {e.content[:100]}...")
                if len(regular_for) > 3:
                    lines.append(f"  (+ {len(regular_for) - 3} earlier)")
                lines.append("")

            if regular_against:
                lines.append("### Challenging Evidence (Recent)")
                for e in regular_against[-3:]:  # Last 3
                    lines.append(f"- [{e.source}] {e.content[:100]}...")
                if len(regular_against) > 3:
                    lines.append(f"  (+ {len(regular_against) - 3} earlier)")
                lines.append("")
        else:
            # Full evidence (for synthesis pass)
            regular_for = [e for e in self.evidence_for if e not in self.key_evidence]
            regular_against = [e for e in self.evidence_against if e not in self.key_evidence]

            if regular_for:
                lines.append("### All Supporting Evidence")
                for e in regular_for:
                    lines.append(f"- [{e.source}][{e.strength:.1f}] {e.content}")
                lines.append("")

            if regular_against:
                lines.append("### All Challenging Evidence")
                for e in regular_against:
                    lines.append(f"- [{e.source}][{e.strength:.1f}] {e.content}")
                lines.append("")

        open_qs = self.get_open_questions()
        if open_qs:
            lines.append("### Open Questions")
            for q in open_qs[:5]:  # Top 5
                lines.append(f"- [{q.priority}] {q.question}")
            lines.append("")

        if self.investigated_areas:
            lines.append("### Already Investigated")
            lines.append(f"- {', '.join(self.investigated_areas)}")
            lines.append("")

        return "\n".join(lines)

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "current_thesis": self.current_thesis,
            "thesis_type": self.thesis_type,
            "evidence_for": [e.to_dict() for e in self.evidence_for],
            "evidence_against": [e.to_dict() for e in self.evidence_against],
            "key_evidence": [e.to_dict() for e in self.key_evidence],
            "open_questions": [q.to_dict() for q in self.open_questions],
            "investigated_areas": self.investigated_areas,
            "confidence": self.confidence,
            "confidence_history": self.confidence_history,
            "iteration": self.iteration,
            "max_iterations": self.max_iterations,
            "decision": self.decision,
            "pivot_reason": self.pivot_reason,
            "total_data_tokens": self.total_data_tokens,
            "total_reasoning_tokens": self.total_reasoning_tokens,
            "scenario_id": self.scenario_id,
            "started_at": self.started_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ThesisState":
        """Deserialize from dictionary."""
        state = cls(
            current_thesis=d["current_thesis"],
            thesis_type=d.get("thesis_type", "neutral"),
        )
        state.evidence_for = [Evidence.from_dict(e) for e in d.get("evidence_for", [])]
        state.evidence_against = [Evidence.from_dict(e) for e in d.get("evidence_against", [])]
        state.key_evidence = [Evidence.from_dict(e) for e in d.get("key_evidence", [])]
        state.open_questions = [OpenQuestion.from_dict(q) for q in d.get("open_questions", [])]
        state.investigated_areas = d.get("investigated_areas", [])
        state.confidence = d.get("confidence", 0.5)
        state.confidence_history = d.get("confidence_history", [])
        state.iteration = d.get("iteration", 0)
        state.max_iterations = d.get("max_iterations", 5)
        state.decision = d.get("decision")
        state.pivot_reason = d.get("pivot_reason")
        state.total_data_tokens = d.get("total_data_tokens", 0)
        state.total_reasoning_tokens = d.get("total_reasoning_tokens", 0)
        state.scenario_id = d.get("scenario_id", "")
        state.started_at = d.get("started_at", datetime.now().isoformat())
        return state

    def save(self, filepath: str):
        """Save state to JSON file."""
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, filepath: str) -> "ThesisState":
        """Load state from JSON file."""
        with open(filepath, 'r') as f:
            return cls.from_dict(json.load(f))


# Helper functions for creating initial states from scenarios
def create_initial_state(
    scenario_prompt: str,
    scenario_id: str = "",
    thesis_type: Literal["bull", "bear", "neutral", "contrarian"] = "neutral",
    max_iterations: int = 5
) -> ThesisState:
    """Create initial thesis state from a scenario prompt."""

    # Extract thesis if one is provided in the prompt
    # Look for "THESIS:" pattern
    thesis = ""
    if "THESIS:" in scenario_prompt:
        lines = scenario_prompt.split("\n")
        for i, line in enumerate(lines):
            if "THESIS:" in line:
                # Get the thesis text (may span multiple lines)
                thesis_lines = [line.replace("THESIS:", "").strip()]
                # Continue until we hit an empty line or new section
                for j in range(i + 1, len(lines)):
                    if lines[j].strip() == "" or lines[j].strip().startswith("##"):
                        break
                    thesis_lines.append(lines[j].strip())
                thesis = " ".join(thesis_lines).strip().strip('"')
                break

    if not thesis:
        # No thesis provided - agent needs to generate one
        thesis = "[To be generated from scenario]"

    state = ThesisState(
        current_thesis=thesis,
        thesis_type=thesis_type,
        scenario_id=scenario_id,
        max_iterations=max_iterations,
    )

    # Add initial open question based on scenario type
    if "stress test" in scenario_prompt.lower():
        state.add_question("What are the strongest counterarguments to this thesis?", "high")
        state.add_question("What historical analogues suggest this could fail?", "high")
    elif "contrarian" in scenario_prompt.lower():
        state.add_question("What is consensus missing?", "high")
        state.add_question("What evidence supports a non-consensus view?", "high")
    elif "pre-mortem" in scenario_prompt.lower() or "premortem" in scenario_prompt.lower():
        state.add_question("What would cause this thesis to fail?", "high")
        state.add_question("What warning signs should we watch for?", "high")
    elif "refine" in scenario_prompt.lower():
        state.add_question("Is the core assumption valid?", "high")
        state.add_question("What metrics would validate/invalidate this?", "medium")
    else:
        state.add_question("What evidence supports this thesis?", "high")
        state.add_question("What evidence challenges this thesis?", "high")

    return state


# -----------------------------------------------------------------------------
# StructuredWorkingMemory - Anchored Iterative Compression
# -----------------------------------------------------------------------------

@dataclass
class StructuredWorkingMemory:
    """
    Anchored iterative compression for multi-pass reasoning.

    Based on lit review Entry 9a: "Anchored Iterative: 98.6% compression, 3.70/5 quality"

    Four sections:
    1. Active Insights - Current hypotheses being explored (compressible)
    2. Resolved Tensions - Questions answered, conflicts resolved (compressible)
    3. Key Evidence - Critical facts supporting/challenging (NEVER compressed)
    4. Current Threads - Open investigations (compressible)
    """

    # Core thesis state (contains key_evidence)
    thesis_state: ThesisState

    # Active Insights - hypotheses being explored
    # Format: {"insight": str, "confidence": float, "pass_added": int}
    active_insights: list[dict] = field(default_factory=list)

    # Resolved Tensions - answered questions and resolved conflicts
    # Format: {"question": str, "resolution": str, "pass_resolved": int}
    resolved_tensions: list[dict] = field(default_factory=list)

    # Current Threads - open investigations
    # Format: {"thread": str, "priority": str, "status": str, "pass_added": int}
    current_threads: list[dict] = field(default_factory=list)

    # Compression tracking
    compression_history: list[dict] = field(default_factory=list)
    last_compressed_at_pass: int = 0

    def add_insight(self, insight: str, confidence: float = 0.5):
        """Add an active insight from current pass."""
        self.active_insights.append({
            "insight": insight,
            "confidence": confidence,
            "pass_added": self.thesis_state.iteration,
        })

    def resolve_tension(self, question: str, resolution: str):
        """Mark a question as resolved."""
        self.resolved_tensions.append({
            "question": question,
            "resolution": resolution,
            "pass_resolved": self.thesis_state.iteration,
        })
        # Also update thesis_state open questions
        self.thesis_state.answer_question(question, resolution)

    def add_thread(self, thread: str, priority: str = "medium"):
        """Add an open investigation thread."""
        self.current_threads.append({
            "thread": thread,
            "priority": priority,
            "status": "open",
            "pass_added": self.thesis_state.iteration,
        })

    def close_thread(self, thread: str):
        """Mark a thread as complete."""
        for t in self.current_threads:
            if t["thread"] == thread:
                t["status"] = "closed"

    def compress_at_boundary(self, target_tokens: int = 2000) -> str:
        """
        Compress working memory at pass boundary.

        Preserves:
        - Key evidence (NEVER compressed)
        - Recent active insights (last 5)
        - All resolved tensions (summarized)
        - Open threads

        Returns compressed context string.
        """
        lines = [
            "## Working Memory (Compressed)",
            f"**Thesis**: {self.thesis_state.current_thesis}",
            f"**Confidence**: {self.thesis_state.confidence:.0%}",
            f"**Pass**: {self.thesis_state.iteration}/{self.thesis_state.max_iterations}",
            "",
        ]

        # Key Evidence - NEVER compressed
        if self.thesis_state.key_evidence:
            lines.append("### Key Evidence (Preserved)")
            for e in self.thesis_state.key_evidence:
                marker = "+" if e.direction == "supports" else "-" if e.direction == "challenges" else "○"
                lines.append(f"- [{marker}] {e.content}")
            lines.append("")

        # Active Insights - keep recent, summarize old
        if self.active_insights:
            recent = self.active_insights[-5:]  # Last 5
            lines.append("### Active Insights")
            for i in recent:
                lines.append(f"- [{i['confidence']:.0%}] {i['insight']}")
            if len(self.active_insights) > 5:
                lines.append(f"  (+ {len(self.active_insights) - 5} earlier insights)")
            lines.append("")

        # Resolved Tensions - last 3 full, then count
        if self.resolved_tensions:
            lines.append("### Resolved")
            for t in self.resolved_tensions[-3:]:
                q_short = t['question'][:50] + "..." if len(t['question']) > 50 else t['question']
                r_short = t['resolution'][:50] + "..." if len(t['resolution']) > 50 else t['resolution']
                lines.append(f"- Q: {q_short} → {r_short}")
            if len(self.resolved_tensions) > 3:
                lines.append(f"  (+ {len(self.resolved_tensions) - 3} earlier resolutions)")
            lines.append("")

        # Current Threads - open only
        open_threads = [t for t in self.current_threads if t["status"] == "open"]
        if open_threads:
            lines.append("### Open Threads")
            for t in open_threads:
                lines.append(f"- [{t['priority']}] {t['thread']}")
            lines.append("")

        # Evidence balance summary
        evidence_summary = self.thesis_state.get_evidence_summary()
        lines.append("### Evidence Balance")
        lines.append(f"- Supporting: {evidence_summary['supporting_count']} (strength: {evidence_summary['supporting_strength']:.1f})")
        lines.append(f"- Challenging: {evidence_summary['challenging_count']} (strength: {evidence_summary['challenging_strength']:.1f})")
        lines.append("")

        # Track compression
        compressed = "\n".join(lines)
        self.compression_history.append({
            "pass": self.thesis_state.iteration,
            "pre_insights": len(self.active_insights),
            "post_insights": min(5, len(self.active_insights)),
            "char_count": len(compressed),
        })
        self.last_compressed_at_pass = self.thesis_state.iteration

        return compressed

    def to_full_context(self) -> str:
        """Get full uncompressed context (for synthesis pass)."""
        return self.thesis_state.to_context_string(compress_evidence=False)

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "thesis_state": self.thesis_state.to_dict(),
            "active_insights": self.active_insights,
            "resolved_tensions": self.resolved_tensions,
            "current_threads": self.current_threads,
            "compression_history": self.compression_history,
            "last_compressed_at_pass": self.last_compressed_at_pass,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "StructuredWorkingMemory":
        """Deserialize from dictionary."""
        return cls(
            thesis_state=ThesisState.from_dict(d["thesis_state"]),
            active_insights=d.get("active_insights", []),
            resolved_tensions=d.get("resolved_tensions", []),
            current_threads=d.get("current_threads", []),
            compression_history=d.get("compression_history", []),
            last_compressed_at_pass=d.get("last_compressed_at_pass", 0),
        )

    @classmethod
    def from_thesis_state(cls, state: ThesisState) -> "StructuredWorkingMemory":
        """Create StructuredWorkingMemory wrapping an existing ThesisState."""
        return cls(thesis_state=state)


if __name__ == "__main__":
    # Test the working memory
    state = ThesisState(
        current_thesis="NVIDIA's datacenter dominance will persist for 5+ years",
        thesis_type="bull",
        scenario_id="test-1",
    )

    # Add some evidence
    state.add_evidence(
        "CUDA moat with 3M+ developers",
        "analyst_report",
        0.8,
        "supports"
    )
    state.add_evidence(
        "AMD ROCm gaining traction",
        "competitor_analysis",
        0.6,
        "challenges"
    )

    # Add questions
    state.add_question("What happened to Intel's x86 moat?", "high", ["find_market_analogues"])
    state.add_question("What's AMD's software roadmap?", "medium")

    # Update confidence
    state.update_confidence(0.65, "More supporting than challenging evidence")

    # Print context string
    print(state.to_context_string())

    # Test serialization
    state.save("/tmp/test_state.json")
    loaded = ThesisState.load("/tmp/test_state.json")
    print(f"\nLoaded state thesis: {loaded.current_thesis}")
    print(f"Loaded confidence: {loaded.confidence}")
