/**
 * API Integration Layer for Multi-Pass Harness Backend
 *
 * Type contracts for:
 * - Backend REST endpoints (health, ingest, harness/run)
 * - WebSocket streaming (ws/harness)
 * - Error normalization
 *
 * Backend: FastAPI at localhost:8000
 * Architecture: Multi-pass reasoning with accumulated context
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * API configuration - can be overridden via env var or localStorage
 */
export interface ApiConfig {
  baseUrl: string
  wsUrl: string
  timeout: number
}

// =============================================================================
// CLAIM TYPES (matches backend Pydantic model + frontend ingest.ts)
// =============================================================================

/**
 * Claim type enumeration - matches backend and frontend types
 */
export type ClaimType = 'core_thesis' | 'framework' | 'meta' | 'counter'

/**
 * Claim extracted from source material
 * Matches: backend server.py Claim model AND frontend ingest.ts Claim interface
 */
export interface Claim {
  id: string
  text: string
  type: ClaimType
  snippet: string
  quote_start: number
  quote_end: number
}

// =============================================================================
// INGEST ENDPOINT TYPES
// =============================================================================

/**
 * Request body for POST /ingest
 * Either url OR text must be provided
 */
export interface IngestRequest {
  url?: string
  text?: string
  title?: string
}

/**
 * Response from POST /ingest
 * Matches backend IngestResponse Pydantic model
 */
export interface IngestResponse {
  session_id: string
  title: string
  text: string
  claims: Claim[]
}

// =============================================================================
// HARNESS RUN ENDPOINT TYPES (REST)
// =============================================================================

/**
 * Request body for POST /harness/run
 * Matches backend HarnessRequest Pydantic model
 */
export interface HarnessRunRequest {
  title: string
  claims: Claim[]
  initial_context?: string
  max_cycles?: number
}

/**
 * Pass type enumeration
 */
export type PassType = 'expansion' | 'compression' | 'critique' | 'synthesis'

/**
 * Result from a single pass in the multi-pass harness
 * Matches backend harness.py PassResult dataclass
 */
export interface PassDetail {
  pass_type: PassType
  confidence: number
  duration_ms: number
  tokens_used: number
}

/**
 * Trajectory analysis - indicates genuine exploration vs premature convergence
 * Non-monotonic trajectories are good (from EXP-004)
 */
export interface TrajectoryAnalysis {
  is_monotonic: boolean
  max_dip: number
  final_trend: 'increasing' | 'decreasing' | 'stable'
}

/**
 * Response from POST /harness/run (blocking)
 * Matches backend HarnessResponse Pydantic model
 */
export interface HarnessRunResponse {
  session_id: string
  title: string
  final_synthesis: string
  final_confidence: number
  confidence_trajectory: number[]
  trajectory_analysis: TrajectoryAnalysis
  termination_reason: string
  total_duration_ms: number
  total_tokens: number
  passes: PassDetail[]
}

// =============================================================================
// WEBSOCKET EVENT TYPES (Discriminated Union)
// =============================================================================

/**
 * Base shape for all WebSocket events
 */
interface BaseHarnessEvent<T extends string, D = unknown> {
  event: T
  data: D
}

/**
 * Harness initialized - sent after WebSocket run command received
 */
export interface HarnessInitializedEvent
  extends BaseHarnessEvent<'initialized', { session_id: string; claims: number }> {}

/**
 * New cycle starting
 */
export interface HarnessCycleStartEvent
  extends BaseHarnessEvent<'cycle_start', { cycle: number }> {}

/**
 * Expansion pass completed
 */
export interface HarnessExpansionCompleteEvent
  extends BaseHarnessEvent<
    'expansion_complete',
    { cycle: number; confidence: number; tokens: number }
  > {}

/**
 * Compression pass completed
 */
export interface HarnessCompressionCompleteEvent
  extends BaseHarnessEvent<
    'compression_complete',
    { cycle: number; confidence: number; tokens: number }
  > {}

/**
 * Critique pass completed
 */
export interface HarnessCritiqueCompleteEvent
  extends BaseHarnessEvent<
    'critique_complete',
    { cycle: number; confidence: number; tokens: number }
  > {}

/**
 * Synthesis pass completed (final pass before complete)
 */
export interface HarnessSynthesisCompleteEvent
  extends BaseHarnessEvent<
    'synthesis_complete',
    { confidence: number; tokens: number }
  > {}

/**
 * Harness is terminating - includes reason
 */
export interface HarnessTerminatingEvent
  extends BaseHarnessEvent<
    'terminating',
    { reason: string }
  > {}

/**
 * Harness completed successfully - includes full result
 */
