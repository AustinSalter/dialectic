/**
 * useSessionWatcher Hook
 *
 * Manages filesystem watcher lifecycle for all sessions.
 * When sessions change (added/removed), starts/stops Rust-side watchers
 * and subscribes to `session-updated-{id}` events to push changes
 * from disk into React state.
 */

import { useEffect, useRef, useCallback } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type { Session } from '../components/Kanban'
import type { BudgetAlert } from './useBudgetMonitor'
import { loadSessionFromRust } from '../lib/storage'

interface UseSessionWatcherOptions {
  sessions: Session[]
  onSessionUpdated: (updated: Session) => void
  onBudgetAlert?: (alert: BudgetAlert) => void
}

interface WatchState {
  unlisten: UnlistenFn
  budgetUnlisten: UnlistenFn
}

export function useSessionWatcher({
  sessions,
  onSessionUpdated,
  onBudgetAlert,
}: UseSessionWatcherOptions) {
  // Track currently watched session IDs → their unlisten handles
  const watchedRef = useRef<Map<string, WatchState>>(new Map())
  // Debounce timers per session
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Track sessions cancelled during async startWatching
  const cancelledRef = useRef<Set<string>>(new Set())
  // Stable refs for callbacks to avoid re-subscribing on every render
  const onSessionUpdatedRef = useRef(onSessionUpdated)
  onSessionUpdatedRef.current = onSessionUpdated
  const onBudgetAlertRef = useRef(onBudgetAlert)
  onBudgetAlertRef.current = onBudgetAlert

  const startWatching = useCallback(async (sessionId: string) => {
    // Clear any previous cancellation for this ID (session re-added)
    cancelledRef.current.delete(sessionId)

    // Tell Rust to start the filesystem watcher
    try {
      await invoke('watch_session', { sessionId })
    } catch (err) {
      console.warn(`Failed to start watcher for ${sessionId}:`, err)
      return
    }

    // Check if session was removed while we were awaiting
    if (cancelledRef.current.has(sessionId)) {
      cancelledRef.current.delete(sessionId)
      invoke('unwatch_session', { sessionId }).catch(() => {})
      return
    }

    // Subscribe to session-updated events
    const unlisten = await listen<{ sessionId: string }>(
      `session-updated-${sessionId}`,
      (_event) => {
        // Debounce: atomic writes can fire multiple events
        const existing = debounceRef.current.get(sessionId)
        if (existing) clearTimeout(existing)

        debounceRef.current.set(
          sessionId,
          setTimeout(async () => {
            debounceRef.current.delete(sessionId)
            const updated = await loadSessionFromRust(sessionId)
            if (updated) {
              onSessionUpdatedRef.current(updated)
            }
          }, 300)
        )
      }
    )

    // Always subscribe to budget alerts; check ref at call-time
    const budgetUnlisten = await listen<BudgetAlert>(
      `budget-alert-${sessionId}`,
      (event) => {
        onBudgetAlertRef.current?.(event.payload)
      }
    )

    // Final cancellation check after all async work
    if (cancelledRef.current.has(sessionId)) {
      cancelledRef.current.delete(sessionId)
      unlisten()
      budgetUnlisten()
      invoke('unwatch_session', { sessionId }).catch(() => {})
      return
    }

    watchedRef.current.set(sessionId, { unlisten, budgetUnlisten })
  }, [])

  const stopWatching = useCallback(async (sessionId: string) => {
    // Mark as cancelled so in-flight startWatching cleans up
    cancelledRef.current.add(sessionId)

    const state = watchedRef.current.get(sessionId)
    if (state) {
      state.unlisten()
      state.budgetUnlisten()
      watchedRef.current.delete(sessionId)
    }

    // Clear any pending debounce
    const timer = debounceRef.current.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      debounceRef.current.delete(sessionId)
    }

    // Tell Rust to stop the filesystem watcher (idempotent)
    try {
      await invoke('unwatch_session', { sessionId })
    } catch {
      // Rust unwatch is idempotent, but catch network/IPC errors
    }
  }, [])

  useEffect(() => {
    const currentIds = new Set(sessions.map((s) => s.id))
    const watchedIds = new Set(watchedRef.current.keys())

    // Start watching new sessions
    for (const id of currentIds) {
      if (!watchedIds.has(id)) {
        startWatching(id)
      }
    }

    // Stop watching removed sessions
    for (const id of watchedIds) {
      if (!currentIds.has(id)) {
        stopWatching(id)
      }
    }
  }, [sessions, startWatching, stopWatching])

  // Cleanup all watchers on unmount
  useEffect(() => {
    return () => {
      for (const [sessionId, state] of watchedRef.current.entries()) {
        state.unlisten()
        state.budgetUnlisten()
        invoke('unwatch_session', { sessionId }).catch(() => {})
      }
      watchedRef.current.clear()

      for (const timer of debounceRef.current.values()) {
        clearTimeout(timer)
      }
      debounceRef.current.clear()
    }
  }, [])
}
