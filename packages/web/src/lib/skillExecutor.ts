/**
 * Skill Executor - Execute multi-pass skills with scratchpad accumulation
 *
 * Implements sequential Claude calls where each pass builds on accumulated context.
 * Extracts semantic markers and updates scratchpad between passes.
 */

import { makeCompletion, makeStreamingCompletion } from './claude'
import type { Skill, PassDefinition } from './skillLoader'
import type { Scratchpad } from './scratchpad'
import {
  extractAndMerge,
  incrementCycle,
  renderForSkillPrompt,
  SEMANTIC_MARKERS,
} from './scratchpad'
import type { Claim } from './ingest'
import type { Position } from './interview'

export interface ExecutionContext {
  scratchpad: Scratchpad
  claims: Claim[]
  positions: Position[]
  sourceText?: string
  sourceTitle?: string
}

export interface MarkedContent {
  type: keyof typeof SEMANTIC_MARKERS
  content: string
}

export interface PassResult {
  passNumber: number
  passName: string
  output: string
  markers: MarkedContent[]
  essayDraft?: string
  tokensUsed?: number
}

export interface SkillResult {
  success: boolean
  passes: PassResult[]
  finalOutput: string
  updatedScratchpad: Scratchpad
  error?: string
}

export interface ExecutionCallbacks {
  onPassStart?: (passNumber: number, passName: string) => void
  onPassComplete?: (result: PassResult) => void
  onChunk?: (text: string) => void
  onError?: (error: string) => void
}

/**
 * Extract marked content from text using semantic markers
 */
export function extractMarkers(text: string): MarkedContent[] {
  const markers: MarkedContent[] = []

  for (const [markerType, regex] of Object.entries(SEMANTIC_MARKERS)) {
    const matches = text.matchAll(new RegExp(regex))
    for (const match of matches) {
      const content = match[1]?.trim()
      if (content) {
        markers.push({
          type: markerType as keyof typeof SEMANTIC_MARKERS,
          content,
        })
      }
    }
  }

  return markers
}

/**
 * Extract essay draft from output if present
 * Looks for ## Essay or similar markers
 */
