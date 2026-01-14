#!/usr/bin/env python3
"""
Context Window Tracker - Measure token allocation across phases.

Tracks:
- Data tokens (tool results, structured data)
- Thesis tokens (loaded thesis context)
- Reasoning tokens (agent's own analysis)
- Pattern tokens (historical analogues)

Goal: Understand how structured data affects reasoning quality.
"""

from dataclasses import dataclass, field
from typing import Literal
import tiktoken

# Use cl100k_base (Claude-compatible approximation)
try:
    ENCODER = tiktoken.get_encoding("cl100k_base")
except:
    ENCODER = None


@dataclass
class ContextBudget:
    """Track context allocation across a conversation."""

    # Token counts by category
    data_tokens: int = 0
    thesis_tokens: int = 0
    reasoning_tokens: int = 0
    pattern_tokens: int = 0
    system_tokens: int = 0

    # Per-pass tracking
    pass_history: list = field(default_factory=list)

    # Limits
    max_context: int = 100000  # Claude's context window

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if ENCODER:
            return len(ENCODER.encode(text))
        # Rough approximation if tiktoken not available
        return len(text) // 4

    def add_data(self, text: str, source: str = "tool"):
        """Track data/tool result tokens."""
        tokens = self.count_tokens(text)
        self.data_tokens += tokens
        return tokens

    def add_thesis(self, text: str):
        """Track loaded thesis tokens."""
        tokens = self.count_tokens(text)
        self.thesis_tokens += tokens
        return tokens

    def add_reasoning(self, text: str):
        """Track agent reasoning tokens."""
        tokens = self.count_tokens(text)
        self.reasoning_tokens += tokens
        return tokens

    def add_pattern(self, text: str):
        """Track historical pattern tokens."""
        tokens = self.count_tokens(text)
        self.pattern_tokens += tokens
        return tokens

    def record_pass(self, pass_name: str):
        """Record state at end of a pass."""
        self.pass_history.append({
            "pass": pass_name,
            "data_tokens": self.data_tokens,
            "thesis_tokens": self.thesis_tokens,
            "reasoning_tokens": self.reasoning_tokens,
            "pattern_tokens": self.pattern_tokens,
            "total": self.total_tokens,
            "utilization": self.utilization,
            "allocation": self.allocation_percentages,
        })

    @property
    def total_tokens(self) -> int:
        return (self.data_tokens + self.thesis_tokens +
                self.reasoning_tokens + self.pattern_tokens + self.system_tokens)

    @property
    def utilization(self) -> float:
        """What % of context window is used."""
        return self.total_tokens / self.max_context

    @property
    def allocation_percentages(self) -> dict:
        """How is context allocated across categories."""
        total = self.total_tokens or 1
        return {
            "data": round(self.data_tokens / total * 100, 1),
            "thesis": round(self.thesis_tokens / total * 100, 1),
            "reasoning": round(self.reasoning_tokens / total * 100, 1),
            "pattern": round(self.pattern_tokens / total * 100, 1),
            "system": round(self.system_tokens / total * 100, 1),
        }

    @property
    def reasoning_ratio(self) -> float:
        """Reasoning tokens as % of non-system tokens."""
        non_system = self.total_tokens - self.system_tokens
        if non_system == 0:
            return 0
        return self.reasoning_tokens / non_system

    def summary(self) -> dict:
        """Get full summary."""
        return {
            "total_tokens": self.total_tokens,
            "utilization_pct": round(self.utilization * 100, 1),
            "allocation": self.allocation_percentages,
            "reasoning_ratio": round(self.reasoning_ratio * 100, 1),
            "pass_history": self.pass_history,
        }


