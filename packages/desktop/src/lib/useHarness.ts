/**
 * React hook for multi-pass harness WebSocket integration
 *
 * Manages:
 * - WebSocket lifecycle (connect, disconnect, reconnect)
 * - Real-time progress updates from harness events
 * - Confidence trajectory accumulation
 * - Error handling with user-actionable messages
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  Claim,
  PassType,
  HarnessEvent,
  HarnessRunCommand,
  HarnessPingCommand,
  ApiError,
  TrajectoryAnalysis,
} from './api'
import { isHarnessEvent } from './api'

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get WebSocket URL from environment or default to localhost
 */
function getWsUrl(): string {
  // Check for Vite env var first
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }
  // Check localStorage for override (useful for development)
  const stored = localStorage.getItem('harness_ws_url')
  if (stored) return stored
  // Default to localhost backend
  return 'ws://localhost:8000/ws/harness'
}

// Reconnect configuration
const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 3
const PING_INTERVAL_MS = 30000

// =============================================================================
// TYPES
// =============================================================================

export type HarnessStatus = 'idle' | 'connecting' | 'running' | 'complete' | 'error' | 'cancelled'

export interface HarnessResult {
  sessionId: string
  title: string
  finalSynthesis: string
  finalConfidence: number
  trajectoryAnalysis: TrajectoryAnalysis
  terminationReason: string
  totalDurationMs: number
  totalTokens: number
}

export interface HarnessState {
  status: HarnessStatus
  currentCycle: number
  currentPass: PassType | null
  confidence: number
  trajectory: number[]
  tokensUsed: number
  result: HarnessResult | null
  error: ApiError | null
}

export interface HarnessActions {
  start: (title: string, claims: Claim[], maxCycles?: number) => void
  cancel: () => void
}

