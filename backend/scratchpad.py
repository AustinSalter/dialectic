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
}

SectionType = Literal[
    'insights', 'evidence', 'risks', 'counters',
    'questions', 'patterns', 'decisions', 'meta', 'claims'
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
    current_confidence: float = 0.5
    cycle_count: int = 0
    created: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)

    # Key evidence - NEVER compressed (from working_memory.py)
    key_evidence: list[KeyEvidence] = field(default_factory=list)

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
            }

    def extract_and_merge(self, text: str) -> None:
        """
        Extract marked content from expansion output and merge into scratchpad.
        Uses semantic markers from EXP-003/EXP-008.
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
        }

        for marker, pattern in SEMANTIC_MARKERS.items():
            section_type = marker_to_section[marker]
            matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)

            for match in matches:
                content = match.strip()
                if content and content not in self.sections[section_type].content:
                    self.sections[section_type].content.append(content)
                    self.sections[section_type].last_updated = datetime.now()

        self.last_updated = datetime.now()

        # Compress if needed
        if self.estimate_tokens() > self.MAX_TOKENS:
            self._compress()

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
        """Update confidence and track trajectory"""
        self.confidence_history.append(self.current_confidence)
        self.current_confidence = max(0.0, min(1.0, new_confidence))
        self.last_updated = datetime.now()

    def increment_cycle(self) -> None:
        """Increment cycle count"""
        self.cycle_count += 1
        self.last_updated = datetime.now()

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
        Check termination criteria (from EXP-010).
        Returns reason if should terminate, None otherwise.
        """
        # Hard limit
        if self.cycle_count >= max_cycles:
            return f"max_cycles_reached ({max_cycles})"

        # Need at least 2 cycles to evaluate trends
        if self.cycle_count < 2:
            return None

        history = [*self.confidence_history, self.current_confidence]

        # Saturation: delta_confidence < 0.05 for 2 cycles
        if len(history) >= 3:
            recent = history[-3:]
            delta1 = abs(recent[1] - recent[0])
            delta2 = abs(recent[2] - recent[1])
            if delta1 < 0.05 and delta2 < 0.05:
                return 'confidence_saturated'

        # High confidence with few open questions
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
            'confidence_history': self.confidence_history,
            'current_confidence': self.current_confidence,
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
        return scratchpad