export interface HarnessCompleteEvent
  extends BaseHarnessEvent<
    'complete',
    {
      session_id: string
      title: string
      final_synthesis: string
      final_confidence: number
      confidence_trajectory: number[]
      trajectory_analysis: TrajectoryAnalysis
      termination_reason: string
      total_duration_ms: number
      total_tokens: number
    }
  > {}

/**
 * Error during harness execution
 */
export interface HarnessErrorEvent
  extends BaseHarnessEvent<'error', { message: string }> {}

/**
 * Pong response to ping
 */
export interface HarnessPongEvent
  extends BaseHarnessEvent<'pong', undefined> {}

/**
 * Discriminated union of all harness WebSocket events
 * Discriminate on the 'event' field
 */
export type HarnessEvent =
  | HarnessInitializedEvent
  | HarnessCycleStartEvent
  | HarnessExpansionCompleteEvent
  | HarnessCompressionCompleteEvent
  | HarnessCritiqueCompleteEvent
  | HarnessSynthesisCompleteEvent
  | HarnessTerminatingEvent
  | HarnessCompleteEvent
  | HarnessErrorEvent
  | HarnessPongEvent

/**
 * Extract event type string literals for type guards
 */
export type HarnessEventType = HarnessEvent['event']

// =============================================================================
// WEBSOCKET COMMAND TYPES
// =============================================================================

/**
 * Command to start harness run via WebSocket
 */
export interface HarnessRunCommand {
  action: 'run'
  title: string
  claims: Claim[]
  max_cycles?: number
}

/**
 * Ping command for keepalive
 */
export interface HarnessPingCommand {
  action: 'ping'
}

/**
 * Union of all WebSocket commands
 */
export type HarnessCommand = HarnessRunCommand | HarnessPingCommand

// =============================================================================
// SCRATCHPAD TYPES (for session retrieval)
// =============================================================================

/**
 * Response from GET /sessions/{session_id}/scratchpad
 * Matches backend ScratchpadResponse Pydantic model
 */
export interface ScratchpadResponse {
  session_id: string
  title: string
  rendered: string
  confidence: number
  cycle_count: number
  trajectory_analysis: TrajectoryAnalysis
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  session_id: string
  title: string
  confidence: number
  cycle_count: number
  created: string // ISO timestamp
}

/**
 * Response from GET /sessions
 */
export interface SessionListResponse {
  sessions: SessionSummary[]
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Response from GET /health
 */
export interface HealthResponse {
  status: 'ok'
  timestamp: string // ISO timestamp
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Error category for user-actionable messages
 */
export type ApiErrorCategory =
  | 'network'        // Connection failed, timeout
  | 'validation'     // 4xx - bad request, invalid input
  | 'server'         // 5xx - backend error
  | 'unauthorized'   // 401/403
  | 'not_found'      // 404
  | 'websocket'      // WebSocket-specific errors

/**
 * Normalized API error with user-actionable message
 */
export interface ApiError {
  category: ApiErrorCategory
  message: string           // User-facing message
  detail?: string           // Technical detail (for debugging)
  statusCode?: number       // HTTP status if applicable
  retryable: boolean        // Whether the operation can be retried
}

// =============================================================================
// PROGRESS STATE TYPES (for UI)
// =============================================================================

/**
 * Frontend progress state derived from WebSocket events
 * Maps harness events to UI-friendly state
 */
export interface HarnessProgressState {
  status: 'idle' | 'connecting' | 'running' | 'complete' | 'error'
  currentCycle: number
  currentPass: PassType | null
  cyclesCompleted: number
  confidenceHistory: number[]
  lastConfidence: number
  tokensUsed: number
  terminationReason: string | null
  error: ApiError | null
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for HarnessEvent discriminated union
 */
export function isHarnessEvent<T extends HarnessEventType>(
  event: HarnessEvent,
  type: T
): event is Extract<HarnessEvent, { event: T }> {
  return event.event === type
}

// =============================================================================
// CLIENT INTERFACE (to be implemented)
// =============================================================================

/**
 * API client interface - implementation TBD
 */
export interface HarnessApiClient {
  // Configuration
  readonly config: ApiConfig

  // REST endpoints
  checkHealth(): Promise<HealthResponse>
  ingest(request: IngestRequest): Promise<IngestResponse>
  runHarness(request: HarnessRunRequest): Promise<HarnessRunResponse>
  getScratchpad(sessionId: string): Promise<ScratchpadResponse>
  listSessions(): Promise<SessionListResponse>

