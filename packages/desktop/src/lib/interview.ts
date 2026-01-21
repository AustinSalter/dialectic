/**
 * Interview question generation for dialectic flow
 * Generates probing questions that force user to take positions on claims
 *
 * Now supports skill-driven execution with scratchpad accumulation.
 */

import { makeCompletion } from './claude'
import { parseSkillMarkdown, type Skill } from './skillLoader'
import { executeSkill, parseSkillOutput, type ExecutionCallbacks } from './skillExecutor'
import {
  createScratchpad,
  setStage,
  addClaims,
  type Scratchpad,
} from './scratchpad'
import type { Claim } from './ingest'

export interface QuestionOption {
  label: string
  description?: string
}

export interface Question {
  id: string
  text: string
  claim_ref: string
  options: QuestionOption[]
}

export interface Position {
  claim_id: string
  question_id: string
  position_type: 'confirms' | 'challenges' | 'nuances'
  selected_option: number
  elaboration?: string
}

/**
 * Generate probing questions from extracted claims
 * Creates 2-4 questions per source, each referencing a specific claim
 */
export async function generateQuestions(claims: Claim[]): Promise<Question[]> {
  if (claims.length === 0) {
    return []
  }

  const claimList = claims
    .map((c) => `@${c.id} [${c.type}]: ${c.text}\n  Quote: "${c.snippet}"`)
    .join('\n\n')

  const systemPrompt = `You are a dialectic challenger. Your task is to generate PROVOCATIVE questions that force the user to take uncomfortable positions and confront the weakest points of the source's argument.

## Output Format
Return ONLY valid JSON array. No markdown, no explanation.

## Question Philosophy
You are NOT a neutral interviewer. You are a Socratic gadfly. Your questions should:
1. Attack the most confident claims - where is the author overreaching?
2. Steel-man the opposing view - what would a smart skeptic say?
3. Expose hidden assumptions - what must be true for this to hold?
4. Force action implications - if you believe this, what do you DO?
5. Create cognitive dissonance - find where two claims conflict

## Question Templates (use as inspiration, not literally)
- "If @CLAIM-N is true, what does that mean for [specific real-world decision]?"
- "The author claims X. But what if the OPPOSITE were true? What would you do differently?"
- "@CLAIM-N assumes [hidden assumption]. Do you buy that, or is it the weak link?"
- "A smart skeptic would say [steel-man counter]. How do you respond?"
- "@CLAIM-N and @CLAIM-M seem to pull in different directions. Which wins?"
- "If you're wrong about @CLAIM-N, what's the cost of that error?"

## Option Design
Options should represent REAL positions people hold, not strawmen:
- "This is the key insight - I'm building my thesis around it"
- "Directionally right but overstated - adjust for X"
- "Author is missing something crucial here"
- "I actually disagree - here's why the opposite is more likely"
- "Need more evidence before taking a position"

## JSON Schema
[
  {
    "id": "Q1",
    "text": "Provocative question referencing @CLAIM-N",
    "claim_ref": "CLAIM-1",
    "options": [
      { "label": "Strong position", "description": "What believing this implies" },
      { "label": "Nuanced take" },
      { "label": "Counter-position", "description": "The steel-man opposite view" }
    ]
  }
]

CRITICAL:
- claim_ref must match an existing claim ID exactly
- Questions should be UNCOMFORTABLE, not softball
- At least one option should represent genuine disagreement
- "Other" is implicit - don't include it
- Generate 2-4 questions targeting the most contentious or assumption-heavy claims`

  const userPrompt = `# Extracted Claims

${claimList}

Generate 2-4 CHALLENGING questions that will expose where the user really stands. Target the claims that seem most confident, most assumption-heavy, or most likely to create cognitive dissonance. Make the user uncomfortable - that's where real thinking happens.`

  const response = await makeCompletion(systemPrompt, userPrompt, {
    maxTokens: 2048,
  })

  let questions: Question[]
  try {
    const jsonStr = response.replace(/```json?\s*|\s*```/g, '').trim()
    questions = JSON.parse(jsonStr)
  } catch (e) {
    console.error('Failed to parse questions JSON:', response)
    throw new Error('Failed to parse question generation response')
  }

  // Validate claim references exist
  const claimIds = new Set(claims.map(c => c.id))
  questions = questions.filter(q => {
    if (!claimIds.has(q.claim_ref)) {
      console.warn(`Question ${q.id} references non-existent claim ${q.claim_ref}`)
      return false
    }
    return true
  })

  // Ensure unique IDs
  questions = questions.map((q, i) => ({
    ...q,
    id: q.id || `Q${i + 1}`,
  }))

  return questions
}

/**
 * Classify user response into position type based on selected option
 * This is a heuristic - can be refined with Claude call if needed
 */
export function classifyPosition(
  question: Question,
  selectedOptionIndex: number,
  _freeText?: string
): Position['position_type'] {
  const option = question.options[selectedOptionIndex]
  if (!option) return 'nuances'

  const label = option.label.toLowerCase()

  // Simple heuristics for classification
  if (label.includes('strong') || label.includes('agree') || label.includes('act now') || label.includes('high conviction')) {
    return 'confirms'
  }
  if (label.includes('disagree') || label.includes('noise') || label.includes('ignore') || label.includes('skeptical')) {
    return 'challenges'
  }
  return 'nuances'
}

