"""
Memory Management for Strategy Copilot

Loads theses, sessions, and patterns from /memories directory.
Integrates with agent/ module for paths and config.

Memory structure:
/memories
├── theses/           # Persistent beliefs (market theses)
│   ├── _index.yaml   # Master registry
│   └── {domain}/{thesis}.md
├── sessions/         # Past analyses
│   ├── index.yaml
│   └── {date}-{topic}.yaml
└── patterns/         # Reusable frameworks
    └── {pattern}.md
"""

import re
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import yaml

# Add agent to path for imports
AGENT_PATH = Path(__file__).parent.parent.parent / "agent"
sys.path.insert(0, str(AGENT_PATH.parent))

try:
    from agent.config import (
        MEMORIES_PATH,
        THESES_PATH,
        SESSIONS_PATH,
        PATTERNS_PATH,
    )
except ImportError:
    # Fallback if agent not available
    PROJECT_ROOT = Path(__file__).parent.parent.parent
    MEMORIES_PATH = PROJECT_ROOT / "memories"
    THESES_PATH = MEMORIES_PATH / "theses"
    SESSIONS_PATH = MEMORIES_PATH / "sessions"
    PATTERNS_PATH = MEMORIES_PATH / "patterns"


@dataclass
class Thesis:
    """A persistent belief/thesis from memory"""
    id: str
    title: str
    domain: str
    confidence: float
    summary: str
    content: str  # Full markdown content
    tags: list[str] = field(default_factory=list)
    related: list[str] = field(default_factory=list)
    status: str = "active"

    @property
    def core_belief(self) -> str:
        """Extract the thesis statement from content"""
        # Look for ## Thesis section
        match = re.search(r'## Thesis\n(.+?)(?=\n##|\Z)', self.content, re.DOTALL)
        if match:
            return match.group(1).strip()
        return self.summary

    @property
    def falsification(self) -> str:
        """Extract falsification conditions"""
        match = re.search(r'## Falsification\n(.+?)(?=\n##|\Z)', self.content, re.DOTALL)
        if match:
            return match.group(1).strip()
        return ""


@dataclass
class Pattern:
    """A reusable analytical framework"""
    id: str
    title: str
    content: str

    @property
    def summary(self) -> str:
        """Extract first paragraph as summary"""
        lines = self.content.split('\n')
        for line in lines:
            if line.strip() and not line.startswith('#'):
                return line.strip()
        return self.title


@dataclass
class Session:
    """A past analysis session"""
    id: str
    title: str
    date: str
    domain: str
    summary: str
    theses_referenced: list[str] = field(default_factory=list)
    outcome: Optional[str] = None


