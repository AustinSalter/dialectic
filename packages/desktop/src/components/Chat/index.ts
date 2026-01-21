/**
 * Chat Types
 * Types for chat/interview interactions
 */

import type { Claim } from '../../lib/ingest'
import type { Question } from '../../lib/interview'

export interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  content: string
  claim?: Claim & { source: string }
  question?: Question
  timestamp: Date
}

export interface UserResponse {
  questionId: string
  selectedOption?: number
  freeText?: string
}
