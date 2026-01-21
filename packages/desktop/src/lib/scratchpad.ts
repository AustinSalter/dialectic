/**
 * Scratchpad - Running context document for accumulated state
 *
 * Implements anchored iterative compression from EXP-009:
 * - Structured sections that persist across passes
 * - Merge strategies for iterative updates
 * - Size limits with intelligent compression
 */

export interface ScratchpadSection {
  id: string
  type: 'insights' | 'evidence' | 'risks' | 'counters' | 'questions' | 'patterns' | 'decisions' | 'meta' | 'claims' | 'tensions'
  content: string[]
  lastUpdated: number
  preserved: boolean // If true, won't be compressed away
}

export interface UserQuote {
  claimId: string
  questionId: string
  quote: string
  positionType: 'confirms' | 'challenges' | 'nuances'
}

export type WorkflowStage = 'gather' | 'shape' | 'critique' | 'synthesize'

export interface Scratchpad {
  sessionId: string
  title: string
  sections: ScratchpadSection[]
  confidenceHistory: number[]
  currentConfidence: number
  cycleCount: number
  tokenEstimate: number
  created: number
  lastUpdated: number
  // New fields for skill-driven workflow
  currentStage: WorkflowStage
  essay: string  // Evolving prose draft
  userQuotes: UserQuote[]  // Captured interview responses
}

// Token budget for scratchpad (leave room for prompts and response)
const MAX_SCRATCHPAD_TOKENS = 8000

