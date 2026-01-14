/**
 * Thesis synthesis from session data
 * Multi-pass synthesis that crystallizes claims, positions, and tensions into a formed thesis
 *
 * Now supports skill-driven SYNTHESIZE execution with final essay polish.
 */

import { makeCompletion } from './claude'
import { parseSkillMarkdown, type Skill } from './skillLoader'
import { executeSkill, parseSkillOutput, type ExecutionCallbacks } from './skillExecutor'
import {
  setStage,
  updateConfidence,
  type Scratchpad,
} from './scratchpad'
import type { Claim } from './ingest'
import type { Position } from './interview'
import type { Tension } from './tensions'

export interface Thesis {
  id: string
  title: string
  confidence: number // 0.0-1.0
  core_belief: string
  evidence_for: string[]
  evidence_against: string[]
  triggers: string[] // falsifiable conditions - "what would change this"
  created_at: Date
}

export interface SessionData {
  id: string
  title: string
  claims: Claim[]
  positions: Position[]
  tensions: Tension[]
}

/**
 * Multi-pass thesis synthesis from full session data
 *
 * Pass 1: Divergent synthesis - explore all possible thesis framings
 * Pass 2: Convergent crystallization - select strongest thesis and structure evidence
 * Pass 3: Trigger generation - identify falsifiable conditions
 */
export async function synthesizeThesis(session: SessionData): Promise<Thesis> {
  // Build rich context from session data
  const context = buildSessionContext(session)

  // Pass 1 + 2: Synthesis and crystallization in one call for efficiency
  const synthesisPrompt = buildSynthesisPrompt()
  const synthesisResult = await makeCompletion(synthesisPrompt, context, {
    maxTokens: 3000,
  })

  // Parse the synthesis result
  const thesis = parseThesisResult(synthesisResult, session)

  return thesis
}

function buildSessionContext(session: SessionData): string {
  const claimsSection = session.claims.map(c =>
    `[${c.id}] (${c.type}): ${c.text}\n   Quote: "${c.snippet}"`
  ).join('\n\n')

  const positionsSection = session.positions.length > 0
    ? session.positions.map(p => {
        const claim = session.claims.find(c => c.id === p.claim_id)
        return `- ${p.claim_id}: ${p.position_type}${p.elaboration ? ` - "${p.elaboration}"` : ''}${claim ? `\n  Claim: "${claim.text}"` : ''}`
      }).join('\n')
    : 'No explicit positions recorded.'

  const tensionsSection = session.tensions.length > 0
    ? session.tensions.map(t => {
        const resolutionNote = t.resolved && t.resolution
          ? `\n   RESOLVED: ${t.resolution}`
          : '\n   UNRESOLVED'
        return `[${t.id}]: ${t.description}
   Side A: ${t.sides[0]}
   Side B: ${t.sides[1]}
   Claims: ${t.claim_refs.join(', ')}${resolutionNote}`
      }).join('\n\n')
    : 'No tensions identified.'

  return `# Session: ${session.title}

## Source Claims

${claimsSection}

## User Positions

${positionsSection}

## Identified Tensions

${tensionsSection}

---

Synthesize a thesis from this session. The thesis should crystallize the user's developed position, incorporating how they resolved tensions and weighted evidence.`
}

