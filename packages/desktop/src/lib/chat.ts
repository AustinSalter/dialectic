/**
 * Conversational mode - Send natural language prompts to Claude
 */

import { makeCompletionWithTools } from './claude'
import { tools, executeToolCall } from './tools'
import type { Claim } from './ingest'
import type { Position } from './interview'
import type { Tension } from './tensions'
import type { DraftThesis } from './draft'
import type { UserProfile } from './storage'

export interface ChatContext {
  currentSessionId?: string
  currentSessionTitle?: string
  claims: Claim[]
  positions: Position[]
  tensions: Tension[]
  draftThesis?: DraftThesis | null
  userProfile?: UserProfile | null
}

const SYSTEM_PROMPT = `You are a dialectic assistant helping the user refine their thinking about a source they've ingested.

## Current Flow
1. User ingested a source and claims were extracted
2. A DRAFT THESIS was generated from the claims
3. User is now having a conversation to challenge, refine, or redirect the thesis

## Your Role
- Challenge weak assumptions in the draft thesis
- Ask probing questions that force real position-taking
- Steel-man opposing views when relevant
- Help identify what evidence would change the thesis
- Push back on hedging and vague reasoning

## Conversational Style
- Be direct and intellectually honest
- Don't just agree - find the weak points
- When the user makes a claim, ask what would disprove it
- Reference specific @CLAIM-N tags when discussing evidence

## User Profile Integration
If a user profile is provided in the context, use it to:
1. Calibrate your challenge intensity to their preferences
2. Probe their known blind spots when discussing relevant topics
3. Build on their consistent positions rather than re-establishing basics
4. Reference their preferred analytical frameworks
5. Remember their thinking style and adapt your responses accordingly

When you notice new patterns in the user's reasoning (biases, consistent positions, preferred frameworks), mention them naturally. This helps build a richer understanding over time.

You have access to tools (read_file, write_file, search_files, list_files, web_fetch) if needed for research.

Current context (draft thesis, claims, positions, tensions, and user profile) will be provided with each message.`

function buildContextMessage(context: ChatContext): string {
  const parts: string[] = []

  if (context.currentSessionTitle) {
    parts.push(`**Current Session**: ${context.currentSessionTitle}`)
  }

  // Include user profile if present
  if (context.userProfile) {
    const profile = context.userProfile
    const profileParts: string[] = []

    if (profile.thinkingStyle.decisionApproach) {
      profileParts.push(`Thinking Approach: ${profile.thinkingStyle.decisionApproach}`)
    }
    if (profile.thinkingStyle.preferredFrameworks.length > 0) {
      profileParts.push(`Preferred Frameworks: ${profile.thinkingStyle.preferredFrameworks.join(', ')}`)
    }
    if (profile.thinkingStyle.biasPatterns.length > 0) {
      profileParts.push(`Known Biases to Probe: ${profile.thinkingStyle.biasPatterns.join(', ')}`)
    }
    if (profile.observedPatterns.consistentPositions.length > 0) {
      profileParts.push(`Consistent Positions: ${profile.observedPatterns.consistentPositions.join(', ')}`)
    }
    if (profile.observedPatterns.blindSpots.length > 0) {
      profileParts.push(`Blind Spots to Challenge: ${profile.observedPatterns.blindSpots.join(', ')}`)
    }
    if (profile.communicationStyle.preferredChallengeIntensity) {
      profileParts.push(`Challenge Intensity: ${profile.communicationStyle.preferredChallengeIntensity}`)
    }
    // Include recent notes (last 3)
    const recentNotes = profile.notes.slice(-3)
    if (recentNotes.length > 0) {
      profileParts.push(`Recent Observations:`)
      recentNotes.forEach(n => profileParts.push(`  - ${n.content} (${n.source})`))
    }

    if (profileParts.length > 0) {
      parts.push(`\n**User Profile**:`)
      profileParts.forEach(p => parts.push(p))
    }
  }

  // Include draft thesis if present
  if (context.draftThesis) {
    parts.push(`\n**Draft Thesis**:`)
    parts.push(`Core Belief: ${context.draftThesis.coreBelief}`)
    parts.push(`Confidence: ${Math.round(context.draftThesis.initialConfidence * 100)}%`)
    if (context.draftThesis.keyEvidence.length > 0) {
      parts.push(`Key Evidence:`)
      context.draftThesis.keyEvidence.forEach(e => parts.push(`  - ${e}`))
    }
    if (context.draftThesis.questionsToExplore.length > 0) {
      parts.push(`Questions to Explore:`)
      context.draftThesis.questionsToExplore.forEach(q => parts.push(`  - ${q}`))
    }
  }

  if (context.claims.length > 0) {
    parts.push(`\n**Claims Extracted** (${context.claims.length}):`)
    context.claims.slice(0, 5).forEach(claim => {
      parts.push(`- @${claim.id}: ${claim.text}`)
    })
    if (context.claims.length > 5) {
      parts.push(`  ...and ${context.claims.length - 5} more`)
    }
  }

  if (context.positions.length > 0) {
    parts.push(`\n**Positions Taken** (${context.positions.length}):`)
    context.positions.slice(0, 5).forEach(pos => {
      parts.push(`- Claim ${pos.claim_id}: ${pos.position_type}${pos.elaboration ? ` - "${pos.elaboration.slice(0, 50)}..."` : ''}`)
    })
    if (context.positions.length > 5) {
      parts.push(`  ...and ${context.positions.length - 5} more`)
    }
  }

  if (context.tensions.length > 0) {
    parts.push(`\n**Tensions Identified** (${context.tensions.length}):`)
    context.tensions.forEach(tension => {
      const status = tension.resolved ? '[resolved]' : '[unresolved]'
      parts.push(`- ${tension.id} ${status}: ${tension.description}`)
    })
  }

  return parts.length > 0 ? `---\n${parts.join('\n')}\n---\n\n` : ''
}

/**
 * Send a message to Claude with context and tools
 * Returns streamed response chunks via onChunk callback
 */
export async function sendMessage(
  message: string,
  context: ChatContext,
  onChunk: (text: string) => void
): Promise<string> {
  const contextPrefix = buildContextMessage(context)
  const userPrompt = contextPrefix + message

  return makeCompletionWithTools(
    SYSTEM_PROMPT,
    userPrompt,
    tools,
    async (toolName, toolInput) => {
      return executeToolCall(toolName, toolInput)
    },
    onChunk
  )
}
