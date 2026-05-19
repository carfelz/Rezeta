import type { ProtocolUsageModifications } from '../types/consultation.js'

/**
 * Derive a `checkedState` map from the rich `modifications` event log.
 *
 * This is the authoritative derivation so all consumers compute the same
 * boolean lookup from the same source. Phase 1: available for use.
 * Phase 2: replace direct `usage.checkedState` reads with this.
 *
 * Key conventions matching the existing `checkedState` contract:
 *   - step completed: `stepId → true`
 *   - step skipped:   `${stepId}:skipped → true`
 *   - checklist item: `itemId → checked` (last event wins)
 *   - decision branch: `branchId → true`
 */
export function getCheckedStateFromModifications(
  modifications: ProtocolUsageModifications,
): Record<string, boolean> {
  const state: Record<string, boolean> = {}

  for (const ev of modifications.steps_completed ?? []) {
    state[ev.step_id] = true
  }

  for (const ev of modifications.steps_skipped ?? []) {
    state[`${ev.step_id}:skipped`] = true
  }

  for (const ev of modifications.checklist_items ?? []) {
    state[ev.item_id] = ev.checked
  }

  for (const ev of modifications.decision_branches ?? []) {
    state[ev.branch_id] = true
  }

  return state
}