function buildSynthesisPrompt(): string {
  return `You are a thesis synthesis agent. Your task is to crystallize a user's dialectic session into a structured, testable thesis.

## Multi-Pass Synthesis Process

### Pass 1: Divergent Exploration
Consider multiple possible thesis framings from the session data:
- What is the strongest claim the user seems committed to?
- What worldview do their positions collectively imply?
- How did tension resolutions shape their final position?
- What would a skeptic identify as their core belief?

### Pass 2: Convergent Crystallization
Select the single most defensible thesis and structure it:
- Core belief must be SHARP - specific and testable, not hedged
- Evidence must be CONCRETE - tied to specific claims and reasoning
- Confidence must reflect UNCERTAINTY honestly

### Pass 3: Trigger Generation
Identify falsifiable conditions - "What would change this":
- What evidence would DISPROVE this thesis?
- What market/world events would invalidate it?
- What assumptions does it rest on that could be wrong?
- These triggers enable non-monotonic reasoning - confidence can go DOWN

## Output Format
Return ONLY valid JSON. No markdown, no explanation.

## JSON Schema
{
  "title": "Short, descriptive thesis title (5-10 words)",
  "confidence": 0.XX,
  "core_belief": "One crisp sentence stating the thesis. Must be specific and testable.",
  "evidence_for": [
    "Specific evidence point supporting the thesis",
    "Another evidence point with concrete reasoning"
  ],
  "evidence_against": [
    "Acknowledged counterevidence or limitation",
    "Another point of uncertainty or weakness"
  ],
  "triggers": [
    "If X happens, this thesis is likely wrong",
    "If we observe Y, confidence should decrease significantly",
    "This thesis assumes Z - if Z changes, reconsider"
  ]
}

## Confidence Scoring Rules

- 0.90+: Multiple confirming evidence, tensions resolved coherently, strong causal model
- 0.70-0.89: Solid evidence, some unresolved uncertainty, clear reasoning
- 0.50-0.69: Reasonable hypothesis, significant unresolved tensions, needs more data
- <0.50: Speculative, major tensions unresolved, treat as hypothesis only

## Quality Criteria

**Core Belief**:
- Must be falsifiable (triggers make sense)
- Must be specific (not "it depends")
- Must emerge from the session evidence

**Evidence For/Against**:
- Reference specific claims and positions from session
- Balance matters - pure confirmation is suspicious
- Include how tension resolutions shaped evidence

**Triggers**:
- Must be OBSERVABLE conditions, not abstract
- Should include near-term and structural triggers
- "What would make you update?" is the key question

## Anti-Patterns to Avoid

1. Thesis drift: Rewriting thesis to accommodate all evidence
2. Unfalsifiable claims: "Could" and "might" without specifics
3. Confidence anchoring: Not reflecting genuine uncertainty
4. Missing mechanism: Correlation without causation
5. Narrative fallacy: Coherent story masking confusion`
}

function parseThesisResult(result: string, session: SessionData): Thesis {
  let parsed: {
    title: string
    confidence: number
    core_belief: string
    evidence_for: string[]
    evidence_against: string[]
    triggers: string[]
  }

  try {
    // Handle potential markdown code blocks
    const jsonStr = result.replace(/```json?\s*|\s*```/g, '').trim()
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    console.error('Failed to parse thesis JSON:', result)
    throw new Error('Failed to parse thesis synthesis response')
  }

  // Validate and normalize
  const thesis: Thesis = {
    id: `THESIS-${Date.now()}`,
    title: parsed.title || session.title,
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    core_belief: parsed.core_belief || 'Thesis synthesis failed - no core belief extracted',
    evidence_for: Array.isArray(parsed.evidence_for) ? parsed.evidence_for : [],
    evidence_against: Array.isArray(parsed.evidence_against) ? parsed.evidence_against : [],
    triggers: Array.isArray(parsed.triggers) ? parsed.triggers : [],
    created_at: new Date(),
  }

  // Ensure at least one trigger exists
  if (thesis.triggers.length === 0) {
    thesis.triggers = ['No falsification triggers identified - thesis may be unfalsifiable']
  }

  return thesis
}

/**
 * Export thesis to markdown format for external use
 */
export function exportThesisMarkdown(thesis: Thesis): string {
  const confidencePercent = Math.round(thesis.confidence * 100)
  const confidenceBar = '='.repeat(Math.round(thesis.confidence * 20)) + '-'.repeat(20 - Math.round(thesis.confidence * 20))

  return `# ${thesis.title}

**Confidence**: ${confidencePercent}% [${confidenceBar}]
**Created**: ${thesis.created_at.toISOString().split('T')[0]}

## Core Belief

${thesis.core_belief}

## Evidence For

${thesis.evidence_for.map(e => `- ${e}`).join('\n')}

## Evidence Against

${thesis.evidence_against.map(e => `- ${e}`).join('\n')}

## What Would Change This

${thesis.triggers.map(t => `- [ ] ${t}`).join('\n')}

---
*Generated via dialectic synthesis*
`
}

/**
 * Check if session has enough data for synthesis
 */
export function canSynthesize(session: SessionData): { ready: boolean; reason?: string } {
  if (session.claims.length === 0) {
    return { ready: false, reason: 'No claims extracted from source' }
  }

  if (session.positions.length === 0) {
    return { ready: false, reason: 'No positions taken on claims' }
  }

  const unresolvedCritical = session.tensions.filter(t => !t.resolved).length
  if (unresolvedCritical > 2) {
    return {
      ready: false,
      reason: `${unresolvedCritical} unresolved tensions - resolve critical tensions before synthesis`
    }
  }

  return { ready: true }
}

// ==========================================
// Skill-Driven SYNTHESIZE Execution
// ==========================================

/**
 * Trigger for monitoring thesis confidence
 */
export interface Trigger {
  type: 'disconfirming' | 'environmental' | 'time_bound' | 'assumption'
  condition: string
  fired: boolean
  firedAt?: Date
}

