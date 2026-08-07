import { emptyWorkspace, emptyYearBudget } from "@/data/empty"
import { supabase } from "@/lib/supabase"
import { normalizeWorkspace } from "@/lib/year-workspace"
import type { BudgetWorkspace, Category, YearBudget } from "@/types/budget"

export type WorkspaceState = {
  id: string
  workspace: BudgetWorkspace
  doneKeys: string[]
}

/** Stable fingerprint of every allocation cell — used to verify saves. */
export function allocationsFingerprint(workspace: BudgetWorkspace): string {
  const parts: string[] = []
  const yearKeys = Object.keys(workspace.years).sort()
  for (const yk of yearKeys) {
    const slice = workspace.years[yk]
    if (!slice) continue
    for (const bucket of slice.buckets) {
      for (const cat of bucket.categories) {
        const dates = Object.keys(cat.allocations ?? {}).sort()
        for (const date of dates) {
          const raw = cat.allocations[date]
          const value =
            raw === "" || raw === undefined || Number(raw) === 0 ? "" : String(raw)
          parts.push(`${yk}:${cat.id}:${date}=${value}`)
        }
      }
    }
  }
  return parts.join("|")
}

function sanitizeAmount(v: unknown): number | "" {
  if (v === "" || v === null || v === undefined) return ""
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n) || n === 0) return ""
  return n
}

/** Normalize allocation values without adding/removing schedule dates. */
export function sanitizeWorkspaceAllocations(
  workspace: BudgetWorkspace,
): BudgetWorkspace {
  const years: Record<string, YearBudget> = {}
  for (const [key, slice] of Object.entries(workspace.years)) {
    years[key] = {
      ...emptyYearBudget(),
      ...slice,
      buckets: (slice.buckets ?? []).map((bucket) => ({
        ...bucket,
        categories: bucket.categories.map((cat: Category) => {
          const allocations: Record<string, number | ""> = {}
          for (const [date, amount] of Object.entries(cat.allocations ?? {})) {
            allocations[date] = sanitizeAmount(amount)
          }
          return { ...cat, allocations }
        }),
      })),
      doneKeys: slice.doneKeys ?? [],
    }
  }
  return { ...workspace, years }
}

export async function loadOrCreateWorkspace(
  userId: string,
): Promise<WorkspaceState> {
  const { data: rows, error: selectError } = await supabase
    .from("budget_workspace")
    .select("id, data, done_keys, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)

  if (selectError) throw selectError

  const existing = rows?.[0]
  if (existing) {
    const doneKeysCol = (existing.done_keys as string[] | null) ?? []
    const workspace = sanitizeWorkspaceAllocations(
      normalizeWorkspace(existing.data, doneKeysCol),
    )
    const active =
      workspace.years[String(workspace.activeYear)]?.doneKeys ?? doneKeysCol
    return {
      id: existing.id as string,
      workspace,
      doneKeys: active,
    }
  }

  const workspace = emptyWorkspace
  const { data: created, error: insertError } = await supabase
    .from("budget_workspace")
    .insert({
      name: "DoBetterMoney",
      data: workspace,
      done_keys: [],
      updated_by: userId,
    })
    .select("id, data, done_keys")
    .single()

  if (insertError) throw insertError

  return {
    id: created.id as string,
    workspace: sanitizeWorkspaceAllocations(
      normalizeWorkspace(created.data, []),
    ),
    doneKeys: [],
  }
}

export async function saveWorkspace(
  workspaceId: string,
  workspace: BudgetWorkspace,
  doneKeys: string[],
  userId: string,
) {
  const activeKey = String(workspace.activeYear)
  const years = {
    ...workspace.years,
    [activeKey]: {
      ...(workspace.years[activeKey] ?? emptyYearBudget()),
      doneKeys,
    },
  }
  const payload = sanitizeWorkspaceAllocations({ ...workspace, years })
  const expected = allocationsFingerprint(payload)

  const { data, error } = await supabase
    .from("budget_workspace")
    .update({
      data: payload,
      done_keys: doneKeys,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId)
    .select("id, data")
    .maybeSingle()

  if (error) throw error
  if (!data?.id) {
    throw new Error(
      "Save didn’t update the workspace row. Try signing out and back in.",
    )
  }

  const roundTrip = sanitizeWorkspaceAllocations(
    normalizeWorkspace(data.data, doneKeys),
  )
  const actual = allocationsFingerprint(roundTrip)
  if (actual !== expected) {
    throw new Error(
      "Save verification failed — stored grid didn’t match what we wrote. Try again.",
    )
  }
}
