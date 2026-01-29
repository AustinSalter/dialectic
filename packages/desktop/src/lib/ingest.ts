/**
 * Source ingestion and claim extraction
 *
 * URL ingestion: Delegates to backend /ingest endpoint
 * Text ingestion: Uses local Claude API call (for clipboard paste)
 */

import { makeCompletion } from './claude'
import type { IngestRequest, IngestResponse } from './api'

export interface Claim {
  id: string
  text: string
  type: 'core_thesis' | 'framework' | 'meta' | 'counter'
  snippet: string
  quote_start: number
  quote_end: number
}

export interface IngestResult {
  url: string | null
  title: string
  text: string
  claims: Claim[]
}

// Backend API configuration
const API_BASE_URL = 'http://localhost:8000'

/**
 * Normalize API errors into user-actionable messages
 */
function normalizeError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return new Error(
        `Cannot connect to ingest server at ${API_BASE_URL}. ` +
        `URL ingestion requires a running backend. Use text paste for local content.`
      )
    }
    // Pass through other errors with context
    return new Error(`${context}: ${error.message}`)
  }
  return new Error(`${context}: Unknown error occurred`)
}

/**
 * Parse API error response into user-friendly message
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json()
    // FastAPI returns { detail: string } for errors
    if (data.detail) {
      return data.detail
    }
    return JSON.stringify(data)
  } catch {
    return response.statusText || `HTTP ${response.status}`
  }
}

/**
 * Extract claims from source text using Claude
 * Returns 3-7 claims with exact character offsets for highlighting
 */
export async function extractClaims(text: string, title: string): Promise<Claim[]> {
  const systemPrompt = `You are a dialectic analysis assistant. Your task is to extract key claims from source material.

## Output Format
Return ONLY valid JSON array. No markdown, no explanation.

## Claim Types
- core_thesis: Central argument or main point
- framework: Mental model or analytical lens
- meta: Meta-commentary about the discourse
- counter: Counterargument or tension point

## Instructions
1. Identify 3-7 most important claims
2. For each claim, find an EXACT quote from the text
3. The quote must appear VERBATIM in the source text
4. Calculate character offsets for highlighting

## JSON Schema
[
  {
    "id": "CLAIM-1",
    "text": "Summary of the claim in your words (1-2 sentences)",
    "type": "core_thesis|framework|meta|counter",
    "snippet": "Exact verbatim quote from the source",
    "quote_start": 0,
    "quote_end": 100
  }
]

CRITICAL: The snippet MUST be an exact substring of the source text. The quote_start and quote_end must be correct character positions.`

  const userPrompt = `# Source: ${title}

<source_text>
${text}
</source_text>

Extract 3-7 key claims with exact quotes and character offsets. Return ONLY the JSON array.`

  const response = await makeCompletion(systemPrompt, userPrompt, {
    maxTokens: 2048,
  })

  // Parse JSON response
  let claims: Claim[]
  try {
    // Handle potential markdown code blocks
    const jsonStr = response.replace(/```json?\s*|\s*```/g, '').trim()
    console.log('[ingest] Parsing claims JSON, length:', jsonStr.length)
    claims = JSON.parse(jsonStr)
    console.log('[ingest] Parsed', claims.length, 'claims')
  } catch (e) {
    console.error('[ingest] Failed to parse claims JSON. Response was:', response.substring(0, 500))
    throw new Error(`Failed to parse claim extraction response. Claude may have returned invalid JSON.`)
  }

  // Handle empty array
  if (!Array.isArray(claims) || claims.length === 0) {
    console.warn('[ingest] No claims extracted from source')
    return []
  }

  // Validate and fix character offsets
  claims = claims.map((claim, i) => {
    const id = claim.id || `CLAIM-${i + 1}`
    const snippet = claim.snippet || ''

    // Find actual position in text
    const actualStart = text.indexOf(snippet)
    if (actualStart !== -1) {
      return {
        ...claim,
        id,
        quote_start: actualStart,
        quote_end: actualStart + snippet.length,
      }
    }

    // If exact match fails, try fuzzy match (first 50 chars)
    const shortSnippet = snippet.substring(0, 50)
    const fuzzyStart = text.indexOf(shortSnippet)
    if (fuzzyStart !== -1) {
      return {
        ...claim,
        id,
        quote_start: fuzzyStart,
        quote_end: fuzzyStart + snippet.length,
      }
    }

    // Keep original offsets if we can't find the quote
    return { ...claim, id }
  })

  return claims
}

/**
 * Full ingest flow: fetch source and extract claims via backend
 *
 * Uses backend /ingest endpoint which:
 * 1. Fetches URL content (no CORS issues server-side)
 * 2. Extracts text from HTML
 * 3. Uses Claude to extract claims with character offsets
 */
export async function ingestSource(url: string): Promise<IngestResult> {
  console.log('[ingest] Calling backend /ingest for URL:', url)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url } satisfies IngestRequest),
    })
  } catch (error) {
    throw normalizeError(error, 'Failed to connect to backend')
  }

  if (!response.ok) {
    const errorDetail = await parseErrorResponse(response)

    // Provide specific guidance based on error type
    if (response.status === 400) {
      throw new Error(
        `Could not fetch the URL: ${errorDetail}. ` +
        `Please check that the URL is correct and the page is publicly accessible.`
      )
    }
    if (response.status === 500) {
      throw new Error(
        `Backend error while processing URL: ${errorDetail}. ` +
        `This may be a temporary issue - try again in a moment. ` +
        `If the problem persists, check the backend logs.`
      )
    }
    throw new Error(`Ingest failed (${response.status}): ${errorDetail}`)
  }

  const data: IngestResponse = await response.json()
  console.log('[ingest] Backend returned', data.claims.length, 'claims for:', data.title)

  // Map backend response to IngestResult (preserving existing interface)
  // Note: backend returns session_id which we don't use here - the session
  // is managed at the component level
  return {
    url,
    title: data.title,
    text: data.text,
    claims: data.claims as Claim[], // Type assertion: backend Claim matches frontend Claim
  }
}

/**
 * Ingest from raw text (clipboard paste)
 */
export async function ingestFromText(text: string, title?: string): Promise<IngestResult> {
  const resolvedTitle = title || 'Pasted Content'
  const claims = await extractClaims(text, resolvedTitle)

  return {
    url: null,
    title: resolvedTitle,
    text,
    claims,
  }
}