@dataclass
class ThesisRouter:
    """
    Route queries to appropriate context loading strategy.

    Strategies:
    - FIT: Query matches existing thesis → load thesis, challenge/update
    - ADJACENT: Query relates to known pattern → load pattern, test fit
    - NET_NEW: Fresh territory → minimize data, maximize reasoning
    """

    existing_theses: dict = field(default_factory=dict)
    known_patterns: dict = field(default_factory=dict)

    def classify_query(self, query: str, tickers: list[str] = None) -> dict:
        """
        Classify query and recommend context strategy.

        Returns:
            {
                "strategy": "FIT" | "ADJACENT" | "NET_NEW",
                "matched_thesis": str | None,
                "matched_pattern": str | None,
                "context_allocation": {
                    "thesis": float,  # % of budget
                    "data": float,
                    "reasoning": float,
                    "pattern": float,
                }
            }
        """
        # Check for thesis match
        thesis_match = self._find_thesis_match(query, tickers)
        if thesis_match:
            return {
                "strategy": "FIT",
                "matched_thesis": thesis_match,
                "matched_pattern": None,
                "context_allocation": {
                    "thesis": 0.40,
                    "data": 0.30,
                    "reasoning": 0.30,
                    "pattern": 0.00,
                },
                "framing": f"Update/challenge existing thesis: {thesis_match}"
            }

        # Check for pattern match
        pattern_match = self._find_pattern_match(query)
        if pattern_match:
            return {
                "strategy": "ADJACENT",
                "matched_thesis": None,
                "matched_pattern": pattern_match,
                "context_allocation": {
                    "thesis": 0.00,
                    "data": 0.40,
                    "reasoning": 0.30,
                    "pattern": 0.30,
                },
                "framing": f"Test against pattern: {pattern_match}"
            }

        # Net new - maximize reasoning
        return {
            "strategy": "NET_NEW",
            "matched_thesis": None,
            "matched_pattern": None,
            "context_allocation": {
                "thesis": 0.00,
                "data": 0.30,
                "reasoning": 0.60,
                "pattern": 0.10,
            },
            "framing": "New territory - deductive thesis generation"
        }

    def _find_thesis_match(self, query: str, tickers: list[str] = None) -> str | None:
        """Find matching thesis for query."""
        # Simple ticker-based matching for now
        if not tickers:
            return None

        for ticker in tickers:
            if ticker in self.existing_theses:
                return self.existing_theses[ticker]

        return None

    def _find_pattern_match(self, query: str) -> str | None:
        """Find matching pattern for query."""
        # Keyword-based pattern matching
        pattern_keywords = {
            "market_cycle": ["cycle", "bubble", "boom", "bust", "correction"],
            "competitive_response": ["respond", "compete", "challenge", "catch up"],
            "margin_compression": ["margin", "compress", "pressure", "pricing"],
            "platform_transition": ["transition", "pivot", "shift", "transform"],
        }

        query_lower = query.lower()
        for pattern_name, keywords in pattern_keywords.items():
            if any(kw in query_lower for kw in keywords):
                if pattern_name in self.known_patterns:
                    return pattern_name

        return None

    def register_thesis(self, ticker: str, thesis_id: str):
        """Register an existing thesis for matching."""
        self.existing_theses[ticker] = thesis_id

    def register_pattern(self, pattern_name: str, description: str):
        """Register a known pattern."""
        self.known_patterns[pattern_name] = description


# -----------------------------------------------------------------------------
# EnhancedThesisRouter - Pass 0 Context Loading
# -----------------------------------------------------------------------------

