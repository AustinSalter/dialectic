/**
 * useBudgetMonitor Hook
 *
 * Monitors budget alerts for a session and optionally auto-injects
 * compression commands when thresholds are exceeded.
 */

import { useEffect, useCallback } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export interface BudgetAlert {
  sessionId: string
  status: 'normal' | 'auto_compress' | 'warn_user' | 'force_compress'
  percentage: number
  used: number
  total: number
}

export interface UseBudgetMonitorOptions {
  /** Session ID to monitor */
  sessionId: string
  /** Callback when budget alert is received */
  onAlert?: (alert: BudgetAlert) => void
  /** Auto-inject /brief compact when force_compress threshold is reached */
  autoCompact?: boolean
}

/**
 * Monitor budget alerts for a session.
 *
 * @example
 * ```tsx
 * useBudgetMonitor({
 *   sessionId: 'sess_123',
 *   onAlert: (alert) => {
 *     if (alert.status === 'warn_user') {
 *       showNotification('Budget warning: ' + alert.percentage + '%')
 *     }
 *   },
 *   autoCompact: true  // Auto-inject /brief compact on force_compress
 * })
 * ```
 */
export function useBudgetMonitor({
  sessionId,
  onAlert,
  autoCompact = false,
}: UseBudgetMonitorOptions) {
  const handleAlert = useCallback(
    async (alert: BudgetAlert) => {
      // Call user's callback first
      onAlert?.(alert)

      // Auto-inject compact command if enabled and force_compress threshold reached
      if (autoCompact && alert.status === 'force_compress') {
        try {
          // Use alert.sessionId consistently - this is the session that triggered the alert
          await invoke('write_to_terminal', {
            sessionId: alert.sessionId,
            data: '/brief compact --tier 4\n',
          })
          console.log('Auto-injected /brief compact for session:', alert.sessionId)
        } catch (err) {
          console.warn('Failed to auto-inject compact command:', err)
        }
      }
    },
    [onAlert, autoCompact]
  )

  useEffect(() => {
    if (!sessionId) return

    let unlisten: UnlistenFn | undefined
    let isMounted = true

    const setup = async () => {
      const eventName = `budget-alert-${sessionId}`
      const unlistenFn = await listen<BudgetAlert>(eventName, (event) => {
        handleAlert(event.payload)
      })
      // Only store unlisten if still mounted
      if (isMounted) {
        unlisten = unlistenFn
      } else {
        // Cleanup immediately if unmounted during setup
        unlistenFn()
      }
    }

    setup().catch((err) => {
      console.error('Failed to setup budget monitor:', err)
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [sessionId, handleAlert])
}

/**
 * Inject a /brief resume command into a terminal session.
 *
 * @param sessionId - The session ID to inject the command into
 * @param dialecticSessionId - The Dialectic session ID to resume (may be different from terminal session)
 */
export async function injectBriefResume(
  sessionId: string,
  dialecticSessionId: string
): Promise<void> {
  await invoke('write_to_terminal', {
    sessionId,
    data: `/brief resume ${dialecticSessionId}\n`,
  })
}

/**
 * Inject a /brief budget command into a terminal session.
 *
 * @param sessionId - The session ID to inject the command into
 */
export async function injectBriefBudget(sessionId: string): Promise<void> {
  await invoke('write_to_terminal', {
    sessionId,
    data: '/brief budget\n',
  })
}

/**
 * Inject a /brief compact command into a terminal session.
 *
 * @param sessionId - The session ID to inject the command into
 * @param tier - Optional tier to target (1-5)
 */
export async function injectBriefCompact(
  sessionId: string,
  tier?: number
): Promise<void> {
  const command = tier ? `/brief compact --tier ${tier}\n` : '/brief compact\n'
  await invoke('write_to_terminal', {
    sessionId,
    data: command,
  })
}