  // WebSocket
  connectHarness(
    onEvent: (event: HarnessEvent) => void,
    onError: (error: ApiError) => void,
    onClose: () => void
  ): HarnessWebSocketConnection
}

/**
 * WebSocket connection interface
 */
export interface HarnessWebSocketConnection {
  send(command: HarnessCommand): void
  close(): void
  readonly readyState: number
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Default API configuration
 * Can be overridden via localStorage key 'cannon_api_config'
 */
function getDefaultConfig(): ApiConfig {
  // Check localStorage for override
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cannon_api_config')
    if (stored) {
      try {
        return JSON.parse(stored) as ApiConfig
      } catch {
        // Invalid stored config, use defaults
      }
    }
  }

  return {
    baseUrl: 'http://localhost:8000',
    wsUrl: 'ws://localhost:8000',
    timeout: 30000, // 30 seconds
  }
}

/**
 * Create an ApiError from various error conditions
 */
function createApiError(
  category: ApiErrorCategory,
  message: string,
  options: {
    detail?: string
    statusCode?: number
    retryable?: boolean
  } = {}
): ApiError {
  return {
    category,
    message,
    detail: options.detail,
    statusCode: options.statusCode,
    retryable: options.retryable ?? false,
  }
}

/**
 * Map HTTP status codes to user-friendly error messages
 */
function httpStatusToApiError(status: number, responseBody?: string): ApiError {
  const detail = responseBody || undefined

  switch (status) {
    case 400:
      return createApiError('validation', 'Invalid request. Check your input and try again.', {
        statusCode: status,
        detail,
        retryable: false,
      })
    case 401:
      return createApiError('unauthorized', 'Authentication required. Please check your API key.', {
        statusCode: status,
        detail,
        retryable: false,
      })
    case 403:
      return createApiError('unauthorized', 'Access denied. You do not have permission for this action.', {
        statusCode: status,
        detail,
        retryable: false,
      })
    case 404:
      return createApiError('not_found', 'Resource not found. It may have been deleted or never existed.', {
        statusCode: status,
        detail,
        retryable: false,
      })
    case 408:
      return createApiError('network', 'Request timed out. Check your connection and try again.', {
        statusCode: status,
        detail,
        retryable: true,
      })
    case 429:
      return createApiError('server', 'Too many requests. Please wait a moment and try again.', {
        statusCode: status,
        detail,
        retryable: true,
      })
    case 500:
      return createApiError('server', 'Server error. The backend encountered an internal problem.', {
        statusCode: status,
        detail,
        retryable: true,
      })
    case 502:
      return createApiError('server', 'Backend unavailable. The server may be starting up or restarting.', {
        statusCode: status,
        detail,
        retryable: true,
      })
    case 503:
      return createApiError('server', 'Service temporarily unavailable. Please try again in a few moments.', {
        statusCode: status,
        detail,
        retryable: true,
      })
    default:
      if (status >= 400 && status < 500) {
        return createApiError('validation', `Client error (${status}). Check your request.`, {
          statusCode: status,
          detail,
          retryable: false,
        })
      }
      if (status >= 500) {
        return createApiError('server', `Server error (${status}). Please try again later.`, {
          statusCode: status,
          detail,
          retryable: true,
        })
      }
      return createApiError('server', `Unexpected status code: ${status}`, {
        statusCode: status,
        detail,
        retryable: false,
      })
  }
}

/**
 * Parse JSON response with proper error handling
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (!response.ok) {
    // Try to extract error detail from response body
    let errorDetail = text
    try {
      const errorJson = JSON.parse(text)
      errorDetail = errorJson.detail || errorJson.message || text
    } catch {
      // Body is not JSON, use raw text
    }
    throw httpStatusToApiError(response.status, errorDetail)
  }

  if (!text) {
    throw createApiError('server', 'Empty response from server. Expected JSON data.', {
      retryable: true,
    })
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw createApiError('server', 'Invalid JSON response from server.', {
      detail: text.slice(0, 200),
      retryable: false,
    })
  }
}

/**
 * Perform a fetch with timeout and error handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createApiError(
        'network',
        'Request timed out. The server may be overloaded or unreachable.',
        { retryable: true }
      )
    }
    if (error instanceof TypeError) {
      // Network errors typically throw TypeError
      throw createApiError(
        'network',
        'Could not connect to server. Is the backend running at localhost:8000?',
        {
          detail: error.message,
          retryable: true,
        }
      )
    }
    // Re-throw ApiErrors
    if (isApiError(error)) {
      throw error
    }
    // Unknown error
    throw createApiError('network', 'An unexpected network error occurred.', {
      detail: String(error),
      retryable: true,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Type guard for ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    'message' in error &&
    'retryable' in error
  )
}

/**
 * Parse incoming WebSocket message as HarnessEvent
 */
function parseWebSocketMessage(data: string): HarnessEvent {
  const parsed: unknown = JSON.parse(data)

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('event' in parsed)
  ) {
    throw new Error('Invalid WebSocket message: missing event field')
  }

