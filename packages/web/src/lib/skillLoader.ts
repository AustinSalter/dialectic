/**
 * Skill Loader - Parse .skill.md files into executable skill objects
 *
 * Skills are the single source of truth for workflow stage behavior.
 * Each skill defines multi-pass execution with semantic markers.
 */

export interface PassDefinition {
  name: string
  number: number
  purpose: string
  systemPrompt: string
  markers: string[]
}

export interface OutputSchema {
  format: 'json' | 'text' | 'markdown'
  schema?: string // JSON schema or description
}

export interface Skill {
  name: string
  stage: 'gather' | 'shape' | 'critique' | 'synthesize'
  purpose: string
  activation: string[]
  passes: PassDefinition[]
  systemPrompt: string // Main system prompt from skill file
  outputSchema: OutputSchema
  semanticMarkers: string[]
  evaluationCriteria: string[]
}

// Cache loaded skills
const skillCache = new Map<string, Skill>()

/**
 * Parse a skill markdown file into a Skill object
 */
export function parseSkillMarkdown(markdown: string, stage: Skill['stage']): Skill {
  // Extract title/name from first H1
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const name = titleMatch ? titleMatch[1].trim() : 'Unknown Skill'

  // Extract purpose section
  const purpose = extractSection(markdown, 'Purpose')

  // Extract activation conditions
  const activationSection = extractSection(markdown, 'Activation')
  const activation = activationSection
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim())

  // Extract multi-pass definitions
  const passes = extractPasses(markdown)

  // Extract main system prompt from code block
  const systemPrompt = extractSystemPrompt(markdown)

  // Extract output schema
  const outputSchema = extractOutputSchema(markdown)

  // Extract semantic markers used
  const semanticMarkers = extractSemanticMarkers(markdown)

  // Extract evaluation criteria
  const evaluationSection = extractSection(markdown, 'Evaluation Criteria')
  const evaluationCriteria = evaluationSection
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim())

  return {
    name,
    stage,
    purpose,
    activation,
    passes,
    systemPrompt,
    outputSchema,
    semanticMarkers,
    evaluationCriteria,
  }
}

/**
 * Extract a section by header name
 */
function extractSection(markdown: string, sectionName: string): string {
  const regex = new RegExp(`^##\\s+${sectionName}\\s*$`, 'mi')
  const match = markdown.match(regex)
  if (!match || match.index === undefined) return ''

  const startIndex = match.index + match[0].length
  const nextSectionMatch = markdown.slice(startIndex).match(/^##\s+/m)
  const endIndex = nextSectionMatch?.index
    ? startIndex + nextSectionMatch.index
    : markdown.length

  return markdown.slice(startIndex, endIndex).trim()
}

/**
 * Extract pass definitions from Multi-Pass section
 */
function extractPasses(markdown: string): PassDefinition[] {
  const passes: PassDefinition[] = []

  // Find Multi-Pass section
  const multiPassSection = extractSection(markdown, 'Multi-Pass Extraction')
    || extractSection(markdown, 'Multi-Pass Generation')
    || extractSection(markdown, 'Multi-Pass Analysis')
    || extractSection(markdown, 'Multi-Pass')

  if (!multiPassSection) return passes

  // Match Pass headers like "### Pass 1: Divergent Scan"
  const passRegex = /###\s+Pass\s+(\d+):\s+(.+?)(?=###|$)/gs
  let match

  while ((match = passRegex.exec(multiPassSection)) !== null) {
    const number = parseInt(match[1], 10)
    const name = match[2].trim()
    const content = match[0]

    // Extract purpose from first paragraph after header
    const purposeMatch = content.match(/###[^\n]+\n+(.+?)(?=\n\n|```|$)/s)
    const purpose = purposeMatch ? purposeMatch[1].trim() : ''

    // Extract markers mentioned in this pass
    const markers = extractMarkersFromText(content)

    passes.push({
      name,
      number,
      purpose,
      systemPrompt: '', // Will be populated from main system prompt
      markers,
    })
  }

  return passes
}

/**
 * Extract the main system prompt from code block
 */
function extractSystemPrompt(markdown: string): string {
  // Look for System Prompt section
  const systemSection = extractSection(markdown, 'System Prompt')
  if (!systemSection) return ''

  // Extract content from code block
  const codeBlockMatch = systemSection.match(/```(?:\w+)?\n([\s\S]*?)```/)
  if (!codeBlockMatch) return systemSection

  return codeBlockMatch[1].trim()
}

/**
 * Extract output schema from Output Format section
 */
function extractOutputSchema(markdown: string): OutputSchema {
  const outputSection = extractSection(markdown, 'Output Format')

  // Check if JSON format
  if (outputSection.includes('```json') || outputSection.toLowerCase().includes('json')) {
    const schemaMatch = outputSection.match(/```json\n([\s\S]*?)```/)
    return {
      format: 'json',
      schema: schemaMatch ? schemaMatch[1].trim() : undefined,
    }
  }

  // Check if markdown format
  if (outputSection.includes('```markdown') || outputSection.includes('.md')) {
    return { format: 'markdown' }
  }

  return { format: 'text' }
}

/**
 * Extract semantic markers mentioned in the skill file
 */
function extractSemanticMarkers(markdown: string): string[] {
  const markers: string[] = []
  const markerRegex = /\[([A-Z_]+)\]/g
  let match

  while ((match = markerRegex.exec(markdown)) !== null) {
    const marker = match[1]
    if (!markers.includes(marker)) {
      markers.push(marker)
    }
  }

  return markers
}

/**
 * Extract markers from a specific text block
 */
function extractMarkersFromText(text: string): string[] {
  const markers: string[] = []
  const markerRegex = /\[([A-Z_]+)\]/g
  let match

  while ((match = markerRegex.exec(text)) !== null) {
    const marker = match[1]
    if (!markers.includes(marker)) {
      markers.push(marker)
    }
  }

  return markers
}

/**
 * Load a skill from its stage name
 * In browser context, skills should be pre-loaded
 */
export function getSkill(stage: Skill['stage']): Skill | null {
  return skillCache.get(stage) || null
}

/**
 * Register a pre-parsed skill in the cache
 */
export function registerSkill(skill: Skill): void {
  skillCache.set(skill.stage, skill)
}

/**
 * Get all registered skills
 */
export function getAllSkills(): Map<string, Skill> {
  return new Map(skillCache)
}

/**
 * Clear the skill cache
 */
export function clearSkillCache(): void {
  skillCache.clear()
}

// Pre-defined skill content for browser context
// (In Node.js, these would be read from files)

export const SKILL_DEFINITIONS: Record<Skill['stage'], string> = {
  gather: '', // Will be populated from skill files
  shape: '',
  critique: '',
  synthesize: '',
}

/**
 * Initialize skills from embedded definitions
 * Call this on app startup
 */
export function initializeSkills(definitions: Record<Skill['stage'], string>): void {
  for (const [stage, markdown] of Object.entries(definitions)) {
    if (markdown) {
      const skill = parseSkillMarkdown(markdown, stage as Skill['stage'])
      registerSkill(skill)
    }
  }
}
