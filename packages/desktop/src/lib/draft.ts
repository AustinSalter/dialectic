/**
 * Draft thesis generation from extracted claims
 * Generates an initial thesis immediately after ingest, before interview
 */

import { makeCompletion } from './claude'
import type { Claim } from './ingest'

export interface DraftThesis {
  coreBelief: string
  keyEvidence: string[]
  initialConfidence: number
  questionsToExplore: string[]
}

/**
 * Generate a draft thesis from extracted claims
 * This provides an immediate synthesis that the user can then refine through conversation
 */
export async function generateDraftThesis(claims: Claim[]): Promise<DraftThesis> {
  if (claims.length === 0) {
    return {
      coreBelief: 'No claims extracted from source.',
      keyEvidence: [],
      initialConfidence: 0,
      questionsToExplore: ['Re-ingest source or try a different URL'],
    }
  }

  const claimList = claims
    .map((c) => `@${c.id} [${c.type}]: ${c.text}\n  Quote: "${c.snippet}"`)
    .join('\n\n')

  const systemPrompt = `You are a thesis synthesis assistant. Your task is to generate a DRAFT thesis from extracted claims.

## Your Goal
Create an initial thesis that captures the core argument of the source material. This is a starting point for dialectic refinement, not a final position.

## Output Format
Return ONLY valid JSON. No markdown, no explanation.

## JSON Schema
{
  "coreBelief": "One crisp sentence stating the central thesis of the source. Be direct and specific.",
  "keyEvidence": [
    "Most important evidence point supporting this thesis",
    "Second key evidence point",
    "Third key evidence point (if applicable)"
  ],
  "initialConfidence": 0.XX,
  "questionsToExplore": [
    "What aspect of this thesis deserves scrutiny?",
    "What assumption might be wrong?",
    "What would change if [specific condition]?"
  ]
}

## Confidence Scoring
- 0.70+: Claims are internally consistent, evidence is concrete, thesis is testable
- 0.50-0.69: Interesting hypothesis, some gaps or tensions to resolve
- <0.50: Speculative or contradictory claims, needs significant refinement

## Quality Guidelines

**Core Belief**:
- Should be the author's main argument, not a summary
- Make it specific and falsifiable
- Avoid hedging language like "might" or "could potentially"

**Key Evidence**:
- Reference specific claims with @CLAIM-N
- Focus on the 2-4 strongest supporting points
- Include the most concrete evidence first

**Questions to Explore**:
- Ask about the weakest assumptions
- Challenge the most confident claims
- Ask about implications and second-order effects
- These should guide the conversation, not be rhetorical`

  const userPrompt = `# Extracted Claims

${claimList}

Generate a draft thesis that captures the author's core argument. Include the strongest evidence and the most important questions to explore.`

  const response = await makeCompletion(systemPrompt, userPrompt, {
    maxTokens: 1500,
  })

  let draft: DraftThesis
  try {
    const jsonStr = response.replace(/```json?\s*|\s*```/g, '').trim()
    draft = JSON.parse(jsonStr)
  } catch (e) {
    console.error('Failed to parse draft thesis JSON:', response)
    throw new Error('Failed to parse draft thesis response')
  }

  // Validate and normalize
  return {
    coreBelief: draft.coreBelief || 'Draft generation failed',
    keyEvidence: Array.isArray(draft.keyEvidence) ? draft.keyEvidence : [],
    initialConfidence: Math.max(0, Math.min(1, draft.initialConfidence || 0.5)),
    questionsToExplore: Array.isArray(draft.questionsToExplore) ? draft.questionsToExplore : [],
  }
}

/**
 * Format draft thesis as markdown for display
 */
export function formatDraftThesis(draft: DraftThesis, title: string): string {
  const confidencePercent = Math.round(draft.initialConfidence * 100)

  return `# Draft Thesis: ${title}

## Core Belief

${draft.coreBelief}

## Key Evidence

${draft.keyEvidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}

## Initial Confidence: ${confidencePercent}%

This is a preliminary synthesis. The confidence score reflects how well the claims hang together, not your endorsement.

## Questions to Explore

${draft.questionsToExplore.map(q => `- ${q}`).join('\n')}

---

*Type \`analyze\` to run multi-pass reasoning on these claims, or challenge this thesis through conversation.*`
}