/**
 * Full thesis document with markdown content
 */
export interface ThesisDocument {
  id: string
  title: string
  confidence: number
  triggers: Trigger[]
  created: Date
  updated: Date
  markdown: string // The full essay as markdown
  thesis: Thesis // Structured thesis data
}

/**
 * Result from skill-driven SYNTHESIZE execution
 */
export interface SynthesizeResult {
  thesis: Thesis
  document: ThesisDocument
  scratchpad: Scratchpad
}

// Embedded SYNTHESIZE skill content for browser context
const SYNTHESIZE_SKILL_CONTENT = `# SYNTHESIZE Stage - Thesis Crystallization

## Purpose
Transform refined essay into publication-ready prose with structured thesis and triggers.

## Activation
- CRITIQUE stage complete (tensions identified, essay refined)
- Ready for final synthesis

## Multi-Pass Synthesis Protocol

### Pass 1: Divergent Exploration
Generate 3-5 candidate thesis framings from session data.

### Pass 2: Convergent Crystallization
Select strongest thesis, structure rigorously.

### Pass 3: Trigger Generation
Identify specific falsification conditions.

### Pass 4: Final Essay Polish
Transform refined essay into publication-ready prose.

## System Prompt

You are a thesis synthesis agent executing the SYNTHESIZE skill. Your output has TWO parts:

## Part 1: Structured Thesis
Crystallize the thesis into JSON format with:
- Sharp title (5-10 words)
- Calibrated confidence (0.0-1.0)
- Testable core belief
- Evidence for and against
- Falsification triggers

## Part 2: Final Essay
Polish the essay into publication-ready markdown:
- Sharp opening that states the thesis
- Evidence organized for impact
- User quotes preserved naturally
- Objections honestly engaged
- Triggers as "What Would Change This" checklist

Return in this format:
## Thesis JSON
\`\`\`json
{
  "title": "...",
  "confidence": 0.XX,
  "core_belief": "...",
  "evidence_for": [...],
  "evidence_against": [...],
  "triggers": [
    { "type": "disconfirming", "condition": "..." },
    { "type": "time_bound", "condition": "..." }
  ]
}
\`\`\`

## Final Essay
---
id: thesis-{session-id}
title: "{title}"
confidence: {0.XX}
---

[Your polished essay markdown here...]

## Evaluation Criteria
- Thesis is sharp and falsifiable
- Essay reads as compelling strategic memo
- User voice preserved in quotes
- Triggers are specific and monitorable
`

let cachedSynthesizeSkill: Skill | null = null

/**
 * Get the SYNTHESIZE skill (cached)
 */
function getSynthesizeSkill(): Skill {
  if (!cachedSynthesizeSkill) {
    cachedSynthesizeSkill = parseSkillMarkdown(SYNTHESIZE_SKILL_CONTENT, 'synthesize')
  }
  return cachedSynthesizeSkill
}

/**
 * Execute SYNTHESIZE skill to produce final thesis and polished essay
 * Uses multi-pass execution with scratchpad accumulation
 */