  // The backend sends {event: string, data?: unknown}
  // We trust the backend to send valid event types
  return parsed as HarnessEvent
}

// =============================================================================
// API CLIENT IMPLEMENTATION
// =============================================================================

/**
 * Create the API client instance
 */
export function createApiClient(configOverride?: Partial<ApiConfig>): HarnessApiClient {
  const config: ApiConfig = {
    ...getDefaultConfig(),
    ...configOverride,
  }

  /**
   * Make a GET request
   */
  async function get<T>(path: string): Promise<T> {
    const response = await fetchWithTimeout(
      `${config.baseUrl}${path}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      },
      config.timeout
    )
    return parseJsonResponse<T>(response)
  }

  /**
   * Make a POST request with JSON body
   */
  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchWithTimeout(
      `${config.baseUrl}${path}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      config.timeout
    )
    return parseJsonResponse<T>(response)
  }

  return {
    config,

    async checkHealth(): Promise<HealthResponse> {
      return get<HealthResponse>('/health')
    },

    async ingest(request: IngestRequest): Promise<IngestResponse> {
      if (!request.url && !request.text) {
        throw createApiError(
          'validation',
          'Either a URL or text content must be provided.',
          { retryable: false }
        )
      }
      return post<IngestResponse>('/ingest', request)
    },

    async runHarness(request: HarnessRunRequest): Promise<HarnessRunResponse> {
      if (!request.claims || request.claims.length === 0) {
        throw createApiError(
          'validation',
          'At least one claim is required to run the harness.',
          { retryable: false }
        )
      }
      // Longer timeout for harness - it can take a while
      const harnessTimeout = Math.max(config.timeout, 120000) // At least 2 minutes
      const response = await fetchWithTimeout(
        `${config.baseUrl}/harness/run`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
        harnessTimeout
      )
      return parseJsonResponse<HarnessRunResponse>(response)
    },

    async getScratchpad(sessionId: string): Promise<ScratchpadResponse> {
      if (!sessionId) {
        throw createApiError(
          'validation',
          'Session ID is required.',
          { retryable: false }
        )
      }
      return get<ScratchpadResponse>(`/sessions/${encodeURIComponent(sessionId)}/scratchpad`)
    },

    async listSessions(): Promise<SessionListResponse> {
      return get<SessionListResponse>('/sessions')
    },

    connectHarness(
      onEvent: (event: HarnessEvent) => void,
      onError: (error: ApiError) => void,
      onClose: () => void
    ): HarnessWebSocketConnection {
      const ws = new WebSocket(`${config.wsUrl}/ws/harness`)

      ws.onopen = () => {
        // Connection established - no event to emit, consumer can check readyState
      }

      ws.onmessage = (event) => {
        try {
          const parsed = parseWebSocketMessage(event.data)
          onEvent(parsed)
        } catch (error) {
          onError(
            createApiError(
              'websocket',
              'Received invalid message from server.',
              {
                detail: String(error),
                retryable: false,
              }
            )
          )
        }
      }

      ws.onerror = () => {
        // WebSocket error event doesn't provide details, so we give generic message
        onError(
          createApiError(
            'websocket',
            'WebSocket connection error. The server may be unavailable.',
            { retryable: true }
          )
        )
      }

      ws.onclose = (event) => {
        // Abnormal closure - report error
        if (event.code !== 1000 && event.code !== 1001) {
          onError(
            createApiError(
              'websocket',
              `WebSocket closed unexpectedly (code: ${event.code}). ${event.reason || 'Check server logs.'}`,
              {
                detail: `Close code: ${event.code}, reason: ${event.reason}`,
                retryable: true,
              }
            )
          )
        }
        onClose()
      }

      return {
        send(command: HarnessCommand): void {
          if (ws.readyState !== WebSocket.OPEN) {
            throw createApiError(
              'websocket',
              'Cannot send: WebSocket is not connected. Try reconnecting.',
              { retryable: true }
            )
          }
          ws.send(JSON.stringify(command))
        },

        close(): void {
          ws.close(1000, 'Client closed connection')
        },

        get readyState(): number {
          return ws.readyState
        },
      }
    },
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Default API client instance
 * Use this for most cases. Create a custom client with createApiClient() for testing.
 */
export const api = createApiClient()

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Check if an error is an ApiError
 */
export { isApiError }

/**
 * Create an ApiError (useful for testing or custom error creation)
 */
export { createApiError }
