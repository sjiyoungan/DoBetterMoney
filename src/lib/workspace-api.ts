import { emptyWorkspace } from "@/data/empty"
import { supabase } from "@/lib/supabase"
import { normalizeWorkspace } from "@/lib/year-workspace"
import type { BudgetWorkspace } from "@/types/budget"

export type WorkspaceState = {
  id: string
  workspace: BudgetWorkspace
  doneKeys: string[]
}

export async function loadOrCreateWorkspace(
  userId: string,
): Promise<WorkspaceState> {
  const { data: existing, error: selectError } = await supabase
    .from("budget_workspace")
    .select("id, data, done_keys")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
    const doneKeysCol = (existing.done_keys as string[] | null) ?? []
    const workspace = normalizeWorkspace(existing.data, doneKeysCol)
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
    workspace: normalizeWorkspace(created.data, []),
    doneKeys: [],
  }
}

export async function saveWorkspace(
  workspaceId: string,
  workspace: BudgetWorkspace,
  doneKeys: string[],
  userId: string,
) {
  // Keep active year doneKeys in sync inside the JSON payload
  const activeKey = String(workspace.activeYear)
  const years = {
    ...workspace.years,
    [activeKey]: {
      ...(workspace.years[activeKey] ?? {
        paychecks: [],
        buckets: [],
        holderSplits: [],
        withdrawals: [],
        holderBalances: {},
        doneKeys: [],
      }),
      doneKeys,
    },
  }
  const payload: BudgetWorkspace = { ...workspace, years }

  const { error } = await supabase
    .from("budget_workspace")
    .update({
      data: payload,
      done_keys: doneKeys,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId)

  if (error) throw error
}
