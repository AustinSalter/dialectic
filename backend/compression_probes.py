"""Probe-based evaluation for compression quality.

Implements probes to verify that critical information survives compression:
- Recall probes: Can specific facts be recalled?
- Artifact probes: Are key evidence items preserved?
- Continuation probes: Can reasoning continue coherently?
- Decision probes: Would the same decision be reached?

Usage:
    probes = create_probes(original_context, thesis_state)
    results = await run_probes(compressed_context, probes, client)
    summary = summarize_probe_results(results)
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Any

logger = logging.getLogger(__name__)


class ProbeType(Enum):
    """Types of compression quality probes."""
    RECALL = "recall"           # Can recall specific facts
    ARTIFACT = "artifact"       # Key evidence preserved
    CONTINUATION = "continuation"  # Reasoning can continue
    DECISION = "decision"       # Same decision reachable


@dataclass
class Probe:
    """A single probe to test compression quality."""
    probe_type: ProbeType
    question: str
    expected_answer: str
    source_quote: Optional[str] = None  # Original text this tests
    weight: float = 1.0  # Importance weight for scoring

    def to_dict(self) -> dict:
        return {
            "type": self.probe_type.value,
            "question": self.question,
            "expected": self.expected_answer,
            "source_quote": self.source_quote,
            "weight": self.weight
        }


@dataclass
class ProbeResult:
    """Result of running a single probe."""
    probe: Probe
    actual_answer: str
    score: float  # 0.0 to 1.0
    reasoning: str
    passed: bool

    def to_dict(self) -> dict:
        return {
            "probe": self.probe.to_dict(),
            "actual_answer": self.actual_answer,
            "score": self.score,
            "reasoning": self.reasoning,
            "passed": self.passed
        }


@dataclass
class ProbeResults:
    """Aggregate results from all probes."""
    results: list[ProbeResult] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def overall_score(self) -> float:
        """Weighted average score across all probes."""
        if not self.results:
            return 0.0
        total_weight = sum(r.probe.weight for r in self.results)
        if total_weight == 0:
            return 0.0
        weighted_sum = sum(r.score * r.probe.weight for r in self.results)
        return weighted_sum / total_weight

    @property
    def pass_rate(self) -> float:
        """Percentage of probes that passed."""
        if not self.results:
            return 0.0
        return sum(1 for r in self.results if r.passed) / len(self.results)

    def by_type(self) -> dict[str, dict]:
        """Get scores broken down by probe type."""
        by_type = {}
        for probe_type in ProbeType:
            type_results = [r for r in self.results if r.probe.probe_type == probe_type]
            if type_results:
                by_type[probe_type.value] = {
                    "count": len(type_results),
                    "passed": sum(1 for r in type_results if r.passed),
                    "avg_score": sum(r.score for r in type_results) / len(type_results),
                    "pass_rate": sum(1 for r in type_results if r.passed) / len(type_results)
                }
        return by_type

    def to_dict(self) -> dict:
        return {
            "overall_score": self.overall_score,
            "pass_rate": self.pass_rate,
            "by_type": self.by_type(),
            "timestamp": self.timestamp,
            "results": [r.to_dict() for r in self.results]
        }


# -----------------------------------------------------------------------------
# Probe Creation
# -----------------------------------------------------------------------------

def create_probes(
    original_context: str,
    thesis_state: Any,
    max_probes_per_type: int = 3
) -> list[Probe]:
    """
    Generate probes to test compression quality.

    Args:
        original_context: The full working memory context before compression
        thesis_state: ThesisState object with thesis details
        max_probes_per_type: Maximum probes to generate per type

    Returns:
        List of Probe objects to run against compressed context
    """
    probes = []

    # 1. Recall probes - test factual retention
    probes.extend(_create_recall_probes(original_context, thesis_state, max_probes_per_type))

    # 2. Artifact probes - test key evidence preservation
    probes.extend(_create_artifact_probes(thesis_state, max_probes_per_type))

    # 3. Continuation probes - test reasoning coherence
    probes.extend(_create_continuation_probes(thesis_state, max_probes_per_type))

    # 4. Decision probes - test decision consistency
    probes.extend(_create_decision_probes(thesis_state, max_probes_per_type))

    logger.info(f"Created {len(probes)} probes for compression evaluation")
    return probes


def _create_recall_probes(context: str, state: Any, max_probes: int) -> list[Probe]:
    """Create probes testing recall of specific facts."""
    probes = []

    # Extract key metrics/numbers from context
    # Pattern: looks for "X: Y" or "X = Y" patterns with numbers
    metric_pattern = r'([A-Za-z_\s]+):\s*([\d.]+%?|\$[\d.]+[BMK]?)'
    metrics = re.findall(metric_pattern, context)

    for metric_name, metric_value in metrics[:max_probes]:
        metric_name = metric_name.strip()
        probes.append(Probe(
            probe_type=ProbeType.RECALL,
            question=f"What is the value of {metric_name} mentioned in the analysis?",
            expected_answer=metric_value,
            source_quote=f"{metric_name}: {metric_value}",
            weight=1.0
        ))

    # If we have a thesis statement, probe for it
    if hasattr(state, 'thesis') and state.thesis:
        probes.append(Probe(
            probe_type=ProbeType.RECALL,
            question="What is the main thesis being analyzed?",
            expected_answer=state.thesis[:200],  # Truncate for comparison
            source_quote=state.thesis,
            weight=1.5  # Higher weight - thesis is critical
        ))

    # Probe for ticker if present
    if hasattr(state, 'ticker') and state.ticker:
        probes.append(Probe(
            probe_type=ProbeType.RECALL,
            question="What company/ticker is being analyzed?",
            expected_answer=state.ticker,
            weight=1.5
        ))

    return probes[:max_probes]


def _create_artifact_probes(state: Any, max_probes: int) -> list[Probe]:
    """Create probes testing preservation of key evidence."""
    probes = []

    # Check key_evidence if present
    if hasattr(state, 'key_evidence') and state.key_evidence:
        for i, evidence in enumerate(state.key_evidence[:max_probes]):
            content = evidence.content if hasattr(evidence, 'content') else str(evidence)
            source = evidence.source if hasattr(evidence, 'source') else "unknown"

            probes.append(Probe(
                probe_type=ProbeType.ARTIFACT,
                question=f"Is there key evidence from {source} about: {content[:50]}...?",
                expected_answer=content[:100],
                source_quote=content,
                weight=2.0  # Key evidence is critical - highest weight
            ))

    # Check regular evidence lists
    evidence_lists = []
    if hasattr(state, 'evidence_for'):
        evidence_lists.extend([(e, "supports") for e in state.evidence_for])
    if hasattr(state, 'evidence_against'):
        evidence_lists.extend([(e, "challenges") for e in state.evidence_against])

    remaining_slots = max_probes - len(probes)
    for evidence, direction in evidence_lists[:remaining_slots]:
        content = evidence.content if hasattr(evidence, 'content') else str(evidence)
        probes.append(Probe(
            probe_type=ProbeType.ARTIFACT,
            question=f"What evidence {direction} the thesis regarding: {content[:30]}...?",
            expected_answer=content[:100],
            source_quote=content,
            weight=1.5
        ))

    return probes[:max_probes]


def _create_continuation_probes(state: Any, max_probes: int) -> list[Probe]:
    """Create probes testing ability to continue reasoning."""
    probes = []

    # Check open questions
    if hasattr(state, 'open_questions') and state.open_questions:
        for question in state.open_questions[:max_probes]:
            q_text = question.text if hasattr(question, 'text') else str(question)
            probes.append(Probe(
                probe_type=ProbeType.CONTINUATION,
                question=f"What open question remains about: {q_text[:50]}...?",
                expected_answer=q_text,
                source_quote=q_text,
                weight=1.0
            ))

    # Check current threads if using StructuredWorkingMemory
    if hasattr(state, 'current_threads'):
        for thread in state.current_threads[:max_probes - len(probes)]:
            thread_name = thread.get('name', '') if isinstance(thread, dict) else str(thread)
            probes.append(Probe(
                probe_type=ProbeType.CONTINUATION,
                question=f"What reasoning thread is being pursued about '{thread_name}'?",
                expected_answer=thread_name,
                weight=1.0
            ))

    # If no specific items, create generic continuation probe
    if not probes:
        probes.append(Probe(
            probe_type=ProbeType.CONTINUATION,
            question="What is the next logical step in this analysis?",
            expected_answer="continue_analysis",  # Generic - will need fuzzy matching
            weight=0.5
        ))

    return probes[:max_probes]


def _create_decision_probes(state: Any, max_probes: int) -> list[Probe]:
    """Create probes testing decision consistency."""
    probes = []

    # Check confidence level
    if hasattr(state, 'confidence') and state.confidence is not None:
        conf_bucket = "high" if state.confidence > 0.7 else "medium" if state.confidence > 0.4 else "low"
        probes.append(Probe(
            probe_type=ProbeType.DECISION,
            question="What is the current confidence level in the thesis (high/medium/low)?",
            expected_answer=conf_bucket,
            weight=1.5
        ))

    # Check decision state
    if hasattr(state, 'decision') and state.decision:
        probes.append(Probe(
            probe_type=ProbeType.DECISION,
            question="What is the current decision/recommendation?",
            expected_answer=state.decision,
            weight=2.0  # Critical
        ))

    # Check for specific recommendation if present
    if hasattr(state, 'recommendation') and state.recommendation:
        probes.append(Probe(
            probe_type=ProbeType.DECISION,
            question="What action is being recommended?",
            expected_answer=state.recommendation[:100],
            weight=1.5
        ))

    return probes[:max_probes]


# -----------------------------------------------------------------------------
# Probe Execution
# -----------------------------------------------------------------------------

async def run_probes(
    compressed_context: str,
    probes: list[Probe],
    client: Any,
    model: str = "claude-sonnet-4-20250514",
    pass_threshold: float = 0.6
) -> ProbeResults:
    """
    Run probes against compressed context using LLM.

    Args:
        compressed_context: The compressed working memory context
        probes: List of probes to run
        client: Anthropic client instance
        model: Model to use for evaluation
        pass_threshold: Score threshold for passing (0.0-1.0)

    Returns:
        ProbeResults with all probe outcomes
    """
    results = ProbeResults()

    for probe in probes:
        try:
            result = await _run_single_probe(
                compressed_context, probe, client, model, pass_threshold
            )
            results.results.append(result)
        except Exception as e:
            logger.error(f"Probe failed: {probe.question[:50]}... - {e}")
            # Record as failed probe
            results.results.append(ProbeResult(
                probe=probe,
                actual_answer=f"ERROR: {e}",
                score=0.0,
                reasoning="Probe execution failed",
                passed=False
            ))

    return results


async def _run_single_probe(
    context: str,
    probe: Probe,
    client: Any,
    model: str,
    pass_threshold: float
) -> ProbeResult:
    """Run a single probe and evaluate the response."""

    # Build probe prompt
    prompt = f"""Based ONLY on the following context, answer the question.