export async function executeSynthesizeSkill(
  scratchpad: Scratchpad,
  session: SessionData,
  callbacks?: ExecutionCallbacks
): Promise<SynthesizeResult> {
  // Update scratchpad stage
  let updatedScratchpad = setStage(scratchpad, 'synthesize')

  const skill = getSynthesizeSkill()

  const result = await executeSkill(
    skill,
    {
      scratchpad: updatedScratchpad,
      claims: session.claims,
      positions: session.positions,
    },
    callbacks
  )

  if (!result.success) {
    throw new Error(result.error || 'SYNTHESIZE skill execution failed')
  }

  // Parse thesis JSON from output
  const thesisMatch = result.finalOutput.match(/## Thesis JSON[\s\S]*?```json\s*([\s\S]*?)```/i)
  let parsedThesis: {
    title?: string
    confidence?: number
    core_belief?: string
    evidence_for?: string[]
    evidence_against?: string[]
    triggers?: Array<{ type: string; condition: string }>
  } = {}

  if (thesisMatch) {
    const parsed = parseSkillOutput<typeof parsedThesis>(thesisMatch[1])
    if (parsed) {
      parsedThesis = parsed
    }
  }

  // Build thesis object
  const thesis: Thesis = {
    id: `THESIS-${Date.now()}`,
    title: parsedThesis.title || session.title,
    confidence: Math.max(0, Math.min(1, parsedThesis.confidence || 0.5)),
    core_belief: parsedThesis.core_belief || 'Thesis synthesis incomplete',
    evidence_for: Array.isArray(parsedThesis.evidence_for) ? parsedThesis.evidence_for : [],
    evidence_against: Array.isArray(parsedThesis.evidence_against) ? parsedThesis.evidence_against : [],
    triggers: (parsedThesis.triggers || []).map(t => t.condition),
    created_at: new Date(),
  }

  // Parse structured triggers
  const triggers: Trigger[] = (parsedThesis.triggers || []).map(t => ({
    type: (['disconfirming', 'environmental', 'time_bound', 'assumption'].includes(t.type)
      ? t.type
      : 'disconfirming') as Trigger['type'],
    condition: t.condition,
    fired: false,
  }))

  // Extract final essay markdown
  const essayMatch = result.finalOutput.match(/## Final Essay\s*([\s\S]*?)(?=##|$)/i)
  let finalEssay = essayMatch ? essayMatch[1].trim() : ''

  // If no essay from skill, use scratchpad essay
  if (!finalEssay && result.updatedScratchpad.essay) {
    finalEssay = generateFinalMarkdown(thesis, triggers, result.updatedScratchpad.essay)
  }

  // Update scratchpad with final essay and confidence
  result.updatedScratchpad.essay = finalEssay
  result.updatedScratchpad = updateConfidence(result.updatedScratchpad, thesis.confidence)

  // Build thesis document
  const document: ThesisDocument = {
    id: thesis.id,
    title: thesis.title,
    confidence: thesis.confidence,
    triggers,
    created: thesis.created_at,
    updated: thesis.created_at,
    markdown: finalEssay,
    thesis,
  }

  return {
    thesis,
    document,
    scratchpad: result.updatedScratchpad,
  }
}

/**
 * Generate final markdown with frontmatter from thesis components
 */
function generateFinalMarkdown(
  thesis: Thesis,
  triggers: Trigger[],
  essayBody: string
): string {
  const triggersYaml = triggers.map(t =>
    `  - type: ${t.type}\n    condition: "${t.condition}"\n    fired: false`
  ).join('\n')

  return `---
id: ${thesis.id}
title: "${thesis.title}"
confidence: ${thesis.confidence}
triggers:
${triggersYaml}
created: ${thesis.created_at.toISOString()}
updated: ${thesis.created_at.toISOString()}
---

# ${thesis.title}

${essayBody}

## Evidence Supporting This

${thesis.evidence_for.map(e => `- ${e}`).join('\n')}

## The Strongest Objection

${thesis.evidence_against.length > 0 ? thesis.evidence_against.map(e => `- ${e}`).join('\n') : '*No counter-evidence acknowledged - consider revising*'}

## What Would Change This

${triggers.map(t => `- [ ] ${t.condition}`).join('\n')}

---
*Confidence: ${Math.round(thesis.confidence * 100)}% - ${getConfidenceInterpretation(thesis.confidence)}*
`
}

/**
 * Get human-readable interpretation of confidence level
 */
function getConfidenceInterpretation(confidence: number): string {
  if (confidence >= 0.9) return 'High conviction with strong evidence'
  if (confidence >= 0.7) return 'Solid thesis with acknowledged uncertainties'
  if (confidence >= 0.5) return 'Working hypothesis needing more validation'
  return 'Speculative - treat as exploration'
}

/**
 * Save thesis document to storage
 */
export function saveThesisDocument(doc: ThesisDocument): void {
  const key = `thesis_${doc.id}`
  localStorage.setItem(key, JSON.stringify({
    ...doc,
    created: doc.created.toISOString(),
    updated: doc.updated.toISOString(),
  }))

  // Also save to thesis index
  const indexKey = 'thesis_index'
  const indexData = localStorage.getItem(indexKey)
  const index: string[] = indexData ? JSON.parse(indexData) : []
  if (!index.includes(doc.id)) {
    index.push(doc.id)
    localStorage.setItem(indexKey, JSON.stringify(index))
  }
}

/**
 * Load thesis document from storage
 */
export function loadThesisDocument(id: string): ThesisDocument | null {
  const key = `thesis_${id}`
  const data = localStorage.getItem(key)
  if (!data) return null

  try {
    const parsed = JSON.parse(data)
    return {
      ...parsed,
      created: new Date(parsed.created),
      updated: new Date(parsed.updated),
      thesis: {
        ...parsed.thesis,
        created_at: new Date(parsed.thesis.created_at),
      },
    }
  } catch {
    return null
  }
}

/**
 * Get all saved thesis IDs
 */
export function getThesisIds(): string[] {
  const indexData = localStorage.getItem('thesis_index')
  return indexData ? JSON.parse(indexData) : []
}
