"""
Thesis Router - Pass 0 Context Assembly

Classifies queries as FIT, ADJACENT, or NET_NEW and allocates context budget.
From STRATEGY_COPILOT_V2.md architecture.

Flow:
    User Query → Thesis Router → Context Budget Allocation → Pass 1 (Reasoning)

Categories:
    FIT:      Matches existing thesis → 40% thesis, 30% data, 30% reasoning
    ADJACENT: Relates to known pattern → 30% pattern, 40% data, 30% reasoning
    NET_NEW:  Fresh territory → 10% priors, 30% data, 60% reasoning
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from memory import MemoryManager, Thesis, Pattern, get_memory


class RouteType(Enum):
    """Query classification types"""
    FIT = "fit"           # Matches existing thesis
    ADJACENT = "adjacent"  # Relates to known pattern
    NET_NEW = "net_new"   # Fresh territory


@dataclass
class ContextBudget:
    """Token budget allocation for different context types"""
    thesis_tokens: int = 0
    pattern_tokens: int = 0
    data_tokens: int = 0
    reasoning_tokens: int = 0

    @property
    def total(self) -> int:
        return self.thesis_tokens + self.pattern_tokens + self.data_tokens + self.reasoning_tokens


@dataclass
class RouterResult:
    """Result of Pass 0 thesis routing"""
    route_type: RouteType
    confidence: float  # How confident we are in the routing
    matched_theses: list[Thesis]
    matched_patterns: list[Pattern]
    budget: ContextBudget
    reasoning: str  # Explanation of routing decision

    @property
    def assembled_context(self) -> str:
        """Assemble the context for Pass 1"""
        memory = get_memory()

        sections = []

        if self.matched_theses:
            sections.append(memory.assemble_thesis_context(
                self.matched_theses,
                max_tokens=self.budget.thesis_tokens
            ))

        if self.matched_patterns:
            sections.append(memory.assemble_pattern_context(
                self.matched_patterns,
                max_tokens=self.budget.pattern_tokens
            ))

        sections.append(f"""
# Routing Decision
**Type**: {self.route_type.value.upper()}
**Confidence**: {self.confidence:.0%}
**Reasoning**: {self.reasoning}

