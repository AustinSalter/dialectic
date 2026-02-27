/**
 * Kanban Types
 * Core session types used throughout the app
 */

export type SessionState = 'backlog' | 'exploring' | 'tensions' | 'synthesizing' | 'formed'
export type SessionCategory = 'geopolitical' | 'market-structure' | 'ai-infrastructure' | 'energy-power' | 'operational'
export type SessionMode = 'idea' | 'decision'

export interface Session {
  id: string
  title: string
  category: SessionCategory
  state: SessionState
  mode: SessionMode
  claimCount: number
  tensionCount: number
  summary?: string
  createdAt: Date
  updatedAt: Date
  // Fields from Rust backend
  parentSessionId?: string
  conversationId?: string
  passCount: number
  confidenceScore?: number
  contextFileCount: number
  isProjectLocal: boolean
  workingDir?: string
  thesisPreview?: string
}

export const stateLabels: Record<SessionState, string> = {
  backlog: 'Spark',
  exploring: 'Shape',
  tensions: 'Stress-Test',
  synthesizing: 'Sharpen',
  formed: 'Ship',
}
