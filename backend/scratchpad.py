"""
Scratchpad - Running context document for accumulated state

Implements anchored iterative compression from EXP-009:
- Structured sections that persist across passes
- Merge strategies for iterative updates
- Size limits with intelligent compression

This is exposed as a custom MCP tool so the agent can read/write the scratchpad.
"""

from dataclasses import dataclass, field
from typing import Literal, Optional
from datetime import datetime
import re
import json

# Semantic markers from EXP-003/EXP-008 (validated 3x insight density)
SEMANTIC_MARKERS = {
    'INSIGHT': r'\[INSIGHT\]([^\[]*?)(?=\[|$)',
    'EVIDENCE': r'\[EVIDENCE\]([^\[]*?)(?=\[|$)',
    'RISK': r'\[RISK\]([^\[]*?)(?=\[|$)',
    'COUNTER': r'\[COUNTER\]([^\[]*?)(?=\[|$)',
    'PATTERN': r'\[PATTERN\]([^\[]*?)(?=\[|$)',
    'QUESTION': r'\[QUESTION\]([^\[]*?)(?=\[|$)',
    'DECISION': r'\[DECISION\]([^\[]*?)(?=\[|$)',
    'META': r'\[META\]([^\[]*?)(?=\[|$)',
    'BRANCH': r'\[BRANCH\]([^\[]*?)(?=\[|$)',  # Alternative thesis path for branching
}

# Fallacy markers for reasoning quality assessment
# Split into "always bad" and "context-dependent"
FALLACY_MARKERS_ALWAYS = {
    'FALSE_DICHOTOMY': r'\[FALSE_DICHOTOMY\]([^\[]*?)(?=\[|$)',  # Ignoring middle options
    'SUNK_COST': r'\[SUNK_COST\]([^\[]*?)(?=\[|$)',  # Weighting past investment
    'CONFIRMATION': r'\[CONFIRMATION\]([^\[]*?)(?=\[|$)',  # Cherry-picking evidence
    'PLANNING_FALLACY': r'\[PLANNING_FALLACY\]([^\[]*?)(?=\[|$)',  # Underestimating difficulty
    'CIRCULAR': r'\[CIRCULAR\]([^\[]*?)(?=\[|$)',  # Assuming conclusion in premise
    'AUTHORITY': r'\[AUTHORITY\]([^\[]*?)(?=\[|$)',  # Relying on prestige not evidence
}

# These are fallacies in FORWARD mode, but expected/valuable in RETROSPECTIVE mode
FALLACY_MARKERS_FORWARD_ONLY = {
    'SURVIVORSHIP': r'\[SURVIVORSHIP\]([^\[]*?)(?=\[|$)',  # Only looking at winners
    'HINDSIGHT': r'\[HINDSIGHT\]([^\[]*?)(?=\[|$)',  # Retrofitting with knowledge unavailable then
}

# Combined for backwards compatibility
FALLACY_MARKERS = {**FALLACY_MARKERS_ALWAYS, **FALLACY_MARKERS_FORWARD_ONLY}

# Evidence quality markers for epistemic assessment
EVIDENCE_QUALITY_MARKERS = {
    'UNVERIFIED': r'\[UNVERIFIED\]([^\[]*?)(?=\[|$)',  # Claim without source
    'INCOMPLETE': r'\[INCOMPLETE\]([^\[]*?)(?=\[|$)',  # Missing key data
    'CONTRADICTED': r'\[CONTRADICTED\]([^\[]*?)(?=\[|$)',  # Conflicts with other evidence
    'UNSTABLE': r'\[UNSTABLE\]([^\[]*?)(?=\[|$)',  # Premise could change
    'DATED': r'\[DATED\]([^\[]*?)(?=\[|$)',  # Evidence may be stale
}

SectionType = Literal[
    'insights', 'evidence', 'risks', 'counters',
    'questions', 'patterns', 'decisions', 'meta', 'claims', 'branches'
]


