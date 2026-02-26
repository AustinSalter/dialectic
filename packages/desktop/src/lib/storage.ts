/**
 * Local storage for sessions and user profile management
 */

import type { Session, SessionState, SessionCategory, SessionMode } from '../components/Kanban'
import { invoke } from '@tauri-apps/api/core'

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
    // Defaults for fields added in Phase 1 (may be absent in older localStorage data)
    passCount: data.passCount ?? 0,
    contextFileCount: data.contextFileCount ?? 0,
    isProjectLocal: data.isProjectLocal ?? false,
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


// --- Rust Backend Session Loading ---

/** Shape of a Session as returned by the Rust `list_sessions` command (camelCase serde) */
interface RustSession {
  id: string
  title: string
  status: string    // "backlog" | "exploring" | "tensions" | "synthesizing" | "formed"
  mode: string      // "idea" | "decision"
  workingDir: string
  isProjectLocal: boolean
  created: string   // ISO 8601
  updated: string   // ISO 8601
  claims: unknown[]
  tensions: unknown[]
  passes: unknown[]
  contextFiles: unknown[]
  thesis?: { content: string; confidence: number; updatedAt: string }
  conversationId?: string
  category?: string
  summary?: string
}

const VALID_STATES: SessionState[] = ['backlog', 'exploring', 'tensions', 'synthesizing', 'formed']
const VALID_CATEGORIES: SessionCategory[] = ['geopolitical', 'market-structure', 'ai-infrastructure', 'energy-power', 'operational']

export function mapRustSession(rs: RustSession): Session {
  const state = VALID_STATES.includes(rs.status as SessionState)
    ? (rs.status as SessionState)
    : 'backlog'
  const category = VALID_CATEGORIES.includes(rs.category as SessionCategory)
    ? (rs.category as SessionCategory)
    : 'operational'

  return {
    id: rs.id,
    title: rs.title,
    category,
    state,
    mode: (rs.mode === 'decision' ? 'decision' : 'idea') as SessionMode,
    claimCount: rs.claims?.length ?? 0,
    tensionCount: rs.tensions?.length ?? 0,
    summary: rs.summary,
    createdAt: new Date(rs.created),
    updatedAt: new Date(rs.updated),
    passCount: rs.passes?.length ?? 0,
    confidenceScore: rs.thesis?.confidence,
    contextFileCount: rs.contextFiles?.length ?? 0,
    isProjectLocal: rs.isProjectLocal,
    workingDir: rs.workingDir,
    conversationId: rs.conversationId,
    thesisPreview: rs.thesis?.content?.slice(0, 80),
  }
}

/**
 * Load a single session by ID from the Rust backend.
 * Used by the watcher event handler to reload a session after file changes.
 */
export async function loadSessionFromRust(sessionId: string): Promise<Session | null> {
  try {
    const rs = await invoke<RustSession>('load_session', { sessionId })
    return mapRustSession(rs)
  } catch (err) {
    console.warn('Failed to load session from Rust:', err)
    return null
  }
}

/**
 * Load sessions from the Rust backend (single source of truth).
 * Falls back to localStorage if the Rust invoke fails (e.g. running outside Tauri).
 * Writes loaded sessions to localStorage as cache.
 */
export async function loadSessionsFromRust(): Promise<Session[]> {
  try {
    const rustSessions = await invoke<RustSession[]>('list_sessions')
    const sessions = rustSessions.map(mapRustSession)
    // Cache in localStorage
    saveSessions(sessions)
    return sessions
  } catch (err) {
    console.warn('Failed to load sessions from Rust, falling back to localStorage:', err)
    return loadSessions()
  }
}

// --- Rust-backed mutation helpers ---

/** Map frontend SessionState to Rust SessionStatus enum value */
const stateToRustStatus: Record<SessionState, string> = {
  backlog: 'backlog',
  exploring: 'exploring',
  tensions: 'tensions',
  synthesizing: 'synthesizing',
  formed: 'formed',
}

/**
 * Move a session to a new status via Rust (atomic read-modify-write on disk).
 * Returns the updated Session (with fresh counts from disk) or null on failure.
 */
export async function moveSessionViaRust(sessionId: string, newState: SessionState): Promise<Session | null> {
  try {
    const rs = await invoke<RustSession>('update_session_status', {
      sessionId,
      status: stateToRustStatus[newState],
    })
    return mapRustSession(rs)
  } catch (err) {
    console.error('moveSessionViaRust failed:', err)
    return null
  }
}

/**
 * Delete a session via Rust (removes sess_{id}/ directory from disk).
 * Returns true on success, false on failure.
 */
export async function deleteSessionViaRust(sessionId: string): Promise<boolean> {
  try {
    await invoke('delete_session', { sessionId })
    return true
  } catch (err) {
    console.error('deleteSessionViaRust failed:', err)
    return false
  }
}

// --- Launch Pipeline ---

export interface LaunchContext {
  workingDir: string
  sessionDir: string
  conversationId: string | null
  claudeCommand: string[]
  envVars: Record<string, string>
}

/**
 * Prepare a session for launching Claude Code.
 * Writes CLAUDE.md to session dir, updates last_resumed, returns launch context.
 */
export async function prepareLaunch(sessionId: string): Promise<LaunchContext> {
  return invoke<LaunchContext>('prepare_launch', { sessionId })
}

/**
 * Create a new session via Rust. Returns the mapped Session or null on failure.
 */
export async function createSessionViaRust(input: {
  title: string
  mode?: SessionMode
  workingDir?: string
  category?: string
  summary?: string
}): Promise<Session | null> {
  try {
    const rs = await invoke<RustSession>('create_session', {
      input: {
        title: input.title,
        mode: input.mode ?? 'idea',
        workingDir: input.workingDir ?? null,
        category: input.category ?? null,
        summary: input.summary ?? null,
      },
    })
    return mapRustSession(rs)
  } catch (err) {
    console.error('createSessionViaRust failed:', err)
    return null
  }
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