function extractEssayFromOutput(output: string): string | undefined {
  // Look for essay section in output
  const essayPatterns = [
    /## Essay\s*\n([\s\S]*?)(?=##|$)/i,
    /## Draft\s*\n([\s\S]*?)(?=##|$)/i,
    /\[ESSAY\]([\s\S]*?)(?=\[|$)/i,
    /---\s*essay\s*---\s*\n([\s\S]*?)(?=---|$)/i,
  ]

  for (const pattern of essayPatterns) {
    const match = output.match(pattern)
    if (match && match[1]?.trim()) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Build the user prompt for a skill pass
 */
function buildPassPrompt(
  skill: Skill,
  pass: PassDefinition,
  context: ExecutionContext,
  previousOutputs: string[]
): string {
  const parts: string[] = []

  // Add scratchpad context
  const scratchpadContext = renderForSkillPrompt(context.scratchpad)
  if (scratchpadContext) {
    parts.push(scratchpadContext)
  }

  // Add source material for GATHER stage
  if (skill.stage === 'gather' && context.sourceText) {
    parts.push('\n## Source Material')
    if (context.sourceTitle) {
      parts.push(`Title: ${context.sourceTitle}`)
    }
    parts.push('```')
    // Truncate if too long
    const maxLength = 15000
    const text = context.sourceText.length > maxLength
      ? context.sourceText.slice(0, maxLength) + '\n\n[Truncated...]'
      : context.sourceText
    parts.push(text)
    parts.push('```')
  }

  // Add claims for SHAPE/CRITIQUE/SYNTHESIZE stages
  if (context.claims.length > 0 && skill.stage !== 'gather') {
    parts.push('\n## Extracted Claims')
    context.claims.forEach(claim => {
      parts.push(`@${claim.id}: ${claim.text} (${claim.type})`)
      if (claim.snippet) {
        parts.push(`  Quote: "${claim.snippet.slice(0, 200)}..."`)
      }
    })
  }

  // Add positions for CRITIQUE/SYNTHESIZE stages
  if (context.positions.length > 0 && (skill.stage === 'critique' || skill.stage === 'synthesize')) {
    parts.push('\n## User Positions')
    context.positions.forEach(pos => {
      const claim = context.claims.find(c => c.id === pos.claim_id)
      const claimText = claim ? ` - "${claim.text.slice(0, 100)}..."` : ''
      parts.push(`- On ${pos.claim_id} (${pos.position_type}): ${pos.selected_option}${claimText}`)
      if (pos.elaboration) {
        parts.push(`  User said: "${pos.elaboration}"`)
      }
    })
  }

  // Add previous pass outputs for context
  if (previousOutputs.length > 0) {
    parts.push('\n## Previous Pass Results')
    previousOutputs.forEach((output, i) => {
      parts.push(`### Pass ${i + 1} Output`)
      // Summarize if too long
      const maxOutput = 2000
      parts.push(output.length > maxOutput
        ? output.slice(0, maxOutput) + '\n[...]'
        : output
      )
    })
  }

  // Add pass-specific instruction
  parts.push(`\n## Current Task: ${pass.name}`)
  parts.push(pass.purpose)

  // Add expected markers
  if (pass.markers.length > 0) {
    parts.push(`\nUse these semantic markers in your response:`)
    pass.markers.forEach(m => parts.push(`- [${m}] for ${m.toLowerCase()} content`))
  }

  return parts.join('\n')
}

/**
 * Execute a single pass of a skill
 */
async function executePass(
  skill: Skill,
  pass: PassDefinition,
  context: ExecutionContext,
  previousOutputs: string[],
  callbacks?: ExecutionCallbacks
): Promise<PassResult> {
  callbacks?.onPassStart?.(pass.number, pass.name)

  const systemPrompt = skill.systemPrompt || `You are a dialectic analysis assistant executing the ${skill.name} skill. Follow the pass instructions carefully.`
  const userPrompt = buildPassPrompt(skill, pass, context, previousOutputs)

  let output: string

  if (callbacks?.onChunk) {
    output = await makeStreamingCompletion(
      systemPrompt,
      userPrompt,
      callbacks.onChunk
    )
  } else {
    output = await makeCompletion(systemPrompt, userPrompt)
  }

  const markers = extractMarkers(output)
  const essayDraft = extractEssayFromOutput(output)

  const result: PassResult = {
    passNumber: pass.number,
    passName: pass.name,
    output,
    markers,
    essayDraft,
    // Rough token estimate
    tokensUsed: Math.ceil((systemPrompt.length + userPrompt.length + output.length) / 4),
  }

  callbacks?.onPassComplete?.(result)

  return result
}

/**
 * Execute a complete skill with all its passes
 */
export async function executeSkill(
  skill: Skill,
  context: ExecutionContext,
  callbacks?: ExecutionCallbacks
): Promise<SkillResult> {
  const passResults: PassResult[] = []
  let scratchpad = context.scratchpad
  const previousOutputs: string[] = []

  try {
    // Execute each pass sequentially
    for (const pass of skill.passes) {
      const result = await executePass(
        skill,
        pass,
        { ...context, scratchpad },
        previousOutputs,
        callbacks
      )

      passResults.push(result)
      previousOutputs.push(result.output)

      // Update scratchpad with markers from this pass
      scratchpad = extractAndMerge(scratchpad, result.output)

      // Update essay if this pass produced one
      if (result.essayDraft) {
        scratchpad = {
          ...scratchpad,
          essay: result.essayDraft,
          lastUpdated: Date.now(),
        }
      }
    }

    // Increment cycle count
    scratchpad = incrementCycle(scratchpad)

    // Get final output (last pass result)
    const finalOutput = passResults.length > 0
      ? passResults[passResults.length - 1].output
      : ''

    return {
      success: true,
      passes: passResults,
      finalOutput,
      updatedScratchpad: scratchpad,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    callbacks?.onError?.(errorMessage)

    return {
      success: false,
      passes: passResults,
      finalOutput: '',
      updatedScratchpad: scratchpad,
      error: errorMessage,
    }
  }
}

/**
 * Execute a skill with a custom single-pass prompt
 * Useful for ad-hoc operations that don't need full multi-pass
 */
export async function executeSinglePass(
  systemPrompt: string,
  userPrompt: string,
  scratchpad: Scratchpad,
  callbacks?: ExecutionCallbacks
): Promise<{ output: string; updatedScratchpad: Scratchpad }> {
  let output: string

  if (callbacks?.onChunk) {
    output = await makeStreamingCompletion(systemPrompt, userPrompt, callbacks.onChunk)
  } else {
    output = await makeCompletion(systemPrompt, userPrompt)
  }

  const updatedScratchpad = extractAndMerge(scratchpad, output)

  return { output, updatedScratchpad }
}

/**
 * Parse JSON from skill output, handling markdown code fences
 */
export function parseSkillOutput<T>(output: string): T | null {
  // Try to extract JSON from markdown code fence
  const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : output.trim()

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    // Try to find JSON array or object directly
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/)

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T
      } catch {
        return null
      }
    }

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T
      } catch {
        return null
      }
    }

    return null
  }
}

/**
 * Calculate confidence from skill output markers
 */
export function calculateConfidenceFromMarkers(markers: MarkedContent[]): number {
  // Base confidence
  let confidence = 0.5

  // Positive markers increase confidence
  const positiveMarkers = ['INSIGHT', 'EVIDENCE', 'PATTERN']
  const negativeMarkers = ['RISK', 'COUNTER', 'QUESTION']

  const positiveCount = markers.filter(m => positiveMarkers.includes(m.type)).length
  const negativeCount = markers.filter(m => negativeMarkers.includes(m.type)).length

  // Adjust confidence based on marker balance
  // More positive = higher confidence, but negatives temper it
  const total = positiveCount + negativeCount
  if (total > 0) {
    const ratio = positiveCount / total
    // Scale from 0.3 to 0.8 based on ratio
    confidence = 0.3 + (ratio * 0.5)
  }

  // Having both positive and negative markers (dialectic tension) is actually good
  // It means we've explored the space - slight boost
  if (positiveCount > 0 && negativeCount > 0) {
    confidence = Math.min(0.85, confidence + 0.05)
  }

  return confidence
}
