/**
 * Trigger Monitor - Monitor thesis triggers and update confidence
 *
 * Implements ongoing thesis monitoring per EXP-010:
 * - Track trigger conditions
 * - Update confidence when triggers fire
 * - Support non-monotonic confidence trajectories
 */

import {
  type ThesisDocument,
  type Trigger,
  loadThesisDocument,
  saveThesisDocument,
  getThesisIds,
} from './synthesis'

export interface TriggerEvaluation {
  thesisId: string
  triggerId: number
  triggered: boolean
  reason?: string
  newConfidence?: number
}

export interface MonitoringResult {
  thesisId: string
  triggersFired: number
  confidenceChange: number
  updatedDocument: ThesisDocument
}

/**
 * Calculate confidence impact when a trigger fires
 */
function calculateConfidenceImpact(trigger: Trigger, currentConfidence: number): number {
  // Impact varies by trigger type
  const impacts: Record<Trigger['type'], number> = {
    disconfirming: -0.15, // Strong negative impact
    environmental: -0.10, // Moderate negative
    assumption: -0.12, // Moderate negative
    time_bound: -0.08, // Mild negative (might just need update)
  }

  const impact = impacts[trigger.type] || -0.10

  // Apply impact, floor at 0.1
  return Math.max(0.1, currentConfidence + impact)
}

/**
 * Fire a trigger and update thesis confidence
 */
export function fireTrigger(
  doc: ThesisDocument,
  triggerIndex: number,
  _reason?: string
): ThesisDocument {
  if (triggerIndex < 0 || triggerIndex >= doc.triggers.length) {
    return doc
  }

  const trigger = doc.triggers[triggerIndex]
  if (trigger.fired) {
    return doc // Already fired
  }

  // Calculate new confidence
  const newConfidence = calculateConfidenceImpact(trigger, doc.confidence)

  // Update document
  const updatedTriggers = [...doc.triggers]
  updatedTriggers[triggerIndex] = {
    ...trigger,
    fired: true,
    firedAt: new Date(),
  }

  const updatedDoc: ThesisDocument = {
    ...doc,
    triggers: updatedTriggers,
    confidence: newConfidence,
    updated: new Date(),
    thesis: {
      ...doc.thesis,
      confidence: newConfidence,
    },
  }

  // Persist
  saveThesisDocument(updatedDoc)

  return updatedDoc
}

/**
 * Unfire a trigger (user realized it wasn't actually triggered)
 */
export function unfireTrigger(
  doc: ThesisDocument,
  triggerIndex: number
): ThesisDocument {
  if (triggerIndex < 0 || triggerIndex >= doc.triggers.length) {
    return doc
  }

  const trigger = doc.triggers[triggerIndex]
  if (!trigger.fired) {
    return doc // Not fired
  }

  // Restore some confidence (not full - there was a reason it fired)
  const impacts: Record<Trigger['type'], number> = {
    disconfirming: 0.10,
    environmental: 0.07,
    assumption: 0.08,
    time_bound: 0.05,
  }
  const recovery = impacts[trigger.type] || 0.07
  const newConfidence = Math.min(0.95, doc.confidence + recovery)

  // Update document
  const updatedTriggers = [...doc.triggers]
  updatedTriggers[triggerIndex] = {
    ...trigger,
    fired: false,
    firedAt: undefined,
  }

  const updatedDoc: ThesisDocument = {
    ...doc,
    triggers: updatedTriggers,
    confidence: newConfidence,
    updated: new Date(),
    thesis: {
      ...doc.thesis,
      confidence: newConfidence,
    },
  }

  // Persist
  saveThesisDocument(updatedDoc)

  return updatedDoc
}

/**
 * Get summary of trigger status for a thesis
 */
export function getTriggerSummary(doc: ThesisDocument): {
  total: number
  fired: number
  byType: Record<Trigger['type'], { total: number; fired: number }>
} {
  const byType: Record<Trigger['type'], { total: number; fired: number }> = {
    disconfirming: { total: 0, fired: 0 },
    environmental: { total: 0, fired: 0 },
    time_bound: { total: 0, fired: 0 },
    assumption: { total: 0, fired: 0 },
  }

  let fired = 0

  for (const trigger of doc.triggers) {
    byType[trigger.type].total++
    if (trigger.fired) {
      byType[trigger.type].fired++
      fired++
    }
  }

  return {
    total: doc.triggers.length,
    fired,
    byType,
  }
}

/**
 * Get all theses that need attention (have fired triggers or low confidence)
 */