// Semantic marker patterns from EXP-003/EXP-008 (validated 3x insight density)
export const SEMANTIC_MARKERS = {
  INSIGHT: /\[INSIGHT\]([^[]*?)(?=\[|$)/gi,
  EVIDENCE: /\[EVIDENCE\]([^[]*?)(?=\[|$)/gi,
  RISK: /\[RISK\]([^[]*?)(?=\[|$)/gi,
  COUNTER: /\[COUNTER\]([^[]*?)(?=\[|$)/gi,
  PATTERN: /\[PATTERN\]([^[]*?)(?=\[|$)/gi,
  QUESTION: /\[QUESTION\]([^[]*?)(?=\[|$)/gi,
  DECISION: /\[DECISION\]([^[]*?)(?=\[|$)/gi,
  META: /\[META\]([^[]*?)(?=\[|$)/gi,
} as const

type MarkerType = keyof typeof SEMANTIC_MARKERS

const MARKER_TO_SECTION: Record<MarkerType, ScratchpadSection['type']> = {
  INSIGHT: 'insights',
  EVIDENCE: 'evidence',
  RISK: 'risks',
  COUNTER: 'counters',
  PATTERN: 'patterns',
  QUESTION: 'questions',
  DECISION: 'decisions',
  META: 'meta',
}

/**
 * Create a new scratchpad
 */
export function createScratchpad(sessionId: string, title: string): Scratchpad {
  return {
    sessionId,
    title,
    sections: [
      { id: 'claims', type: 'claims', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'insights', type: 'insights', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'evidence', type: 'evidence', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'risks', type: 'risks', content: [], lastUpdated: Date.now(), preserved: false },
      { id: 'counters', type: 'counters', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'questions', type: 'questions', content: [], lastUpdated: Date.now(), preserved: false },
      { id: 'patterns', type: 'patterns', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'decisions', type: 'decisions', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'tensions', type: 'tensions', content: [], lastUpdated: Date.now(), preserved: true },
      { id: 'meta', type: 'meta', content: [], lastUpdated: Date.now(), preserved: false },
    ],
    confidenceHistory: [],
    currentConfidence: 0.5,
    cycleCount: 0,
    tokenEstimate: 0,
    created: Date.now(),
    lastUpdated: Date.now(),
    currentStage: 'gather',
    essay: '',
    userQuotes: [],
  }
}

/**
 * Extract marked content from expansion output and merge into scratchpad
 */
export function extractAndMerge(scratchpad: Scratchpad, expansionText: string): Scratchpad {
  const updated = { ...scratchpad, sections: [...scratchpad.sections] }
  const now = Date.now()

  // Extract content for each marker type
  for (const [marker, regex] of Object.entries(SEMANTIC_MARKERS)) {
    const sectionType = MARKER_TO_SECTION[marker as MarkerType]
    const sectionIndex = updated.sections.findIndex(s => s.type === sectionType)
    if (sectionIndex === -1) continue

    const section = { ...updated.sections[sectionIndex] }
    const matches = expansionText.matchAll(new RegExp(regex))

    for (const match of matches) {
      const content = match[1].trim()
      if (content && !section.content.includes(content)) {
        section.content = [...section.content, content]
        section.lastUpdated = now
      }
    }

    updated.sections[sectionIndex] = section
  }

  // Update token estimate
  updated.tokenEstimate = estimateTokens(updated)
  updated.lastUpdated = now

  // Compress if needed
  if (updated.tokenEstimate > MAX_SCRATCHPAD_TOKENS) {
    return compressScratchpad(updated)
  }

  return updated
}

/**
 * Update confidence and track trajectory
 */
export function updateConfidence(scratchpad: Scratchpad, newConfidence: number): Scratchpad {
  return {
    ...scratchpad,
    confidenceHistory: [...scratchpad.confidenceHistory, scratchpad.currentConfidence],
    currentConfidence: Math.max(0, Math.min(1, newConfidence)),
    lastUpdated: Date.now(),
  }
}

/**
 * Increment cycle count
 */
export function incrementCycle(scratchpad: Scratchpad): Scratchpad {
  return {
    ...scratchpad,
    cycleCount: scratchpad.cycleCount + 1,
    lastUpdated: Date.now(),
  }
}

/**
 * Compress scratchpad when it exceeds token budget
 * Uses anchored iterative compression - preserves key sections, compresses others
 */
function compressScratchpad(scratchpad: Scratchpad): Scratchpad {
  const updated = { ...scratchpad, sections: [...scratchpad.sections] }

  // Sort sections by priority (preserved first) and recency
  const sortedSections = updated.sections
    .map((s, i) => ({ section: s, index: i }))
    .sort((a, b) => {
      if (a.section.preserved !== b.section.preserved) {
        return a.section.preserved ? -1 : 1
      }
      return b.section.lastUpdated - a.section.lastUpdated
    })

  // Compress non-preserved sections first, keeping most recent items
  for (const { section, index } of sortedSections) {
    if (section.preserved) continue
    if (section.content.length > 5) {
      const compressed = { ...section }
      compressed.content = section.content.slice(-5) // Keep 5 most recent
      updated.sections[index] = compressed
    }
  }

  // If still over budget, compress preserved sections too
  updated.tokenEstimate = estimateTokens(updated)
  if (updated.tokenEstimate > MAX_SCRATCHPAD_TOKENS) {
    for (const { section, index } of sortedSections) {
      if (!section.preserved) continue
      if (section.content.length > 10) {
        const compressed = { ...section }
        compressed.content = section.content.slice(-10) // Keep 10 most recent
        updated.sections[index] = compressed
      }
    }
  }

  updated.tokenEstimate = estimateTokens(updated)
  return updated
}

/**
 * Estimate token count (rough: 4 chars per token)
 */
function estimateTokens(scratchpad: Scratchpad): number {
  const contentLength = scratchpad.sections
    .flatMap(s => s.content)
    .join(' ')
    .length
  return Math.ceil(contentLength / 4)
}

/**
 * Render scratchpad as context for prompts
 */
export function renderScratchpad(scratchpad: Scratchpad): string {
  const sections: string[] = []

  sections.push(`# Analysis Scratchpad: ${scratchpad.title}`)
  sections.push(`Cycle: ${scratchpad.cycleCount} | Confidence: ${(scratchpad.currentConfidence * 100).toFixed(0)}%`)

  // Confidence trajectory (from EXP-004 - non-monotonic reveals genuine exploration)
  if (scratchpad.confidenceHistory.length > 0) {
    const trajectory = [...scratchpad.confidenceHistory, scratchpad.currentConfidence]
      .map(c => (c * 100).toFixed(0) + '%')
      .join(' → ')
    sections.push(`Trajectory: ${trajectory}`)
  }

  sections.push('')

  // Render each section with content
  for (const section of scratchpad.sections) {
    if (section.content.length === 0) continue

    const header = section.type.toUpperCase()
    const items = section.content.map(c => `• ${c}`).join('\n')
    sections.push(`## ${header}\n${items}`)
  }

  return sections.join('\n\n')
}

/**
 * Check termination criteria (from EXP-010)
 * Returns reason if should terminate, null otherwise
 */
export function checkTermination(scratchpad: Scratchpad, maxCycles: number = 5): string | null {
  // Hard limit
  if (scratchpad.cycleCount >= maxCycles) {
    return `max_cycles_reached (${maxCycles})`
  }

  // Need at least 2 cycles to evaluate trends
  if (scratchpad.cycleCount < 2) {
    return null
  }

  const history = [...scratchpad.confidenceHistory, scratchpad.currentConfidence]

  // Saturation: delta_confidence < 0.05 for 2 cycles
  if (history.length >= 3) {
    const recent = history.slice(-3)
    const delta1 = Math.abs(recent[1] - recent[0])
    const delta2 = Math.abs(recent[2] - recent[1])
    if (delta1 < 0.05 && delta2 < 0.05) {
      return 'confidence_saturated'
    }
  }

  // High confidence with resolved tensions
  if (scratchpad.currentConfidence >= 0.75) {
    const unresolvedQuestions = scratchpad.sections
      .find(s => s.type === 'questions')
      ?.content.length || 0
    if (unresolvedQuestions < 2) {
      return 'high_confidence_stable'
    }
  }

  return null
}

/**
 * Get confidence trajectory analysis
 * Non-monotonic paths indicate genuine exploration (EXP-004)
 */
export function analyzeTrajectory(scratchpad: Scratchpad): {
  isMonotonic: boolean
  maxDip: number
  finalTrend: 'increasing' | 'decreasing' | 'stable'
} {
  const history = [...scratchpad.confidenceHistory, scratchpad.currentConfidence]
  if (history.length < 2) {
    return { isMonotonic: true, maxDip: 0, finalTrend: 'stable' }
  }

  let isMonotonic = true
  let maxDip = 0
  let maxSoFar = history[0]

  for (let i = 1; i < history.length; i++) {
    if (history[i] < history[i - 1]) {
      isMonotonic = false
      const dip = maxSoFar - history[i]
      if (dip > maxDip) maxDip = dip
    }
    maxSoFar = Math.max(maxSoFar, history[i])
  }

  // Final trend from last 2 points
  const last = history[history.length - 1]
  const prev = history[history.length - 2]
  const finalTrend = last > prev + 0.03 ? 'increasing'
    : last < prev - 0.03 ? 'decreasing'
    : 'stable'

  return { isMonotonic, maxDip, finalTrend }
}

// ==========================================
// Skill-Driven Workflow Functions
// ==========================================

/**
 * Update the workflow stage
 */
export function setStage(scratchpad: Scratchpad, stage: WorkflowStage): Scratchpad {
  return {
    ...scratchpad,
    currentStage: stage,
    lastUpdated: Date.now(),
  }
}

/**
 * Update the evolving essay draft
 */
export function updateEssay(scratchpad: Scratchpad, essay: string): Scratchpad {
  return {
    ...scratchpad,
    essay,
    lastUpdated: Date.now(),
  }
}

/**
 * Add a user quote from an interview response
 */
export function addUserQuote(scratchpad: Scratchpad, quote: UserQuote): Scratchpad {
  return {
    ...scratchpad,
    userQuotes: [...scratchpad.userQuotes, quote],
    lastUpdated: Date.now(),
  }
}

/**
 * Add claims from GATHER stage
 */
export function addClaims(scratchpad: Scratchpad, claims: string[]): Scratchpad {
  const claimsSection = scratchpad.sections.find(s => s.type === 'claims')
  if (!claimsSection) return scratchpad

  const updated = { ...scratchpad, sections: [...scratchpad.sections] }
  const sectionIndex = updated.sections.findIndex(s => s.type === 'claims')
  updated.sections[sectionIndex] = {
    ...claimsSection,
    content: [...claimsSection.content, ...claims],
    lastUpdated: Date.now(),
  }
  updated.lastUpdated = Date.now()
  return updated
}

/**
 * Add a tension from CRITIQUE stage
 */
export function addTension(scratchpad: Scratchpad, tension: string): Scratchpad {
  const tensionsSection = scratchpad.sections.find(s => s.type === 'tensions')
  if (!tensionsSection) return scratchpad

  const updated = { ...scratchpad, sections: [...scratchpad.sections] }
  const sectionIndex = updated.sections.findIndex(s => s.type === 'tensions')
  updated.sections[sectionIndex] = {
    ...tensionsSection,
    content: [...tensionsSection.content, tension],
    lastUpdated: Date.now(),
  }
  updated.lastUpdated = Date.now()
  return updated
}

/**
 * Format user quotes for injection into essay prompts
 */
export function formatUserQuotesForPrompt(scratchpad: Scratchpad): string {
  if (scratchpad.userQuotes.length === 0) return ''

  const lines = ['## User Quotes from Interview']
  for (const quote of scratchpad.userQuotes) {
    lines.push(`- On ${quote.claimId} (${quote.positionType}): "${quote.quote}"`)
  }
  return lines.join('\n')
}

/**
 * Render scratchpad with essay for skill prompts
 */
export function renderForSkillPrompt(scratchpad: Scratchpad): string {
  const sections: string[] = []

  sections.push(`# Session Context`)
  sections.push(`Stage: ${scratchpad.currentStage.toUpperCase()}`)
  sections.push(`Confidence: ${(scratchpad.currentConfidence * 100).toFixed(0)}%`)

  // Claims
  const claims = scratchpad.sections.find(s => s.type === 'claims')
  if (claims && claims.content.length > 0) {
    sections.push('\n## Extracted Claims')
    claims.content.forEach((c, i) => sections.push(`${i + 1}. ${c}`))
  }

  // User quotes
  if (scratchpad.userQuotes.length > 0) {
    sections.push('\n## User Quotes')
    for (const quote of scratchpad.userQuotes) {
      sections.push(`- On ${quote.claimId} (${quote.positionType}): "${quote.quote}"`)
    }
  }

  // Tensions
  const tensions = scratchpad.sections.find(s => s.type === 'tensions')
  if (tensions && tensions.content.length > 0) {
    sections.push('\n## Identified Tensions')
    tensions.content.forEach(t => sections.push(`- ${t}`))
  }

  // Current essay draft
  if (scratchpad.essay) {
    sections.push('\n## Current Essay Draft')
    sections.push(scratchpad.essay)
  }

  // Other accumulated content
  const insights = scratchpad.sections.find(s => s.type === 'insights')
  if (insights && insights.content.length > 0) {
    sections.push('\n## Key Insights')
    insights.content.forEach(i => sections.push(`- ${i}`))
  }

  const counters = scratchpad.sections.find(s => s.type === 'counters')
  if (counters && counters.content.length > 0) {
    sections.push('\n## Counterarguments')
    counters.content.forEach(c => sections.push(`- ${c}`))
  }

  return sections.join('\n')
}
