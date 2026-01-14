/**
 * Shared types for Dialectic
 * These types are used across web, desktop, and workbench packages
 */

// Claim types
export type ClaimType = 'core_thesis' | 'framework' | 'meta' | 'counter'

export interface Claim {
  id: string
  text: string
  type: ClaimType
  snippet: string
  quote_start: number
  quote_end: number
}

// Pass types
export type PassType = 'expansion' | 'compression' | 'critique' | 'synthesis'

// Harness event types (for WebSocket streaming)
export type HarnessEventType =
  | 'started'
  | 'pass_started'
  | 'pass_progress'
  | 'pass_completed'
  | 'completed'
  | 'error'

export interface HarnessEvent {
  type: HarnessEventType
  pass_type?: PassType
  cycle?: number
  max_cycles?: number
  content?: string
  confidence?: number
  thesis_draft?: string
  accumulated_context?: string
  error?: string
}

// Session types
export interface Session {
  id: string
  title: string
  status: 'exploring' | 'tensions' | 'resolved' | 'formed'
  tensionCount: number
  lastUpdated: Date
  claims?: Claim[]
}

// Tension types
export interface Tension {
  id: string
  title: string
  description: string
  resolved: boolean
  resolution?: string
}

// Trigger types (for thesis monitoring)
export type TriggerType = 'disconfirming' | 'environmental' | 'time_bound' | 'assumption'

export interface Trigger {
  type: TriggerType
  condition: string
  fired: boolean
  firedAt?: Date
}