export function getThesesNeedingAttention(): ThesisDocument[] {
  const ids = getThesisIds()
  const needsAttention: ThesisDocument[] = []

  for (const id of ids) {
    const doc = loadThesisDocument(id)
    if (!doc) continue

    const summary = getTriggerSummary(doc)

    // Needs attention if:
    // 1. Has fired triggers
    // 2. Confidence dropped below 0.5
    // 3. Has time_bound triggers that might be due
    if (summary.fired > 0 || doc.confidence < 0.5) {
      needsAttention.push(doc)
    }
  }

  return needsAttention
}

/**
 * Check if any time-bound triggers are due
 */
export function checkTimeBoundTriggers(doc: ThesisDocument): Trigger[] {
  const now = new Date()
  const dueTriggers: Trigger[] = []

  for (const trigger of doc.triggers) {
    if (trigger.type !== 'time_bound' || trigger.fired) continue

    // Parse time hints from condition
    const condition = trigger.condition.toLowerCase()

    // Look for patterns like "by Q1 2026", "within 6 months", "by March"
    const monthMatch = condition.match(/by\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?/i)
    const quarterMatch = condition.match(/by\s+q([1-4])\s+(\d{4})/i)
    const relativeMatch = condition.match(/within\s+(\d+)\s+(day|week|month|year)s?/i)

    let dueDate: Date | null = null

    if (monthMatch) {
      const months: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      }
      const month = months[monthMatch[1].toLowerCase()]
      const year = monthMatch[2] ? parseInt(monthMatch[2]) : now.getFullYear()
      dueDate = new Date(year, month + 1, 0) // Last day of month
    } else if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1])
      const year = parseInt(quarterMatch[2])
      const endMonth = quarter * 3 - 1
      dueDate = new Date(year, endMonth + 1, 0)
    } else if (relativeMatch && doc.created) {
      const amount = parseInt(relativeMatch[1])
      const unit = relativeMatch[2].toLowerCase()
      dueDate = new Date(doc.created)

      switch (unit) {
        case 'day':
          dueDate.setDate(dueDate.getDate() + amount)
          break
        case 'week':
          dueDate.setDate(dueDate.getDate() + amount * 7)
          break
        case 'month':
          dueDate.setMonth(dueDate.getMonth() + amount)
          break
        case 'year':
          dueDate.setFullYear(dueDate.getFullYear() + amount)
          break
      }
    }

    if (dueDate && now >= dueDate) {
      dueTriggers.push(trigger)
    }
  }

  return dueTriggers
}

/**
 * Get confidence trajectory for a thesis
 * (Would need historical data - for now returns simple before/after)
 */
export function getConfidenceHistory(doc: ThesisDocument): {
  initial: number
  current: number
  firedTriggers: number
  direction: 'up' | 'down' | 'stable'
} {
  const summary = getTriggerSummary(doc)

  // Estimate initial confidence (before any triggers fired)
  // Each fired trigger roughly corresponds to the impact
  let estimatedInitial = doc.confidence
  for (const trigger of doc.triggers) {
    if (trigger.fired) {
      const impacts: Record<Trigger['type'], number> = {
        disconfirming: 0.15,
        environmental: 0.10,
        assumption: 0.12,
        time_bound: 0.08,
      }
      estimatedInitial += impacts[trigger.type] || 0.10
    }
  }
  estimatedInitial = Math.min(0.95, estimatedInitial)

  const delta = doc.confidence - estimatedInitial
  const direction = delta > 0.03 ? 'up' : delta < -0.03 ? 'down' : 'stable'

  return {
    initial: estimatedInitial,
    current: doc.confidence,
    firedTriggers: summary.fired,
    direction,
  }
}

/**
 * Suggest thesis review based on age and trigger status
 */
export function shouldReviewThesis(doc: ThesisDocument): {
  shouldReview: boolean
  reason?: string
} {
  const daysSinceUpdate = Math.floor(
    (Date.now() - doc.updated.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Check for fired triggers
  const summary = getTriggerSummary(doc)
  if (summary.fired > 0) {
    return {
      shouldReview: true,
      reason: `${summary.fired} trigger(s) have fired since last review`,
    }
  }

  // Check for low confidence
  if (doc.confidence < 0.4) {
    return {
      shouldReview: true,
      reason: 'Confidence has dropped below 40%',
    }
  }

  // Check for due time-bound triggers
  const dueTriggers = checkTimeBoundTriggers(doc)
  if (dueTriggers.length > 0) {
    return {
      shouldReview: true,
      reason: `${dueTriggers.length} time-bound trigger(s) may be due`,
    }
  }

  // Periodic review - every 30 days for active theses
  if (doc.confidence >= 0.5 && daysSinceUpdate > 30) {
    return {
      shouldReview: true,
      reason: `Last reviewed ${daysSinceUpdate} days ago`,
    }
  }

  return { shouldReview: false }
}
