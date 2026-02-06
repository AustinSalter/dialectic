/**
 * Local storage for sessions and user profile management
 */

import type { Session, SessionState, SessionCategory, SessionMode } from '../components/Kanban'

const STORAGE_KEYS = {
  SESSIONS: 'dialectic_sessions',
  USER_PROFILE: 'dialectic_user_profile',
} as const

// --- User Profile Types ---

export interface UserProfile {
  id: string
  thinkingStyle: {
    preferredFrameworks: string[]
    biasPatterns: string[]
    decisionApproach: string
  }
  communicationStyle: {
    preferredChallengeIntensity: 'gentle' | 'moderate' | 'adversarial'
  }
  observedPatterns: {
    frequentTopics: string[]
    consistentPositions: string[]
    blindSpots: string[]
  }
  notes: Array<{
    content: string
    source: 'user' | 'agent'
    timestamp: Date
  }>
  createdAt: Date
  updatedAt: Date
}

// Serialized version for localStorage
interface SerializedUserProfile extends Omit<UserProfile, 'createdAt' | 'updatedAt' | 'notes'> {
  createdAt: string
  updatedAt: string
  notes: Array<{
    content: string
    source: 'user' | 'agent'
    timestamp: string
  }>
}

// Serialization helpers for Date objects
interface SerializedSession extends Omit<Session, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

function serializeSession(session: Session): SerializedSession {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

function deserializeSession(data: SerializedSession): Session {
  return {
    ...data,
    // Default to 'idea' for backward compatibility with existing sessions
    mode: data.mode || 'idea',
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  }
}

// --- Session Management ---

export function loadSessions(): Session[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (!data) return []
    const parsed: SerializedSession[] = JSON.parse(data)
    return parsed.map(deserializeSession)
  } catch {
    console.warn('Failed to load sessions from storage')
    return []
  }
}

export function saveSessions(sessions: Session[]): void {
  try {
    const serialized = sessions.map(serializeSession)
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(serialized))
  } catch {
    console.warn('Failed to save sessions to storage')
  }
}

export function createSession(partial: {
  title: string
  category: SessionCategory
  summary?: string
  mode?: SessionMode
}): Session {
  const now = new Date()
  return {
    id: `session-${Date.now()}`,
    title: partial.title,
    category: partial.category,
    state: 'backlog' as SessionState,
    mode: partial.mode || 'idea',
    claimCount: 0,
    tensionCount: 0,
    summary: partial.summary,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateSession(sessions: Session[], id: string, updates: Partial<Session>): Session[] {
  return sessions.map(s =>
    s.id === id
      ? { ...s, ...updates, updatedAt: new Date() }
      : s
  )
}

export function deleteSession(sessions: Session[], id: string): Session[] {
  return sessions.filter(s => s.id !== id)
}

// --- User Profile Management ---

function serializeUserProfile(profile: UserProfile): SerializedUserProfile {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    notes: profile.notes.map(n => ({
      ...n,
      timestamp: n.timestamp.toISOString(),
    })),
  }
}

function deserializeUserProfile(data: SerializedUserProfile): UserProfile {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    notes: data.notes.map(n => ({
      ...n,
      timestamp: new Date(n.timestamp),
    })),
  }
}

export function createDefaultUserProfile(): UserProfile {
  const now = new Date()
  return {
    id: `user-${Date.now()}`,
    thinkingStyle: {
      preferredFrameworks: [],
      biasPatterns: [],
      decisionApproach: '',
    },
    communicationStyle: {
      preferredChallengeIntensity: 'moderate',
    },
    observedPatterns: {
      frequentTopics: [],
      consistentPositions: [],
      blindSpots: [],
    },
    notes: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function getUserProfile(): UserProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    if (!data) return null
    const parsed: SerializedUserProfile = JSON.parse(data)
    return deserializeUserProfile(parsed)
  } catch {
    console.warn('Failed to load user profile from storage')
    return null
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    const serialized = serializeUserProfile(profile)
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(serialized))
  } catch {
    console.warn('Failed to save user profile to storage')
  }
}

export function updateUserProfile(updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): UserProfile {
  const existing = getUserProfile() || createDefaultUserProfile()
  const updated: UserProfile = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  }
  saveUserProfile(updated)
  return updated
}

export function addProfileNote(content: string, source: 'user' | 'agent'): UserProfile {
  const existing = getUserProfile() || createDefaultUserProfile()
  const updated: UserProfile = {
    ...existing,
    notes: [
      ...existing.notes,
      { content, source, timestamp: new Date() },
    ],
    updatedAt: new Date(),
  }
  saveUserProfile(updated)
  return updated
}

export function getStorageUsage(): { used: number; available: number } {
  let used = 0
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      used += localStorage.getItem(key)?.length || 0
    }
  }
  // localStorage limit is typically ~5MB
  const available = 5 * 1024 * 1024 - used
  return { used, available }
}