class MemoryManager:
    """
    Load and search theses, patterns, and sessions from /memories.

    Usage:
        memory = MemoryManager()
        memory.load()

        # Find relevant theses
        theses = memory.search_theses("AI infrastructure")

        # Get specific thesis
        thesis = memory.get_thesis("monetization-gap")

        # Find related content
        related = memory.find_related("power-as-binding-constraint")
    """

    def __init__(self):
        self.theses: dict[str, Thesis] = {}
        self.patterns: dict[str, Pattern] = {}
        self.sessions: dict[str, Session] = {}
        self.thesis_index: dict = {}
        self.relationships: list[dict] = []
        self._loaded = False

    def load(self) -> None:
        """Load all memory from disk"""
        if self._loaded:
            return

        self._load_thesis_index()
        self._load_theses()
        self._load_patterns()
        self._load_sessions()
        self._loaded = True

    def _load_thesis_index(self) -> None:
        """Load thesis index and relationships"""
        index_path = THESES_PATH / "_index.yaml"
        if not index_path.exists():
            return

        with open(index_path, 'r') as f:
            self.thesis_index = yaml.safe_load(f) or {}

        # Extract relationships
        self.relationships = self.thesis_index.get('relationships', [])

    def _load_theses(self) -> None:
        """Load all thesis markdown files"""
        if not THESES_PATH.exists():
            return

        for domain_dir in THESES_PATH.iterdir():
            if not domain_dir.is_dir() or domain_dir.name.startswith('_'):
                continue

            if domain_dir.name == 'archive':
                continue  # Skip archived theses for now

            domain = domain_dir.name

            for thesis_file in domain_dir.glob('*.md'):
                if thesis_file.name == 'README.md':
                    continue

                thesis = self._parse_thesis(thesis_file, domain)
                if thesis:
                    self.theses[thesis.id] = thesis

    def _parse_thesis(self, path: Path, domain: str) -> Optional[Thesis]:
        """Parse a thesis markdown file"""
        content = path.read_text()

        # Parse YAML frontmatter
        frontmatter = {}
        if content.startswith('---'):
            end = content.find('---', 3)
            if end != -1:
                try:
                    frontmatter = yaml.safe_load(content[3:end]) or {}
                    content = content[end + 3:].strip()
                except yaml.YAMLError:
                    pass

        # Extract title from first heading
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        title = title_match.group(1) if title_match else path.stem

        # Get metadata from index if available
        index_entry = self._find_in_index(frontmatter.get('id', path.stem))

        return Thesis(
            id=frontmatter.get('id', path.stem),
            title=title,
            domain=domain,
            confidence=frontmatter.get('confidence', index_entry.get('confidence', 0.5)),
            summary=index_entry.get('summary', ''),
            content=content,
            tags=frontmatter.get('tags', []),
            related=frontmatter.get('related', []),
            status=frontmatter.get('status', 'active'),
        )

    def _find_in_index(self, thesis_id: str) -> dict:
        """Find thesis metadata in index"""
        for domain_data in self.thesis_index.values():
            if isinstance(domain_data, dict) and 'theses' in domain_data:
                for thesis in domain_data['theses']:
                    if thesis.get('id') == thesis_id:
                        return thesis
        return {}

    def _load_patterns(self) -> None:
        """Load all pattern markdown files"""
        if not PATTERNS_PATH.exists():
            return

        for pattern_file in PATTERNS_PATH.glob('*.md'):
            if pattern_file.name == 'README.md':
                continue

            content = pattern_file.read_text()
            title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            title = title_match.group(1) if title_match else pattern_file.stem

            self.patterns[pattern_file.stem] = Pattern(
                id=pattern_file.stem,
                title=title,
                content=content,
            )

    def _load_sessions(self) -> None:
        """Load session index"""
        index_path = SESSIONS_PATH / "index.yaml"
        if not index_path.exists():
            return

        with open(index_path, 'r') as f:
            index = yaml.safe_load(f) or {}

        for session_data in index.get('sessions', []):
            self.sessions[session_data['id']] = Session(
                id=session_data['id'],
                title=session_data.get('title', ''),
                date=session_data.get('date', ''),
                domain=session_data.get('domain', ''),
                summary=session_data.get('summary', ''),
                theses_referenced=session_data.get('theses_referenced', []),
                outcome=session_data.get('outcome'),
            )

    # =========================================================================
    # Search and Retrieval
    # =========================================================================

    def get_thesis(self, thesis_id: str) -> Optional[Thesis]:
        """Get a specific thesis by ID"""
        self.load()
        return self.theses.get(thesis_id)

    def get_pattern(self, pattern_id: str) -> Optional[Pattern]:
        """Get a specific pattern by ID"""
        self.load()
        return self.patterns.get(pattern_id)

    def search_theses(self, query: str, limit: int = 5) -> list[Thesis]:
        """
        Search theses by keyword matching.

        Simple keyword search - can be enhanced with embeddings later.
        """
        self.load()
        query_lower = query.lower()
        query_terms = query_lower.split()

        scored = []
        for thesis in self.theses.values():
            score = 0
            searchable = f"{thesis.title} {thesis.summary} {thesis.domain} {' '.join(thesis.tags)}".lower()

            for term in query_terms:
                if term in searchable:
                    score += 1
                if term in thesis.title.lower():
                    score += 2  # Title matches weighted higher
                if term in thesis.tags:
                    score += 2  # Tag matches weighted higher

            if score > 0:
                scored.append((score, thesis))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [t for _, t in scored[:limit]]

    def search_patterns(self, query: str, limit: int = 3) -> list[Pattern]:
        """Search patterns by keyword"""
        self.load()
        query_lower = query.lower()

        scored = []
        for pattern in self.patterns.values():
            score = 0
            searchable = f"{pattern.title} {pattern.content[:500]}".lower()

            for term in query_lower.split():
                if term in searchable:
                    score += 1

            if score > 0:
                scored.append((score, pattern))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored[:limit]]

    def find_related(self, thesis_id: str) -> list[Thesis]:
        """Find theses related to a given thesis"""
        self.load()

        thesis = self.theses.get(thesis_id)
        if not thesis:
            return []

        related_ids = set(thesis.related)

        # Add from relationship graph
        for rel in self.relationships:
            if rel.get('source') == thesis_id:
                related_ids.add(rel.get('target'))
            if rel.get('target') == thesis_id:
                related_ids.add(rel.get('source'))

        return [self.theses[tid] for tid in related_ids if tid in self.theses]

    def get_domain_theses(self, domain: str) -> list[Thesis]:
        """Get all theses in a domain"""
        self.load()
        return [t for t in self.theses.values() if t.domain == domain]

    def list_domains(self) -> list[str]:
        """List all thesis domains"""
        self.load()
        return list(set(t.domain for t in self.theses.values()))

    # =========================================================================
    # Context Assembly
    # =========================================================================

    def assemble_thesis_context(self, theses: list[Thesis], max_tokens: int = 4000) -> str:
        """
        Assemble thesis context for Pass 0.

        Returns a formatted string with thesis summaries and key beliefs.
        """
        lines = ["# Relevant Theses\n"]

        char_budget = max_tokens * 4  # Rough chars-to-tokens
        used = len(lines[0])

        for thesis in theses:
            entry = f"""
## {thesis.title}
**Confidence**: {thesis.confidence:.0%} | **Domain**: {thesis.domain}

{thesis.core_belief}

**Falsification**: {thesis.falsification[:200]}...
"""
            if used + len(entry) > char_budget:
                break
            lines.append(entry)
            used += len(entry)

        return "\n".join(lines)

    def assemble_pattern_context(self, patterns: list[Pattern], max_tokens: int = 2000) -> str:
        """Assemble pattern context for Pass 0"""
        lines = ["# Analytical Frameworks\n"]

        char_budget = max_tokens * 4
        used = len(lines[0])

        for pattern in patterns:
            entry = f"""
## {pattern.title}

{pattern.summary}
"""
            if used + len(entry) > char_budget:
                break
            lines.append(entry)
            used += len(entry)

        return "\n".join(lines)


# Singleton for easy import
_memory = None

def get_memory() -> MemoryManager:
    """Get the global memory manager instance"""
    global _memory
    if _memory is None:
        _memory = MemoryManager()
        _memory.load()
    return _memory