@dataclass
class KeyEvidence:
    """
    Critical evidence that should NEVER be compressed.

    From working_memory.py: Solves the artifact trail problem identified in lit review.
    Key evidence persists through all compression operations and is always shown in full.
    """
    content: str
    source: str  # e.g., "CLAIM-1", "expansion_pass_2"
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
    def from_dict(cls, d: dict) -> "KeyEvidence":
        return cls(**d)


AnalysisMode = Literal["forward", "retrospective"]


@dataclass
class ConfidenceModel:
    """
    Three-dimensional confidence model separating:
    1. Reasoning quality - Is the logical structure sound? (Fallacy-free)
    2. Evidence quality - How reliable/complete is the foundation? (Epistemic)
    3. Conclusion confidence - How certain given the above? (Output)

    Supports two analysis modes:
    - FORWARD: Predicting future outcomes (hindsight/survivorship are fallacies)
    - RETROSPECTIVE: Understanding past outcomes (hindsight is expected/valuable)

    This prevents "analysis paralysis" where acknowledging uncertainty
    gets flagged as low confidence even when reasoning is sound.
    """
    reasoning_quality: float = 1.0  # 1.0 = no fallacies detected
    evidence_quality: float = 1.0   # 1.0 = all evidence verified/complete
    conclusion_confidence: float = 0.5  # Domain uncertainty
    analysis_mode: AnalysisMode = "retrospective"  # Default to retrospective for case studies

    # Tracked issues
    fallacies_found: list[str] = field(default_factory=list)
    evidence_gaps: list[str] = field(default_factory=list)
    retrospective_insights: list[str] = field(default_factory=list)  # Hindsight used productively

    def update_from_critique(self, critique_text: str) -> None:
        """
        Extract fallacy and evidence markers from critique output.

        Key design: Confidence should BOUNCE, not just decline.
        - Issues found THIS cycle affect THIS cycle's scores
        - Zero confidence = genuine aporia (180-degree reframe needed)
        - Normal critique should keep confidence in 0.4-0.8 range
        """
        # Count issues found THIS cycle (not cumulative)
        cycle_fallacies = []
        cycle_evidence_gaps = []

        # Count always-bad fallacies
        for marker, pattern in FALLACY_MARKERS_ALWAYS.items():
            matches = re.findall(pattern, critique_text, re.DOTALL)
            for match in matches:
                issue = f"{marker}: {match.strip()[:100]}"
                cycle_fallacies.append(issue)
                if issue not in self.fallacies_found:
                    self.fallacies_found.append(issue)

        # Handle mode-dependent markers
        for marker, pattern in FALLACY_MARKERS_FORWARD_ONLY.items():
            matches = re.findall(pattern, critique_text, re.DOTALL)
            for match in matches:
                if self.analysis_mode == "forward":
                    issue = f"{marker}: {match.strip()[:100]}"
                    cycle_fallacies.append(issue)
                    if issue not in self.fallacies_found:
                        self.fallacies_found.append(issue)
                else:
                    # In retrospective mode, these are valuable insights
                    insight = f"{marker}: {match.strip()[:100]}"
                    if insight not in self.retrospective_insights:
                        self.retrospective_insights.append(insight)

        # Count evidence gaps
        for marker, pattern in EVIDENCE_QUALITY_MARKERS.items():
            matches = re.findall(pattern, critique_text, re.DOTALL)
            for match in matches:
                issue = f"{marker}: {match.strip()[:100]}"
                cycle_evidence_gaps.append(issue)
                if issue not in self.evidence_gaps:
                    self.evidence_gaps.append(issue)

        # Update scores based on THIS CYCLE's issues (allows bounce-back)
        # Fewer issues this cycle = higher scores (recovery possible)
        # Floor at 0.5 for normal critique, 0.3 only for severe issues (3+)
        if len(cycle_fallacies) == 0:
            self.reasoning_quality = min(1.0, self.reasoning_quality + 0.1)  # Recover
        elif len(cycle_fallacies) <= 2:
            self.reasoning_quality = max(0.5, 0.9 - len(cycle_fallacies) * 0.15)
        else:
            self.reasoning_quality = max(0.3, 0.9 - len(cycle_fallacies) * 0.15)

        if len(cycle_evidence_gaps) == 0:
            self.evidence_quality = min(1.0, self.evidence_quality + 0.1)  # Recover
        elif len(cycle_evidence_gaps) <= 2:
            self.evidence_quality = max(0.5, 0.9 - len(cycle_evidence_gaps) * 0.15)
        else:
            self.evidence_quality = max(0.3, 0.9 - len(cycle_evidence_gaps) * 0.15)

    @property
    def composite_confidence(self) -> float:
        """
        Combined confidence = weighted average of three dimensions.

        Using average instead of product because:
        - Product is too punitive (40% × 70% × 50% = 14%)
        - Average reflects intuition (40%, 70%, 50% → ~55%)
        - Each dimension contributes independently
        """
        return (self.reasoning_quality + self.evidence_quality + self.conclusion_confidence) / 3

    @property
    def summary(self) -> dict:
        return {
            "reasoning_quality": round(self.reasoning_quality, 2),
            "evidence_quality": round(self.evidence_quality, 2),
            "conclusion_confidence": round(self.conclusion_confidence, 2),
            "composite": round(self.composite_confidence, 2),
            "analysis_mode": self.analysis_mode,
            "fallacies_count": len(self.fallacies_found),
            "evidence_gaps_count": len(self.evidence_gaps),
            "retrospective_insights_count": len(self.retrospective_insights),
        }

    def to_dict(self) -> dict:
        return {
            "reasoning_quality": self.reasoning_quality,
            "evidence_quality": self.evidence_quality,
            "conclusion_confidence": self.conclusion_confidence,
            "analysis_mode": self.analysis_mode,
            "fallacies_found": self.fallacies_found,
            "evidence_gaps": self.evidence_gaps,
            "retrospective_insights": self.retrospective_insights,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ConfidenceModel":
        return cls(
            reasoning_quality=d.get("reasoning_quality", 1.0),
            evidence_quality=d.get("evidence_quality", 1.0),
            conclusion_confidence=d.get("conclusion_confidence", 0.5),
            analysis_mode=d.get("analysis_mode", "retrospective"),
            fallacies_found=d.get("fallacies_found", []),
            evidence_gaps=d.get("evidence_gaps", []),
            retrospective_insights=d.get("retrospective_insights", []),
        )


@dataclass
class ThesisBranch:
    """
    A divergent thesis path for branching analysis.

    When critique identifies mutually exclusive interpretations (e.g., "bull case"
    vs "bear case"), the harness can branch to explore both paths independently.

    Branching conditions (threshold-gated):
    - Confidence < 0.4 after 2+ cycles (genuine uncertainty)
    - Critique identifies [BRANCH] marker with alternative thesis
    """
    id: str
    thesis: str  # The core thesis statement for this branch
    confidence: float = 0.5
    parent_id: str | None = None  # None for root branch
    created_cycle: int = 0
    is_active: bool = True

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "thesis": self.thesis,
            "confidence": self.confidence,
            "parent_id": self.parent_id,
            "created_cycle": self.created_cycle,
            "is_active": self.is_active,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ThesisBranch":
        return cls(**d)


@dataclass
class Section:
    """A section in the scratchpad"""
    type: SectionType
    content: list[str] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.now)
    preserved: bool = False  # If true, won't be compressed away


