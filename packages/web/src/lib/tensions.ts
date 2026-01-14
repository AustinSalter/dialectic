/**
 * Tension identification and management
 * Uses Claude to find contradictions and unresolved conflicts in user positions
 *
 * Now supports skill-driven CRITIQUE execution with essay refinement.
 */

import { makeCompletion } from './claude'
import { parseSkillMarkdown, type Skill } from './skillLoader'
import { executeSkill, parseSkillOutput, type ExecutionCallbacks } from './skillExecutor'
import {
  setStage,
  addTension as addTensionToScratchpad,
  addUserQuote,
  type Scratchpad,
  type UserQuote,
} from './scratchpad'
import type { Claim } from './ingest'
import type { Position } from './interview'

export interface Tension {
  id: string
  description: string
  sides: [string, string]
  claim_refs: string[]
  resolved: boolean
  resolution?: string
}

/**
 * Identify tensions from claims and user positions
 * Uses adversarial critique to find contradictions, frame conflicts, and commitment tensions
 */
export async function identifyTensions(
  claims: Claim[],
  positions: Position[]
): Promise<Tension[]> {
  if (claims.length === 0) {
    return []
  }

  const systemPrompt = `You are an adversarial critique agent. Your task is to identify tensions, contradictions, and unresolved conflicts in a user's positions on various claims.

## Your Role
You must be GENUINELY adversarial, not performatively so. This means:
- Finding actual contradictions, not just surface-level disagreements
- Identifying frame conflicts where the user holds incompatible worldviews
- Exposing commitment tensions where stated positions conflict with implied commitments
- Challenging confirmation bias by surfacing evidence the user may be ignoring
- Avoiding narrative fallacy by questioning whether coherent stories mask underlying confusion

## Six Questioning Techniques

Apply these questioning techniques to identify tensions:

1. **Socratic Examination**: What assumptions does this position rest on? Are they consistent with other positions?

2. **Steel-Manning + Critique**: What's the strongest version of the opposing view? Does the user's position adequately address it?

3. **Second-Order Probing**: If this position is true, what else must be true? Does the user accept those implications?

4. **Frame Conflict Detection**: What lens is the user using here? Is it compatible with lenses used in other positions?

5. **Commitment Mapping**: What is the user implicitly committed to by holding this position? Do those commitments conflict?

6. **Counter-Factual Stress Testing**: Under what conditions would this position be wrong? Has the user accounted for those scenarios?

## Output Format
Return ONLY valid JSON array. No markdown, no explanation.

## JSON Schema
[
  {
    "id": "TENSION-1",
    "description": "Brief description of the tension (1-2 sentences)",
    "sides": ["Position A articulation", "Position B articulation"],
    "claim_refs": ["CLAIM-1", "CLAIM-3"],
    "resolved": false
  }
]

## Quality Criteria
- Tensions must be REAL conflicts, not rhetorical devices
- Each tension should reference specific claims
- The two sides must be genuinely incompatible, not just different emphases
- Avoid false tensions (positions that seem contradictory but aren't upon reflection)
- Prioritize tensions that matter for decision-making`

  // Build context from claims and positions
  const claimsContext = claims.map(c =>
    `[${c.id}] (${c.type}): ${c.text}\n   Quote: "${c.snippet}"`
  ).join('\n\n')

  const positionsContext = positions.length > 0
    ? positions.map(p =>
        `- ${p.claim_id}: User ${p.position_type}${p.elaboration ? ` - "${p.elaboration}"` : ''}`
      ).join('\n')
    : 'No explicit positions recorded yet. Analyze claims for potential tensions the user would face when taking positions.'

  const userPrompt = `## Claims from Source Material

${claimsContext}

## User Positions

${positionsContext}

## Task

Identify 1-5 tensions in these positions. Apply the six questioning techniques. Be genuinely adversarial - find real contradictions and frame conflicts, not surface-level disagreements.

Focus on:
1. Contradictions between positions
2. Frame conflicts (incompatible worldviews)
3. Commitment tensions (stated positions vs implied commitments)
4. Gaps where confirmation bias may be operating
5. Narrative fallacy - where coherent story masks confusion

Return ONLY the JSON array.`

  const response = await makeCompletion(systemPrompt, userPrompt, {
    maxTokens: 2048,
  })

  // Parse JSON response
  let tensions: Tension[]
  try {
    const jsonStr = response.replace(/```json?\s*|\s*```/g, '').trim()
    tensions = JSON.parse(jsonStr)
  } catch (e) {
    console.error('Failed to parse tensions JSON:', response)
    throw new Error('Failed to parse tension identification response')
  }

  // Validate and normalize tensions
  tensions = tensions.map((t, i) => ({
    id: t.id || `TENSION-${i + 1}`,
    description: t.description || 'Unspecified tension',
    sides: Array.isArray(t.sides) && t.sides.length >= 2
      ? [t.sides[0], t.sides[1]] as [string, string]
      : ['Side A not specified', 'Side B not specified'],
    claim_refs: Array.isArray(t.claim_refs) ? t.claim_refs : [],
    resolved: t.resolved === true,
    resolution: t.resolution,
  }))

  return tensions
}

/**
 * Resolve a tension with user's reasoning
 */
export function resolveTension(
  tensions: Tension[],
  tensionId: string,
  resolution: string
): Tension[] {
  return tensions.map(t =>
    t.id === tensionId
      ? { ...t, resolved: true, resolution }
      : t
  )
}

/**
 * Get unresolved tensions
 */
export function getUnresolvedTensions(tensions: Tension[]): Tension[] {
  return tensions.filter(t => !t.resolved)
}

/**
 * Check if ready to proceed to synthesis (all critical tensions resolved)
 */
