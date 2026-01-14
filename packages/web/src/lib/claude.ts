/**
 * Claude API client with BYOK (Bring Your Own Key)
 * Reads API key from localStorage, supports streaming
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export interface ClaudeError {
  type: 'rate_limit' | 'invalid_key' | 'network' | 'api_error'
  message: string
  retryAfter?: number
}

function getApiKey(): string | null {
  return localStorage.getItem('claude_api_key')
}

function assertApiKey(): string {
  const key = getApiKey()
  if (!key) {
    throw { type: 'invalid_key', message: 'No API key configured. Please add your API key.' } as ClaudeError
  }
  return key
}

async function handleResponse(response: Response): Promise<Response> {
  if (response.ok) return response

  if (response.status === 401) {
    throw { type: 'invalid_key', message: 'Invalid API key. Please check your key and try again.' } as ClaudeError
  }

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10)
    throw { type: 'rate_limit', message: `Rate limited. Retry in ${retryAfter}s.`, retryAfter } as ClaudeError
  }

  const body = await response.json().catch(() => ({}))
  throw { type: 'api_error', message: body.error?.message || `API error: ${response.status}` } as ClaudeError
}

/**
 * Make a completion request to Claude API
 */
export async function makeCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = assertApiKey()

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  }).catch((err) => {
    throw { type: 'network', message: `Network error: ${err.message}` } as ClaudeError
  })

  await handleResponse(response)
  const data = await response.json()
  return data.content[0]?.text || ''
}

/**
 * Make a streaming completion request to Claude API
 * Calls onChunk for each text delta, returns full text when complete
 */
export async function makeStreamingCompletion(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = assertApiKey()

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: options?.model || DEFAULT_MODEL,
      max_tokens: options?.maxTokens || 4096,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  }).catch((err) => {
    throw { type: 'network', message: `Network error: ${err.message}` } as ClaudeError
  })

  await handleResponse(response)

  const reader = response.body?.getReader()
  if (!reader) throw { type: 'api_error', message: 'No response body' } as ClaudeError

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullText += event.delta.text
          onChunk(event.delta.text)
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return fullText
}

/**
 * Check if we have a valid API key stored
 */
export function hasApiKey(): boolean {
  return !!getApiKey()
}

/**
 * Validate an API key by making a minimal request
 */
export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    return response.ok || response.status === 429 // 429 means key is valid but rate limited
  } catch {
    return false
  }
}

export interface Tool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required: string[]
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

/**
 * Make a streaming completion request with tool support
 * Handles tool_use blocks by calling onToolCall, then continues the conversation
 */
export async function makeCompletionWithTools(
  systemPrompt: string,
  userPrompt: string,
  tools: Tool[],
  onToolCall: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>,
  onChunk: (text: string) => void,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = assertApiKey()
  const messages: Message[] = [{ role: 'user', content: userPrompt }]
  let fullResponse = ''
  const maxIterations = 10 // Prevent infinite loops

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: options?.model || DEFAULT_MODEL,
        max_tokens: options?.maxTokens || 4096,
        stream: true,
        system: systemPrompt,
        messages,
        tools,
      }),
    }).catch((err) => {
      throw { type: 'network', message: `Network error: ${err.message}` } as ClaudeError
    })

    await handleResponse(response)

    const reader = response.body?.getReader()
    if (!reader) throw { type: 'api_error', message: 'No response body' } as ClaudeError

    const decoder = new TextDecoder()
    let buffer = ''
    let currentText = ''
    const toolCalls: { id: string; name: string; input: Record<string, unknown> }[] = []
    let currentToolId = ''
    let currentToolName = ''
    let currentToolInput = ''
    let stopReason = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'tool_use') {
              currentToolId = event.content_block.id
              currentToolName = event.content_block.name
              currentToolInput = ''
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta' && event.delta?.text) {
              currentText += event.delta.text
              fullResponse += event.delta.text
              onChunk(event.delta.text)
            } else if (event.delta?.type === 'input_json_delta' && event.delta?.partial_json) {
              currentToolInput += event.delta.partial_json
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolId && currentToolName) {
              try {
                const input = currentToolInput ? JSON.parse(currentToolInput) : {}
                toolCalls.push({ id: currentToolId, name: currentToolName, input })
              } catch {
                toolCalls.push({ id: currentToolId, name: currentToolName, input: {} })
              }
              currentToolId = ''
              currentToolName = ''
              currentToolInput = ''
            }
          } else if (event.type === 'message_delta') {
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason
            }
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // If no tool calls, we're done
    if (toolCalls.length === 0 || stopReason !== 'tool_use') {
      return fullResponse
    }

    // Build assistant message with text and tool_use blocks
    const assistantContent: ContentBlock[] = []
    if (currentText) {
      assistantContent.push({ type: 'text', text: currentText })
    }
    for (const tc of toolCalls) {
      assistantContent.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })
    }
    messages.push({ role: 'assistant', content: assistantContent })

    // Execute tools and build tool_result blocks
    const toolResults: ContentBlock[] = []
    for (const tc of toolCalls) {
      onChunk(`\n\n[Using tool: ${tc.name}...]\n`)
      try {
        const result = await onToolCall(tc.name, tc.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: result,
        })
        onChunk(`[Tool result received]\n\n`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Tool execution failed'
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: `Error: ${errMsg}`,
        })
        onChunk(`[Tool error: ${errMsg}]\n\n`)
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return fullResponse
}
