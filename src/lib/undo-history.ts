import type { BudgetWorkspace } from "@/types/budget"

/** Plenty for this app — workspace snapshots are small (typically well under 1MB each). */
export const MAX_UNDO_STEPS = 20

export type UndoSnapshot = {
  workspace: BudgetWorkspace
  doneKeys: string[]
}

export function cloneUndoSnapshot(
  workspace: BudgetWorkspace,
  doneKeys: Iterable<string>,
): UndoSnapshot {
  return {
    workspace: structuredClone(workspace),
    doneKeys: [...doneKeys],
  }
}

export function pushUndoSnapshot(
  stack: UndoSnapshot[],
  snapshot: UndoSnapshot,
  limit = MAX_UNDO_STEPS,
): UndoSnapshot[] {
  const next = [...stack, snapshot]
  if (next.length <= limit) return next
  return next.slice(next.length - limit)
}