/**
 * Create a position record from user response
 */
export function createPosition(
  question: Question,
  selectedOptionIndex: number,
  freeText?: string
): Position {
  return {
    claim_id: question.claim_ref,
    question_id: question.id,
    position_type: classifyPosition(question, selectedOptionIndex, freeText),
    selected_option: selectedOptionIndex,
    elaboration: freeText,
  }
}

// ==========================================
// Skill-Driven Interview Generation
// ==========================================

/**
 * Result from skill-driven SHAPE execution
 * Includes both questions AND draft essay (per plan)
 */
export interface ShapeResult {
  questions: Question[]
  draftEssay: string
  scratchpad: Scratchpad
}

// Embedded SHAPE skill content for browser context
// In production, this could be fetched or bundled at build time
const SHAPE_SKILL_CONTENT = `# SHAPE Stage - Dialectic Interview

## Purpose
Generate probing questions that force the user to take a strategic position on extracted claims. Generate a first-draft essay from claims.

## Activation
- GATHER stage complete (claims extracted)
- Session transitions to "exploring" state

## Multi-Pass Generation

### Pass 1: Claim Prioritization
Rank claims by interview value:
1. Core thesis claims (must address)
2. Counter claims (surface tensions)
3. Framework claims (establish lens)

### Pass 2: Question Formulation
For each selected claim, generate provocative questions with substantive options.

### Pass 3: Draft Essay
Generate rough essay (500-800 words) with [USER_QUOTE] placeholders.

## System Prompt

You are a dialectic challenger executing the SHAPE skill. Your output has TWO parts:

## Part 1: Interview Questions
Generate 2-4 CHALLENGING questions that expose where the user really stands.
- Questions must reference @CLAIM-N
- Options represent real positions, not strawmen
- At least one option should challenge the claim

## Part 2: Draft Essay
Write a rough 500-800 word essay that:
- Opens with core tension from the source
- Weaves in @CLAIM-N references as evidence
- Marks [USER_QUOTE: on @CLAIM-N] where user voice will go
- Ends with open questions

Return in this format:
## Interview Questions
\`\`\`json
[{ "id": "Q1", "text": "...", "claim_ref": "CLAIM-1", "options": [...] }]
\`\`\`

## Essay
[Your draft essay here...]

## Evaluation Criteria
- 2-4 questions generated
- Each question has 3-5 substantive options
- Essay is 500-800 words with [USER_QUOTE] placeholders
`

let cachedShapeSkill: Skill | null = null

/**
 * Get the SHAPE skill (cached)
 */
function getShapeSkill(): Skill {
  if (!cachedShapeSkill) {
    cachedShapeSkill = parseSkillMarkdown(SHAPE_SKILL_CONTENT, 'shape')
  }
  return cachedShapeSkill
}

/**
 * Execute SHAPE skill to generate questions AND draft essay
 * Uses multi-pass execution with scratchpad accumulation
 */
export async function executeShapeSkill(
  sessionId: string,
  sessionTitle: string,
  claims: Claim[],
  callbacks?: ExecutionCallbacks
): Promise<ShapeResult> {
  // Create scratchpad with claims
  let scratchpad = createScratchpad(sessionId, sessionTitle)
  scratchpad = setStage(scratchpad, 'shape')
  scratchpad = addClaims(scratchpad, claims.map(c => `@${c.id} [${c.type}]: ${c.text}`))

  const skill = getShapeSkill()

  const result = await executeSkill(
    skill,
    {
      scratchpad,
      claims,
      positions: [],
    },
    callbacks
  )

  if (!result.success) {
    throw new Error(result.error || 'SHAPE skill execution failed')
  }

  // Parse questions from output
  const questionsMatch = result.finalOutput.match(/## Interview Questions[\s\S]*?```json\s*([\s\S]*?)```/i)
  let questions: Question[] = []

  if (questionsMatch) {
    const parsed = parseSkillOutput<Question[]>(questionsMatch[1])
    if (parsed) {
      questions = parsed
    }
  }

  // Fallback to legacy generation if skill parsing failed
  if (questions.length === 0) {
    questions = await generateQuestions(claims)
  }

  // Validate claim references
  const claimIds = new Set(claims.map(c => c.id))
  questions = questions.filter(q => claimIds.has(q.claim_ref))

  // Extract essay from output
  const essayMatch = result.finalOutput.match(/## Essay\s*([\s\S]*?)(?=##|$)/i)
  const draftEssay = essayMatch ? essayMatch[1].trim() : ''

  // Update scratchpad with essay
  if (draftEssay) {
    result.updatedScratchpad.essay = draftEssay
    result.updatedScratchpad.lastUpdated = Date.now()
  }

  return {
    questions,
    draftEssay,
    scratchpad: result.updatedScratchpad,
  }
}

/**
 * Capture user quote from position response
 * Returns position with elaboration that can be woven into essay
 */
export function captureUserQuote(
  question: Question,
  selectedOptionIndex: number,
  freeText: string
): Position & { quote: string } {
  const position = createPosition(question, selectedOptionIndex, freeText)

  // The quote is the user's elaboration text
  const quote = freeText.trim()

  return {
    ...position,
    quote,
  }
}
