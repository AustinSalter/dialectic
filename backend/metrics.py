"""
Quality Metrics for Multi-Pass Reasoning

Extracted from context_tracker.py. Provides:
- InsightMetrics: Measure quality of agent insights
- analyze_response_quality: Analyze a response for insight patterns
- Token counting with tiktoken
"""

from dataclasses import dataclass
import re

try:
    import tiktoken
    ENCODER = tiktoken.get_encoding("cl100k_base")
except ImportError:
    ENCODER = None


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken or fallback to char estimate."""
    if ENCODER:
        return len(ENCODER.encode(text))
    return len(text) // 4


@dataclass
class InsightMetrics:
    """Measure quality of agent insights."""

    # Raw counts
    unique_insights: int = 0
    causal_chains: int = 0  # Multi-step reasoning (A→B→C)
    historical_precedents: int = 0
    quantified_predictions: int = 0
    risks_identified: int = 0

    # Token efficiency
    total_output_tokens: int = 0

    @property
    def insight_density(self) -> float:
        """Insights per 100 tokens."""
        if self.total_output_tokens == 0:
            return 0
        return (self.unique_insights / self.total_output_tokens) * 100

    @property
    def reasoning_depth(self) -> float:
        """Causal chains as % of insights."""
        if self.unique_insights == 0:
            return 0
        return self.causal_chains / self.unique_insights

    @property
    def evidence_ratio(self) -> float:
        """Historical precedents as % of insights."""
        if self.unique_insights == 0:
            return 0
        return self.historical_precedents / self.unique_insights

    def summary(self) -> dict:
        return {
            "unique_insights": self.unique_insights,
            "insight_density": round(self.insight_density, 2),
            "reasoning_depth": round(self.reasoning_depth * 100, 1),
            "evidence_ratio": round(self.evidence_ratio * 100, 1),
            "risks_identified": self.risks_identified,
            "quantified_predictions": self.quantified_predictions,
        }


def analyze_response_quality(response_text: str) -> InsightMetrics:
    """
    Analyze a response for insight quality metrics.

    Looks for:
    - Unique insights (non-obvious conclusions)
    - Causal chains (because/therefore/leads to patterns)
    - Historical precedents (similar to/historically/in 20XX)
    - Quantified predictions (specific numbers, timelines)
    - Risks (could fail/risk/downside)
    """
    metrics = InsightMetrics()

    metrics.total_output_tokens = count_tokens(response_text)

    text_lower = response_text.lower()

    # Count causal chains (rough heuristic)
    causal_markers = ["because", "therefore", "leads to", "results in",
                      "causes", "which means", "as a result", "→"]
    metrics.causal_chains = sum(text_lower.count(m) for m in causal_markers)

    # Count historical precedents
    historical_markers = ["historically", "in 20", "similar to", "precedent",
                         "previously", "last time", "analogous"]
    metrics.historical_precedents = sum(text_lower.count(m) for m in historical_markers)

    # Count quantified predictions
    quant_patterns = [
        r'\d+%',  # percentages
        r'\$\d+',  # dollar amounts
        r'Q[1-4]\s*20\d{2}',  # quarter references
        r'20\d{2}Q[1-4]',
        r'\d+\s*(quarters?|years?|months?)',  # time periods
    ]
    for pattern in quant_patterns:
        metrics.quantified_predictions += len(re.findall(pattern, response_text))

    # Count risk mentions
    risk_markers = ["risk", "could fail", "downside", "bear case",
                   "uncertainty", "if wrong", "challenge"]
    metrics.risks_identified = sum(text_lower.count(m) for m in risk_markers)

    # Estimate unique insights (sections, bullet points, numbered items)
    insight_markers = [
        r'^\d+\.',  # numbered lists
        r'^[-•]',   # bullet points
        r'\*\*[^*]+\*\*:',  # bold headers
        r'##\s+',   # markdown headers
    ]
    for pattern in insight_markers:
        metrics.unique_insights += len(re.findall(pattern, response_text, re.MULTILINE))

    # Minimum of 1 insight if there's any content
    if metrics.unique_insights == 0 and len(response_text) > 100:
        metrics.unique_insights = 1

    return metrics


if __name__ == "__main__":
    # Test quality analysis
    sample_response = """
    ## Analysis

    **1. Current Position**: NVDA dominates with 80% market share.

    **2. Historical Precedent**: Similar to Intel's position in 2010, which led to complacency.

    **3. Risk Factors**:
    - AMD catching up (20% probability)
    - Margin compression if competition intensifies

    Because NVDA's moat depends on CUDA, therefore any erosion in developer mindshare
    could lead to 30-40% multiple compression by Q4 2025.
    """

    metrics = analyze_response_quality(sample_response)
    print("Insight Metrics:")
    print(metrics.summary())