@dataclass
class Scratchpad:
    """
    Running context document that accumulates state across passes.

    Key design decisions from TESTING.md:
    - Accumulated context enables frame-level reframing (EXP-005)
    - Semantic markers extract 3x more insights per token (EXP-008)
    - Non-monotonic confidence trajectories indicate genuine exploration (EXP-004)

    Key evidence (from working_memory.py):
    - Critical facts that should NEVER be compressed
    - Solves artifact trail problem from lit review
    """
    session_id: str
    title: str
    sections: dict[SectionType, Section] = field(default_factory=dict)
    confidence_history: list[float] = field(default_factory=list)
    current_confidence: float = 0.5  # Legacy - use confidence_model instead
    cycle_count: int = 0
    created: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)

    # Three-dimensional confidence model (replaces single confidence)
    confidence_model: ConfidenceModel = field(default_factory=ConfidenceModel)

    # Key evidence - NEVER compressed (from working_memory.py)
    key_evidence: list[KeyEvidence] = field(default_factory=list)

    # Insight counts per cycle - for diminishing returns detection (EXP-010)
    insight_counts: list[int] = field(default_factory=list)

    # Thesis branches for divergent analysis paths
    branches: list[ThesisBranch] = field(default_factory=list)
    current_branch_id: str | None = None  # Which branch is currently active

    # Branching thresholds
    BRANCH_CONFIDENCE_THRESHOLD: float = 0.4  # Only branch if confidence below this
    MAX_BRANCHES: int = 3  # Maximum number of active branches

    # Token budget (from EXP-009)
    MAX_TOKENS = 8000

    def __post_init__(self):
        # Initialize default sections
        if not self.sections:
            self.sections = {
                'claims': Section(type='claims', preserved=True),
                'insights': Section(type='insights', preserved=True),
                'evidence': Section(type='evidence', preserved=True),
                'risks': Section(type='risks', preserved=False),
                'counters': Section(type='counters', preserved=True),
                'questions': Section(type='questions', preserved=False),
                'patterns': Section(type='patterns', preserved=True),
                'decisions': Section(type='decisions', preserved=True),
                'meta': Section(type='meta', preserved=False),
                'branches': Section(type='branches', preserved=True),  # Track branch proposals
            }

    def extract_and_merge(self, text: str) -> int:
        """
        Extract marked content from expansion output and merge into scratchpad.
        Uses semantic markers from EXP-003/EXP-008.

        Returns the count of new insights extracted (for diminishing returns tracking).
        """
        marker_to_section: dict[str, SectionType] = {
            'INSIGHT': 'insights',
            'EVIDENCE': 'evidence',
            'RISK': 'risks',
            'COUNTER': 'counters',
            'PATTERN': 'patterns',
            'QUESTION': 'questions',
            'DECISION': 'decisions',
            'META': 'meta',
            'BRANCH': 'branches',
        }

        new_insight_count = 0

        for marker, pattern in SEMANTIC_MARKERS.items():
            section_type = marker_to_section[marker]
            matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)

            for match in matches:
                content = match.strip()
                if content and content not in self.sections[section_type].content:
                    self.sections[section_type].content.append(content)
                    self.sections[section_type].last_updated = datetime.now()
                    new_insight_count += 1

        self.last_updated = datetime.now()

        # Compress if needed
        if self.estimate_tokens() > self.MAX_TOKENS:
            self._compress()

        return new_insight_count

    def add_claim(self, claim_id: str, text: str, claim_type: str, snippet: str) -> None:
        """Add a claim from source material"""
        claim_str = f"@{claim_id} [{claim_type}]: {text}\n  Quote: \"{snippet[:200]}...\""
        if claim_str not in self.sections['claims'].content:
            self.sections['claims'].content.append(claim_str)
            self.sections['claims'].last_updated = datetime.now()

    def add_key_evidence(
        self,
        content: str,
        source: str,
        strength: float = 0.7,
        direction: Literal["supports", "challenges", "neutral"] = "supports"
    ) -> None:
        """
        Add key evidence that should NEVER be compressed.

        Key evidence persists through all compression operations and is
        always shown in full in context strings. Use for critical facts
        that must be preserved across iterations.

        Args:
            content: The evidence text
            source: Where this came from (e.g., "CLAIM-1", "expansion_pass_2")
            strength: How compelling (0-1)
            direction: Whether it supports or challenges the thesis
        """
        evidence = KeyEvidence(
            content=content,
            source=source,
            strength=strength,
            direction=direction,
        )
        # Avoid duplicates
        if not any(e.content == content for e in self.key_evidence):
            self.key_evidence.append(evidence)
            self.last_updated = datetime.now()

    def get_evidence_balance(self) -> dict:
        """Get summary of key evidence balance."""
        supporting = [e for e in self.key_evidence if e.direction == "supports"]
        challenging = [e for e in self.key_evidence if e.direction == "challenges"]

        return {
            "supporting_count": len(supporting),
            "challenging_count": len(challenging),
            "supporting_strength": sum(e.strength for e in supporting),
            "challenging_strength": sum(e.strength for e in challenging),
            "balance": sum(e.strength for e in supporting) - sum(e.strength for e in challenging),
        }

    def update_confidence(self, new_confidence: float) -> None:
        """Update conclusion confidence and track trajectory"""
        self.confidence_history.append(self.current_confidence)
        # Update both legacy field and new model
        self.current_confidence = max(0.0, min(1.0, new_confidence))
        self.confidence_model.conclusion_confidence = self.current_confidence
        self.last_updated = datetime.now()

    def update_confidence_from_critique(self, critique_text: str, conclusion_confidence: float) -> None:
        """
        Update confidence model from critique output.

        Separates:
        - Reasoning quality (fallacies detected)
        - Evidence quality (gaps/issues detected)
        - Conclusion confidence (domain uncertainty)
        """
        self.confidence_history.append(self.current_confidence)

        # Update model from critique markers
        self.confidence_model.update_from_critique(critique_text)
        self.confidence_model.conclusion_confidence = max(0.0, min(1.0, conclusion_confidence))

        # Keep legacy current_confidence as composite for backwards compatibility
        self.current_confidence = self.confidence_model.composite_confidence
        self.last_updated = datetime.now()

    def increment_cycle(self) -> None:
        """Increment cycle count"""
        self.cycle_count += 1
        self.last_updated = datetime.now()

    def record_cycle_insights(self, count: int) -> None:
        """Record insight count for current cycle (for diminishing returns detection)."""
        self.insight_counts.append(count)
        self.last_updated = datetime.now()

    # =====================
    # Branch Management
    # =====================

    def should_branch(self) -> bool:
        """
        Check if conditions warrant creating a branch.

        Branch when:
        - Confidence < BRANCH_CONFIDENCE_THRESHOLD (genuine uncertainty)
        - At least 2 cycles completed (enough exploration)
        - Under MAX_BRANCHES limit
        - At least one [BRANCH] proposal exists
        """
        if self.current_confidence >= self.BRANCH_CONFIDENCE_THRESHOLD:
            return False
        if self.cycle_count < 2:
            return False
        if len([b for b in self.branches if b.is_active]) >= self.MAX_BRANCHES:
            return False
        if not self.sections['branches'].content:
            return False
        return True

    def create_branch(self, thesis: str, parent_id: str | None = None) -> ThesisBranch:
        """
        Create a new thesis branch.

        Args:
            thesis: The alternative thesis statement for this branch
            parent_id: ID of parent branch (None for root-level branches)
        """
        branch_num = len(self.branches) + 1
        branch = ThesisBranch(
            id=f"branch-{branch_num}",
            thesis=thesis,
            confidence=self.current_confidence,
            parent_id=parent_id or self.current_branch_id,
            created_cycle=self.cycle_count,
            is_active=True,
        )
        self.branches.append(branch)
        self.last_updated = datetime.now()
        return branch

    def get_active_branches(self) -> list[ThesisBranch]:
        """Get all active branches."""
        return [b for b in self.branches if b.is_active]

    def get_branch(self, branch_id: str) -> ThesisBranch | None:
        """Get a branch by ID."""
        for branch in self.branches:
            if branch.id == branch_id:
                return branch
        return None

    def update_branch_confidence(self, branch_id: str, confidence: float) -> None:
        """Update confidence for a specific branch."""
        branch = self.get_branch(branch_id)
        if branch:
            branch.confidence = max(0.0, min(1.0, confidence))
            self.last_updated = datetime.now()

    def deactivate_branch(self, branch_id: str) -> None:
        """Deactivate a branch (e.g., when merging or pruning)."""
        branch = self.get_branch(branch_id)
        if branch:
            branch.is_active = False
            self.last_updated = datetime.now()

    def get_winning_branch(self) -> ThesisBranch | None:
        """Get the highest-confidence active branch."""
        active = self.get_active_branches()
        if not active:
            return None
        return max(active, key=lambda b: b.confidence)

    def extract_branch_proposals(self) -> list[str]:
        """Extract [BRANCH] proposals from the branches section."""
        return self.sections['branches'].content.copy()

    def clear_branch_proposals(self) -> None:
        """Clear branch proposals after they've been processed."""
        self.sections['branches'].content = []
        self.sections['branches'].last_updated = datetime.now()

    def estimate_tokens(self) -> int:
        """Estimate token count (rough: 4 chars per token)"""
        total_chars = sum(
            len(' '.join(section.content))
            for section in self.sections.values()
        )
        return total_chars // 4

    def _compress(self) -> None:
        """
        Compress scratchpad when it exceeds token budget.
        Uses anchored iterative compression - preserves key sections, compresses others.
        """
        # Sort sections by priority (preserved first) and recency
        sorted_sections = sorted(
            self.sections.items(),
            key=lambda x: (not x[1].preserved, x[1].last_updated),
            reverse=True
        )

        # Compress non-preserved sections first
        for section_type, section in sorted_sections:
            if section.preserved:
                continue
            if len(section.content) > 5:
                section.content = section.content[-5:]  # Keep 5 most recent

        # If still over budget, compress preserved sections too
        if self.estimate_tokens() > self.MAX_TOKENS:
            for section_type, section in sorted_sections:
                if not section.preserved:
                    continue
                if len(section.content) > 10:
                    section.content = section.content[-10:]  # Keep 10 most recent

    def render(self) -> str:
        """Render scratchpad as context for prompts"""
        lines = [
            f"# Analysis Scratchpad: {self.title}",
            f"Cycle: {self.cycle_count} | Confidence: {self.current_confidence * 100:.0f}%",
        ]

        # Confidence trajectory (from EXP-004 - non-monotonic reveals genuine exploration)
        if self.confidence_history:
            trajectory = ' → '.join(
                f"{c * 100:.0f}%"
                for c in [*self.confidence_history, self.current_confidence]
            )
            lines.append(f"Trajectory: {trajectory}")

        lines.append('')

        # KEY EVIDENCE - Always shown first, never compressed
        if self.key_evidence:
            lines.append("## KEY EVIDENCE (Preserved)")
            for e in self.key_evidence:
                marker = "+" if e.direction == "supports" else "-" if e.direction == "challenges" else "○"
                lines.append(f"• [{marker}][{e.source}][{e.strength:.1f}] {e.content}")
            balance = self.get_evidence_balance()
            lines.append(f"  Balance: {balance['supporting_count']} supporting vs {balance['challenging_count']} challenging")
            lines.append('')

        # ACTIVE BRANCHES - Show divergent thesis paths being explored
        active_branches = self.get_active_branches()
        if active_branches:
            lines.append("## ACTIVE BRANCHES")
            for b in active_branches:
                current_marker = "→ " if b.id == self.current_branch_id else "  "
                lines.append(f"{current_marker}[{b.id}] ({b.confidence*100:.0f}%) {b.thesis[:80]}...")
            lines.append('')

        # Render each section with content
        for section_type, section in self.sections.items():
            if not section.content:
                continue
            header = section_type.upper()
            items = '\n'.join(f"• {c}" for c in section.content)
            lines.append(f"## {header}\n{items}\n")

        return '\n'.join(lines)

    def check_termination(self, max_cycles: int = 5) -> str | None:
        """
        Check termination criteria using COMBINED strategy from EXP-010.

        EXP-010 showed combined (saturation OR diminishing) achieves:
        - 100% early termination (vs 0% for current-only)
        - Quality maintained at 4.63/5

        Returns reason if should terminate, None otherwise.
        """
        # Hard limit
        if self.cycle_count >= max_cycles:
            return f"max_cycles_reached ({max_cycles})"

        # Need at least 2 cycles to evaluate trends
        if self.cycle_count < 2:
            return None

        history = [*self.confidence_history, self.current_confidence]

        # SATURATION: delta_confidence < 0.05 for 2 consecutive cycles
        if len(history) >= 3:
            recent = history[-3:]
            delta1 = abs(recent[1] - recent[0])
            delta2 = abs(recent[2] - recent[1])
            if delta1 < 0.05 and delta2 < 0.05:
                return 'confidence_saturated'

        # DIMINISHING RETURNS: insight rate dropped by >50% from previous cycle
        if len(self.insight_counts) >= 2:
            recent_rate = self.insight_counts[-1]
            prev_rate = self.insight_counts[-2]
            # Avoid division by zero; if prev was 0, don't terminate on this criterion
            if prev_rate > 0 and recent_rate < prev_rate * 0.5:
                return 'diminishing_returns'

        # HIGH CONFIDENCE STABLE (fallback)
        if self.current_confidence >= 0.75:
            open_questions = len(self.sections['questions'].content)
            if open_questions < 2:
                return 'high_confidence_stable'

        return None

    def analyze_trajectory(self) -> dict:
        """
        Get confidence trajectory analysis.
        Non-monotonic paths indicate genuine exploration (EXP-004).
        """
        history = [*self.confidence_history, self.current_confidence]
        if len(history) < 2:
            return {'is_monotonic': True, 'max_dip': 0.0, 'final_trend': 'stable'}

        is_monotonic = True
        max_dip = 0.0
        max_so_far = history[0]

        for i in range(1, len(history)):
            if history[i] < history[i - 1]:
                is_monotonic = False
                dip = max_so_far - history[i]
                max_dip = max(max_dip, dip)
            max_so_far = max(max_so_far, history[i])

        # Final trend from last 2 points
        last = history[-1]
        prev = history[-2]
        if last > prev + 0.03:
            final_trend = 'increasing'
        elif last < prev - 0.03:
            final_trend = 'decreasing'
        else:
            final_trend = 'stable'

        return {
            'is_monotonic': is_monotonic,
            'max_dip': max_dip,
            'final_trend': final_trend
        }

    def to_dict(self) -> dict:
        """Serialize to dictionary"""
        return {
            'session_id': self.session_id,
            'title': self.title,
            'sections': {
                k: {
                    'type': v.type,
                    'content': v.content,
                    'last_updated': v.last_updated.isoformat(),
                    'preserved': v.preserved,
                }
                for k, v in self.sections.items()
            },
            'key_evidence': [e.to_dict() for e in self.key_evidence],
            'insight_counts': self.insight_counts,
            'branches': [b.to_dict() for b in self.branches],
            'current_branch_id': self.current_branch_id,
            'confidence_history': self.confidence_history,
            'current_confidence': self.current_confidence,
            'confidence_model': self.confidence_model.to_dict(),
            'cycle_count': self.cycle_count,
            'created': self.created.isoformat(),
            'last_updated': self.last_updated.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Scratchpad':
        """Deserialize from dictionary"""
        scratchpad = cls(
            session_id=data['session_id'],
            title=data['title'],
            confidence_history=data['confidence_history'],
            current_confidence=data['current_confidence'],
            cycle_count=data['cycle_count'],
            created=datetime.fromisoformat(data['created']),
            last_updated=datetime.fromisoformat(data['last_updated']),
        )
        scratchpad.sections = {
            k: Section(
                type=v['type'],
                content=v['content'],
                last_updated=datetime.fromisoformat(v['last_updated']),
                preserved=v['preserved'],
            )
            for k, v in data['sections'].items()
        }
        scratchpad.key_evidence = [
            KeyEvidence.from_dict(e)
            for e in data.get('key_evidence', [])
        ]
        scratchpad.insight_counts = data.get('insight_counts', [])
        scratchpad.branches = [
            ThesisBranch.from_dict(b)
            for b in data.get('branches', [])
        ]
        scratchpad.current_branch_id = data.get('current_branch_id')
        if 'confidence_model' in data:
            scratchpad.confidence_model = ConfidenceModel.from_dict(data['confidence_model'])
        return scratchpad