export interface UseHarnessReturn extends HarnessState {
  actions: HarnessActions
  isActive: boolean
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: HarnessState = {
  status: 'idle',
  currentCycle: 0,
  currentPass: null,
  confidence: 0,
  trajectory: [],
  tokensUsed: 0,
  result: null,
  error: null,
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useHarness(): UseHarnessReturn {
  const [state, setState] = useState<HarnessState>(initialState)

  // Refs for WebSocket management
  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(false)
  const pendingCommandRef = useRef<HarnessRunCommand | null>(null)

  // ==========================================================================
  // WEBSOCKET HELPERS
  // ==========================================================================

  /**
   * Clear ping interval
   */
  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  /**
   * Start ping interval for keepalive
   */
  const startPingInterval = useCallback(() => {
    clearPingInterval()
    pingIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const ping: HarnessPingCommand = { action: 'ping' }
        wsRef.current.send(JSON.stringify(ping))
      }
    }, PING_INTERVAL_MS)
  }, [clearPingInterval])

  /**
   * Close WebSocket connection
   */
  const closeConnection = useCallback(() => {
    clearPingInterval()
    shouldReconnectRef.current = false
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [clearPingInterval])

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    let parsed: HarnessEvent
    try {
      parsed = JSON.parse(event.data) as HarnessEvent
    } catch {
      console.error('[useHarness] Failed to parse WebSocket message:', event.data)
      return
    }

    // Discriminated union type narrowing via isHarnessEvent guard
    if (isHarnessEvent(parsed, 'initialized')) {
      console.log('[useHarness] Harness initialized:', parsed.data)
      setState((prev) => ({
        ...prev,
        status: 'running',
      }))
    } else if (isHarnessEvent(parsed, 'cycle_start')) {
      console.log('[useHarness] Cycle started:', parsed.data.cycle)
      setState((prev) => ({
        ...prev,
        currentCycle: parsed.data.cycle,
        currentPass: 'expansion', // First pass of a cycle is expansion
      }))
    } else if (isHarnessEvent(parsed, 'expansion_complete')) {
      console.log('[useHarness] Expansion complete:', parsed.data)
      setState((prev) => ({
        ...prev,
        currentPass: 'compression', // Next pass after expansion
        confidence: parsed.data.confidence,
        trajectory: [...prev.trajectory, parsed.data.confidence],
        tokensUsed: prev.tokensUsed + parsed.data.tokens,
      }))
    } else if (isHarnessEvent(parsed, 'compression_complete')) {
      console.log('[useHarness] Compression complete:', parsed.data)
      setState((prev) => ({
        ...prev,
        currentPass: 'critique', // Next pass after compression
        confidence: parsed.data.confidence,
        trajectory: [...prev.trajectory, parsed.data.confidence],
        tokensUsed: prev.tokensUsed + parsed.data.tokens,
      }))
    } else if (isHarnessEvent(parsed, 'critique_complete')) {
      console.log('[useHarness] Critique complete:', parsed.data)
      setState((prev) => ({
        ...prev,
        currentPass: null, // End of cycle, waiting for next cycle_start or synthesis
        confidence: parsed.data.confidence,
        trajectory: [...prev.trajectory, parsed.data.confidence],
        tokensUsed: prev.tokensUsed + parsed.data.tokens,
      }))
    } else if (isHarnessEvent(parsed, 'synthesis_complete')) {
      console.log('[useHarness] Synthesis complete:', parsed.data)
      setState((prev) => ({
        ...prev,
        currentPass: 'synthesis',
        confidence: parsed.data.confidence,
        trajectory: [...prev.trajectory, parsed.data.confidence],
        tokensUsed: prev.tokensUsed + parsed.data.tokens,
      }))
    } else if (isHarnessEvent(parsed, 'terminating')) {
      console.log('[useHarness] Terminating:', parsed.data.reason)
      // Don't change status yet - wait for complete event
    } else if (isHarnessEvent(parsed, 'complete')) {
      console.log('[useHarness] Harness complete:', parsed.data)
      const result: HarnessResult = {
        sessionId: parsed.data.session_id,
        title: parsed.data.title,
        finalSynthesis: parsed.data.final_synthesis,
        finalConfidence: parsed.data.final_confidence,
        trajectoryAnalysis: parsed.data.trajectory_analysis,
        terminationReason: parsed.data.termination_reason,
        totalDurationMs: parsed.data.total_duration_ms,
        totalTokens: parsed.data.total_tokens,
      }
      setState((prev) => ({
        ...prev,
        status: 'complete',
        confidence: parsed.data.final_confidence,
        trajectory: parsed.data.confidence_trajectory,
        result,
        currentPass: null,
      }))
      // Close connection after completion
      shouldReconnectRef.current = false
      closeConnection()
    } else if (isHarnessEvent(parsed, 'error')) {
      console.error('[useHarness] Harness error:', parsed.data.message)
      const error: ApiError = {
        category: 'server',
        message: parsed.data.message,
        retryable: true,
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        error,
        currentPass: null,
      }))
      shouldReconnectRef.current = false
      closeConnection()
    } else if (isHarnessEvent(parsed, 'pong')) {
      // Keepalive response - no action needed
    }
  }, [closeConnection])

  /**
   * Handle WebSocket error
   */
  const handleError = useCallback(() => {
    console.error('[useHarness] WebSocket error')
    const error: ApiError = {
      category: 'websocket',
      message: 'Connection error. Please check your network and try again.',
      retryable: true,
    }
    setState((prev) => ({
      ...prev,
      status: 'error',
      error,
    }))
  }, [])

  /**
   * Handle WebSocket close
   */
  const handleClose = useCallback((event: CloseEvent) => {
    console.log('[useHarness] WebSocket closed:', event.code, event.reason)
    clearPingInterval()

    // Check if we should attempt reconnection
    if (shouldReconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttemptsRef.current++
      console.log(`[useHarness] Attempting reconnect ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`)

      setState((prev) => ({
        ...prev,
        status: 'connecting',
      }))

      // Delay before reconnect
      setTimeout(() => {
        if (shouldReconnectRef.current && pendingCommandRef.current) {
          connect(pendingCommandRef.current)
        }
      }, RECONNECT_DELAY_MS)
    } else if (shouldReconnectRef.current) {
      // Max reconnect attempts reached
      const error: ApiError = {
        category: 'network',
        message: 'Unable to maintain connection. Please try again later.',
        retryable: true,
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        error,
      }))
      shouldReconnectRef.current = false
    }
  }, [clearPingInterval])

  /**
   * Connect to WebSocket and send run command
   */
  const connect = useCallback((command: HarnessRunCommand) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    const wsUrl = getWsUrl()
    console.log('[useHarness] Connecting to:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useHarness] WebSocket connected')
        reconnectAttemptsRef.current = 0
        startPingInterval()

        // Send the run command
        ws.send(JSON.stringify(command))
      }

      ws.onmessage = handleMessage
      ws.onerror = handleError
      ws.onclose = handleClose
    } catch (err) {
      console.error('[useHarness] Failed to create WebSocket:', err)
      const error: ApiError = {
        category: 'network',
        message: 'Failed to connect to harness server. Is the backend running?',
        detail: err instanceof Error ? err.message : undefined,
        retryable: true,
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        error,
      }))
    }
  }, [handleMessage, handleError, handleClose, startPingInterval])

  // ==========================================================================
  // PUBLIC ACTIONS
  // ==========================================================================

  /**
   * Start a harness run
   */
  const start = useCallback((title: string, claims: Claim[], maxCycles?: number) => {
    // Reset state
    setState({
      ...initialState,
      status: 'connecting',
    })

    // Prepare command
    const command: HarnessRunCommand = {
      action: 'run',
      title,
      claims,
      ...(maxCycles !== undefined && { max_cycles: maxCycles }),
    }

    // Store for potential reconnection
    pendingCommandRef.current = command
    shouldReconnectRef.current = true
    reconnectAttemptsRef.current = 0

    // Connect and send
    connect(command)
  }, [connect])

  /**
   * Cancel the current harness run
   */
  const cancel = useCallback(() => {
    shouldReconnectRef.current = false
    pendingCommandRef.current = null

    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      currentPass: null,
    }))

    closeConnection()
  }, [closeConnection])

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false
      closeConnection()
    }
  }, [closeConnection])

  // ==========================================================================
  // RETURN VALUE
  // ==========================================================================

  const isActive = state.status === 'connecting' || state.status === 'running'

  return {
    ...state,
    actions: { start, cancel },
    isActive,
  }
}

export default useHarness