If the information is not present in the context, say "NOT_FOUND".

<context>
{context}
</context>

Question: {probe.question}

Answer concisely (1-2 sentences max):"""

    # Call LLM
    response = await client.messages.create(
        model=model,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )

    actual_answer = response.content[0].text.strip()

    # Score the response
    score, reasoning = _score_probe_response(
        probe, actual_answer
    )

    return ProbeResult(
        probe=probe,
        actual_answer=actual_answer,
        score=score,
        reasoning=reasoning,
        passed=score >= pass_threshold
    )


def _score_probe_response(probe: Probe, actual: str) -> tuple[float, str]:
    """
    Score a probe response against expected answer.

    Returns:
        Tuple of (score 0.0-1.0, reasoning string)
    """
    actual_lower = actual.lower().strip()
    expected_lower = probe.expected_answer.lower().strip()

    # Check for NOT_FOUND response
    if "not_found" in actual_lower or "not present" in actual_lower:
        return 0.0, "Information not found in compressed context"

    # Exact match
    if expected_lower in actual_lower or actual_lower in expected_lower:
        return 1.0, "Exact match found"

    # Check for key terms overlap
    expected_terms = set(expected_lower.split())
    actual_terms = set(actual_lower.split())

    # Remove common words
    stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                  'would', 'could', 'should', 'may', 'might', 'must', 'shall',
                  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
                  'as', 'into', 'through', 'during', 'before', 'after', 'above',
                  'below', 'between', 'under', 'again', 'further', 'then', 'once',
                  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
                  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just'}

    expected_terms -= stop_words
    actual_terms -= stop_words

    if not expected_terms:
        return 0.5, "Expected answer too generic to evaluate"

    overlap = expected_terms & actual_terms
    overlap_ratio = len(overlap) / len(expected_terms)

    if overlap_ratio >= 0.8:
        return 0.9, f"High term overlap ({len(overlap)}/{len(expected_terms)} terms)"
    elif overlap_ratio >= 0.5:
        return 0.7, f"Moderate term overlap ({len(overlap)}/{len(expected_terms)} terms)"
    elif overlap_ratio >= 0.3:
        return 0.5, f"Partial term overlap ({len(overlap)}/{len(expected_terms)} terms)"
    elif overlap_ratio > 0:
        return 0.3, f"Low term overlap ({len(overlap)}/{len(expected_terms)} terms)"
    else:
        return 0.1, "No term overlap - answer may be semantically related"


# -----------------------------------------------------------------------------
# Results Summary
# -----------------------------------------------------------------------------

def summarize_probe_results(results: ProbeResults) -> str:
    """
    Generate human-readable summary of probe results.

    Args:
        results: ProbeResults from run_probes

    Returns:
        Formatted string summary
    """
    lines = [
        "=" * 60,
        "COMPRESSION QUALITY PROBE RESULTS",
        "=" * 60,
        "",
        f"Overall Score: {results.overall_score:.1%}",
        f"Pass Rate: {results.pass_rate:.1%} ({sum(1 for r in results.results if r.passed)}/{len(results.results)})",
        "",
        "By Probe Type:",
        "-" * 40,
    ]

    by_type = results.by_type()
    for probe_type, stats in by_type.items():
        status = "✓" if stats['pass_rate'] >= 0.6 else "✗"
        lines.append(
            f"  {status} {probe_type.upper()}: {stats['avg_score']:.1%} avg "
            f"({stats['passed']}/{stats['count']} passed)"
        )

    lines.extend([
        "",
        "Detailed Results:",
        "-" * 40,
    ])

    for i, result in enumerate(results.results, 1):
        status = "✓" if result.passed else "✗"
        probe_type = result.probe.probe_type.value.upper()[:4]
        question = result.probe.question[:50]
        if len(result.probe.question) > 50:
            question += "..."

        lines.append(f"  {i}. [{status}] [{probe_type}] {question}")
        lines.append(f"      Score: {result.score:.1%} | {result.reasoning}")
        if not result.passed:
            lines.append(f"      Expected: {result.probe.expected_answer[:60]}...")
            lines.append(f"      Got: {result.actual_answer[:60]}...")

    lines.extend([
        "",
        "=" * 60,
    ])

    return "\n".join(lines)


def log_probe_results(results: ProbeResults, logger: logging.Logger = None) -> None:
    """Log probe results at appropriate levels."""
    if logger is None:
        logger = logging.getLogger(__name__)

    # Log summary at INFO level
    logger.info(
        f"Compression probes: {results.overall_score:.1%} overall, "
        f"{results.pass_rate:.1%} pass rate"
    )

    # Log failures at WARNING level
    for result in results.results:
        if not result.passed:
            logger.warning(
                f"Probe FAILED [{result.probe.probe_type.value}]: "
                f"{result.probe.question[:50]}... "
                f"(score: {result.score:.1%})"
            )


# -----------------------------------------------------------------------------
# Convenience Functions
# -----------------------------------------------------------------------------

async def evaluate_compression(
    original_context: str,
    compressed_context: str,
    thesis_state: Any,
    client: Any,
    model: str = "claude-sonnet-4-20250514"
) -> dict:
    """
    Full compression evaluation pipeline.

    Args:
        original_context: Pre-compression context
        compressed_context: Post-compression context
        thesis_state: ThesisState with analysis details
        client: Anthropic client
        model: Model for probe evaluation

    Returns:
        Dict with evaluation results and summary
    """
    # Create probes from original context
    probes = create_probes(original_context, thesis_state)

    # Run probes against compressed context
    results = await run_probes(compressed_context, probes, client, model)

    # Generate summary
    summary = summarize_probe_results(results)

    # Log results
    log_probe_results(results)

    return {
        "overall_score": results.overall_score,
        "pass_rate": results.pass_rate,
        "by_type": results.by_type(),
        "summary": summary,
        "full_results": results.to_dict()
    }