# Context Budget
- Thesis context: {self.budget.thesis_tokens} tokens
- Pattern context: {self.budget.pattern_tokens} tokens
- Data allowance: {self.budget.data_tokens} tokens
- Reasoning space: {self.budget.reasoning_tokens} tokens
""")

        return "\n---\n".join(sections)


class ThesisRouter:
    """
    Pass 0: Route queries to appropriate context.

    Implements the thesis router from STRATEGY_COPILOT_V2.md:
    1. Parse query for entities, concepts, intent
    2. Check thesis library for matches
    3. Check pattern library for adjacencies
    4. Determine context allocation strategy

    Usage:
        router = ThesisRouter()
        result = router.route("Should Microsoft acquire Discord?")

        print(result.route_type)  # FIT, ADJACENT, or NET_NEW
        print(result.assembled_context)  # Context for Pass 1
    """

    # Total context budget (tokens)
    TOTAL_BUDGET = 8000

    # Budget allocations by route type
    BUDGET_ALLOCATIONS = {
        RouteType.FIT: {
            'thesis': 0.40,
            'pattern': 0.00,
            'data': 0.30,
            'reasoning': 0.30,
        },
        RouteType.ADJACENT: {
            'thesis': 0.00,
            'pattern': 0.30,
            'data': 0.40,
            'reasoning': 0.30,
        },
        RouteType.NET_NEW: {
            'thesis': 0.10,  # Some priors still useful
            'pattern': 0.00,
            'data': 0.30,
            'reasoning': 0.60,  # Maximize reasoning space
        },
    }

    def __init__(self, memory: Optional[MemoryManager] = None):
        self.memory = memory or get_memory()

    def route(self, query: str, claims: Optional[list[dict]] = None) -> RouterResult:
        """
        Route a query/claims to appropriate context.

        Args:
            query: The user's question or analysis title
            claims: Optional list of claims from source ingestion

        Returns:
            RouterResult with routing decision and assembled context
        """
        # Build searchable text from query + claims
        search_text = query
        if claims:
            search_text += " " + " ".join(c.get('text', '') for c in claims)

        # 1. Check for thesis matches
        matched_theses = self.memory.search_theses(search_text, limit=3)

        # 2. Check for pattern matches
        matched_patterns = self.memory.search_patterns(search_text, limit=2)

        # 3. Determine route type
        route_type, confidence, reasoning = self._classify(
            query, matched_theses, matched_patterns
        )

        # 4. Calculate budget
        budget = self._allocate_budget(route_type)

        return RouterResult(
            route_type=route_type,
            confidence=confidence,
            matched_theses=matched_theses,
            matched_patterns=matched_patterns,
            budget=budget,
            reasoning=reasoning,
        )

    def _classify(
        self,
        query: str,
        theses: list[Thesis],
        patterns: list[Pattern]
    ) -> tuple[RouteType, float, str]:
        """
        Classify query into FIT, ADJACENT, or NET_NEW.

        Returns (route_type, confidence, reasoning)
        """
        # Strong thesis match = FIT
        if theses:
            best_thesis = theses[0]

            # Check for strong keyword overlap
            query_terms = set(query.lower().split())
            thesis_terms = set(best_thesis.title.lower().split())
            thesis_terms.update(best_thesis.tags)

            overlap = len(query_terms & thesis_terms)

            if overlap >= 2 or any(tag.lower() in query.lower() for tag in best_thesis.tags):
                return (
                    RouteType.FIT,
                    min(0.9, 0.5 + overlap * 0.1),
                    f"Query matches thesis '{best_thesis.title}' (domain: {best_thesis.domain})"
                )

        # Pattern match without strong thesis = ADJACENT
        if patterns and not theses:
            best_pattern = patterns[0]
            return (
                RouteType.ADJACENT,
                0.6,
                f"Query relates to framework '{best_pattern.title}' but no existing thesis"
            )

        # Weak matches on both = ADJACENT
        if theses and patterns:
            return (
                RouteType.ADJACENT,
                0.5,
                f"Weak matches: thesis '{theses[0].title}', pattern '{patterns[0].title}'"
            )

        # No matches = NET_NEW
        return (
            RouteType.NET_NEW,
            0.8,  # High confidence it's new territory
            "No matching theses or patterns - fresh analysis territory"
        )

    def _allocate_budget(self, route_type: RouteType) -> ContextBudget:
        """Allocate token budget based on route type"""
        allocation = self.BUDGET_ALLOCATIONS[route_type]

        return ContextBudget(
            thesis_tokens=int(self.TOTAL_BUDGET * allocation['thesis']),
            pattern_tokens=int(self.TOTAL_BUDGET * allocation['pattern']),
            data_tokens=int(self.TOTAL_BUDGET * allocation['data']),
            reasoning_tokens=int(self.TOTAL_BUDGET * allocation['reasoning']),
        )

    def route_with_enhancement(
        self,
        query: str,
        claims: Optional[list[dict]] = None
    ) -> RouterResult:
        """
        Enhanced routing with claim analysis.

        Extracts entities and concepts from claims for better matching.
        """
        result = self.route(query, claims)

        # If NET_NEW but claims contain strategic concepts, upgrade to ADJACENT
        if result.route_type == RouteType.NET_NEW and claims:
            strategic_keywords = [
                'market', 'competition', 'valuation', 'growth', 'margin',
                'acquisition', 'strategy', 'moat', 'disruption', 'thesis',
            ]

            claim_text = " ".join(c.get('text', '') for c in claims).lower()

            if any(kw in claim_text for kw in strategic_keywords):
                # Re-search with claim entities
                entities = self._extract_entities(claims)
                if entities:
                    patterns = self.memory.search_patterns(" ".join(entities), limit=2)
                    if patterns:
                        result.route_type = RouteType.ADJACENT
                        result.matched_patterns = patterns
                        result.reasoning = f"Claims contain strategic concepts, matched to '{patterns[0].title}'"
                        result.budget = self._allocate_budget(RouteType.ADJACENT)

        return result

    def _extract_entities(self, claims: list[dict]) -> list[str]:
        """Extract company/concept entities from claims"""
        entities = []

        for claim in claims:
            text = claim.get('text', '')

            # Simple entity extraction - look for capitalized phrases
            caps = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
            entities.extend(caps)

            # Look for tickers
            tickers = re.findall(r'\b[A-Z]{2,5}\b', text)
            entities.extend(tickers)

        return list(set(entities))[:10]  # Dedupe and limit


# Convenience function
def route_query(query: str, claims: Optional[list[dict]] = None) -> RouterResult:
    """Route a query through thesis router"""
    router = ThesisRouter()
    return router.route_with_enhancement(query, claims)