class EnhancedThesisRouter:
    """
    Route queries to relevant thesis context.

    Pass 0 function: Before analysis begins, load relevant priors from
    the thesis memory to provide context and avoid rediscovering known beliefs.
    """

    def __init__(self, theses_path: str = None):
        from pathlib import Path
        self.theses_path = Path(theses_path) if theses_path else (
            Path(__file__).parent.parent / "memories" / "theses"
        )
        self.thesis_index = self._load_thesis_index()

    def _load_thesis_index(self) -> dict:
        """Load thesis index from YAML."""
        import yaml
        index_path = self.theses_path / "_index.yaml"
        if not index_path.exists():
            return {}

        try:
            with open(index_path) as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            print(f"Warning: Could not load thesis index: {e}")
            return {}

    def find_relevant_theses(
        self,
        query: str,
        tickers: list[str] = None,
        domain: str = None,
        max_results: int = 3
    ) -> list[dict]:
        """
        Find theses relevant to a query.

        Uses keyword matching, tag matching, and domain matching to find
        potentially relevant prior beliefs.

        Returns list of thesis metadata with relevance scores.
        """
        candidates = []
        query_lower = query.lower()
        query_words = set(query_lower.split())

        # Ticker-to-domain mapping
        ticker_domains = {
            "NVDA": ["ai-infrastructure", "semiconductors"],
            "AMD": ["ai-infrastructure", "semiconductors"],
            "META": ["ai-infrastructure", "social-media"],
            "MSFT": ["ai-infrastructure", "cloud"],
            "GOOGL": ["ai-infrastructure", "search"],
            "AAPL": ["consumer-tech"],
            "AMZN": ["cloud", "retail"],
            "TSM": ["semiconductors"],
            "INTC": ["semiconductors"],
        }

        # Keywords that might match thesis tags
        keyword_expansions = {
            "nvidia": ["gpu", "cuda", "datacenter", "ai"],
            "ai": ["artificial-intelligence", "machine-learning", "inference", "training"],
            "datacenter": ["hyperscaler", "cloud", "infrastructure"],
            "competition": ["competitive", "market-share", "rivalry"],
            "moat": ["competitive-advantage", "barrier", "switching-cost"],
            "valuation": ["multiple", "pe-ratio", "pricing"],
            "margin": ["profitability", "gross-margin", "operating-margin"],
        }

        # Iterate through thesis categories
        for category, data in self.thesis_index.items():
            if category in ["metadata", "structure", "archive", "relationships"]:
                continue

            # Category might be a dict with 'theses' key or a list directly
            theses_list = data.get("theses", []) if isinstance(data, dict) else []
            if not theses_list:
                continue

            for thesis in theses_list:
                if thesis.get("status") != "active":
                    continue

                score = 0.0
                reasons = []

                # Check domain match
                if domain and category == domain:
                    score += 0.3
                    reasons.append(f"domain_match:{category}")

                # Check ticker-based domain relevance
                if tickers:
                    for ticker in tickers:
                        ticker_relevant_domains = ticker_domains.get(ticker, [])
                        if category in ticker_relevant_domains:
                            score += 0.25
                            reasons.append(f"ticker_domain:{ticker}")

                # Check keyword match in summary
                summary = thesis.get("summary", "").lower()
                matched_words = [w for w in query_words if len(w) > 3 and w in summary]
                if matched_words:
                    score += 0.1 * min(len(matched_words), 3)
                    reasons.append(f"keyword_match:{len(matched_words)}")

                # Check expanded keywords
                for kw, expansions in keyword_expansions.items():
                    if kw in query_lower:
                        if any(exp in summary for exp in expansions):
                            score += 0.15
                            reasons.append(f"expanded_match:{kw}")

                # Check tag match
                tags = thesis.get("tags", [])
                tag_matches = len(set(tags) & query_words)
                if tag_matches:
                    score += 0.1 * tag_matches
                    reasons.append(f"tag_match:{tag_matches}")

                if score > 0:
                    candidates.append({
                        "id": thesis.get("id"),
                        "file": thesis.get("file"),
                        "summary": thesis.get("summary"),
                        "confidence": thesis.get("confidence"),
                        "relevance_score": score,
                        "relevance_reasons": reasons,
                        "category": category,
                    })

        # Sort by relevance and return top N
        candidates.sort(key=lambda x: x["relevance_score"], reverse=True)
        return candidates[:max_results]

    def load_thesis_content(self, thesis_id: str) -> str | None:
        """Load full thesis content by ID."""
        # Find thesis in index
        for category, data in self.thesis_index.items():
            if category in ["metadata", "structure", "archive", "relationships"]:
                continue

            theses_list = data.get("theses", []) if isinstance(data, dict) else []
            for thesis in theses_list:
                if thesis.get("id") == thesis_id:
                    file_path = self.theses_path / thesis.get("file", "")
                    if file_path.exists():
                        return file_path.read_text()
        return None

    def build_pass0_context(
        self,
        query: str,
        tickers: list[str] = None,
        max_thesis_chars: int = 3000
    ) -> str:
        """
        Build Pass 0 context from relevant theses.

        This is injected into the first expansion prompt to provide
        prior beliefs as context for the analysis.

        Returns formatted context string for injection.
        """
        relevant = self.find_relevant_theses(query, tickers)

        if not relevant:
            return (
                "## Prior Context\n"
                "No directly relevant theses found in memory. "
                "Proceeding with fresh analysis.\n"
            )

        lines = [
            "## Prior Context (Loaded from Thesis Memory)",
            f"Found {len(relevant)} potentially relevant thesis(es):",
            "",
        ]

        total_chars = 0
        for thesis in relevant:
            # Header with metadata
            conf_str = f"{thesis['confidence']:.0%}" if thesis.get('confidence') else "N/A"
            lines.append(f"### {thesis['id']} (confidence: {conf_str}, relevance: {thesis['relevance_score']:.2f})")
            lines.append(f"**Summary**: {thesis['summary']}")
            lines.append(f"**Why relevant**: {', '.join(thesis['relevance_reasons'])}")

            # Load full content if high relevance and we have room
            if thesis['relevance_score'] > 0.3 and total_chars < max_thesis_chars:
                content = self.load_thesis_content(thesis['id'])
                if content:
                    # Extract key sections (Evidence, Implications, Falsification)
                    excerpts = []
                    for section in ["## Evidence", "## Implications", "## Falsification", "## Key Assumptions"]:
                        if section in content:
                            start = content.find(section)
                            end = content.find("\n## ", start + 1)
                            if end == -1:
                                end = min(start + 500, len(content))
                            excerpt = content[start:end].strip()
                            if len(excerpt) < 500:  # Only include if reasonably short
                                excerpts.append(excerpt)
                                total_chars += len(excerpt)

                    if excerpts:
                        lines.append("**Key excerpts**:")
                        for excerpt in excerpts[:2]:  # Max 2 excerpts per thesis
                            lines.append(excerpt)

            lines.append("")

        lines.append("---")
        lines.append("*Use these priors as context. Update, challenge, or confirm as evidence warrants.*")

        return "\n".join(lines)


# Quality metrics
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

    if ENCODER:
        metrics.total_output_tokens = len(ENCODER.encode(response_text))
    else:
        metrics.total_output_tokens = len(response_text) // 4

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
    import re
    # Look for percentages, dollar amounts, quarter references
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
    # Test the tracker
    budget = ContextBudget()

    # Simulate a conversation
    budget.add_data("Financial data for NVDA: revenue $30B, margin 65%...", "tool")
    budget.record_pass("data_gathering")

    budget.add_reasoning("Based on the financial data, NVDA shows strong momentum...")
    budget.record_pass("pass_1_expansion")

    budget.add_pattern("Historical analogue: Cisco in 2000 showed similar...")
    budget.add_reasoning("Synthesizing the analysis, key conclusions are...")
    budget.record_pass("pass_2_synthesis")

    print("Context Budget Summary:")
    print(budget.summary())

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
    print("\nInsight Metrics:")
    print(metrics.summary())