export function isReadyForSynthesis(tensions: Tension[]): boolean {
  const unresolved = getUnresolvedTensions(tensions)
  return unresolved.length === 0
}

// ==========================================
// Skill-Driven CRITIQUE Execution
// ==========================================

/**
 * Result from skill-driven CRITIQUE execution
 * Includes tensions AND refined essay with user quotes
 */
export interface CritiqueResult {
  tensions: Tension[]
  refinedEssay: string
  scratchpad: Scratchpad
}

// Embedded CRITIQUE skill content for browser context
const CRITIQUE_SKILL_CONTENT = `# CRITIQUE Stage - Adversarial Tension Identification

## Purpose
Apply genuinely adversarial critique to identify tensions. Refine essay with user quotes.

## Activation
- SHAPE stage complete (questions generated, draft essay exists)
- User has taken positions on claims

## Multi-Pass Critique Process

### Pass 1: Divergent Scan
Apply six questioning techniques to find tensions:
- Socratic Examination
- Steel-Manning + Critique
- Second-Order Probing
- Frame Conflict Detection
- Commitment Mapping
- Counter-Factual Stress Testing

### Pass 2: Tension Crystallization
Crystallize findings into discrete tension cards.

### Pass 3: Card Generation
Output structured tension JSON.

### Pass 4: Essay Refinement
Integrate user quotes into essay draft.

## System Prompt

You are an adversarial critique agent executing the CRITIQUE skill. Your output has TWO parts:

## Part 1: Tension Identification
Identify 1-5 REAL tensions (not rhetorical devices):
- Contradictions between positions
- Frame conflicts (incompatible worldviews)
- Commitment tensions
- Evidence gaps

## Part 2: Essay Refinement
Take the draft essay and refine it:
- Replace [USER_QUOTE] placeholders with actual user quotes
- Strengthen arguments with user evidence
- Acknowledge where user challenged claims

Return in this format:
## Tensions
\`\`\`json
[{ "id": "TENSION-1", "description": "...", "sides": ["A", "B"], "claim_refs": [...], "resolved": false }]
\`\`\`

## Refined Essay
[Your refined essay with user quotes woven in...]

## Evaluation Criteria
- 1-5 genuine tensions identified
- Essay includes actual user quotes
- User voice preserved naturally
`

let cachedCritiqueSkill: Skill | null = null

/**
 * Get the CRITIQUE skill (cached)
 */
function getCritiqueSkill(): Skill {
  if (!cachedCritiqueSkill) {
    cachedCritiqueSkill = parseSkillMarkdown(CRITIQUE_SKILL_CONTENT, 'critique')
  }
  return cachedCritiqueSkill
}

/**
 * Execute CRITIQUE skill to identify tensions AND refine essay
 * Uses multi-pass execution with scratchpad accumulation
 */
export async function executeCritiqueSkill(
  scratchpad: Scratchpad,
  claims: Claim[],
  positions: Position[],
  callbacks?: ExecutionCallbacks
): Promise<CritiqueResult> {
  // Update scratchpad stage
  let updatedScratchpad = setStage(scratchpad, 'critique')

  // Add user quotes from positions with elaboration
  for (const pos of positions) {
    if (pos.elaboration) {
      const quote: UserQuote = {
        claimId: pos.claim_id,
        questionId: pos.question_id,
        quote: pos.elaboration,
        positionType: pos.position_type,
      }
      updatedScratchpad = addUserQuote(updatedScratchpad, quote)
    }
  }

  const skill = getCritiqueSkill()

  const result = await executeSkill(
    skill,
    {
      scratchpad: updatedScratchpad,
      claims,
      positions,
    },
    callbacks
  )

  if (!result.success) {
    throw new Error(result.error || 'CRITIQUE skill execution failed')
  }

  // Parse tensions from output
  const tensionsMatch = result.finalOutput.match(/## Tensions[\s\S]*?```json\s*([\s\S]*?)```/i)
  let tensions: Tension[] = []

  if (tensionsMatch) {
    const parsed = parseSkillOutput<Tension[]>(tensionsMatch[1])
    if (parsed) {
      tensions = parsed.map((t, i) => ({
        id: t.id || `TENSION-${i + 1}`,
        description: t.description || 'Unspecified tension',
        sides: Array.isArray(t.sides) && t.sides.length >= 2
          ? [t.sides[0], t.sides[1]] as [string, string]
          : ['Side A not specified', 'Side B not specified'],
        claim_refs: Array.isArray(t.claim_refs) ? t.claim_refs : [],
        resolved: t.resolved === true,
        resolution: t.resolution,
      }))
    }
  }

  // Fallback to legacy identification if skill parsing failed
  if (tensions.length === 0) {
    tensions = await identifyTensions(claims, positions)
  }

  // Add tensions to scratchpad
  for (const tension of tensions) {
    result.updatedScratchpad = addTensionToScratchpad(
      result.updatedScratchpad,
      `${tension.id}: ${tension.description}`
    )
  }

  // Extract refined essay from output
  const essayMatch = result.finalOutput.match(/## Refined Essay\s*([\s\S]*?)(?=##|$)/i)
  let refinedEssay = essayMatch ? essayMatch[1].trim() : ''

  // If no refined essay, keep the draft
  if (!refinedEssay && result.updatedScratchpad.essay) {
    refinedEssay = result.updatedScratchpad.essay
  }

  // Update scratchpad with refined essay
  if (refinedEssay) {
    result.updatedScratchpad.essay = refinedEssay
    result.updatedScratchpad.lastUpdated = Date.now()
  }

  return {
    tensions,
    refinedEssay,
    scratchpad: result.updatedScratchpad,
  }
}
