import { emptyWorkspace } from "@/data/empty"
import { supabase } from "@/lib/supabase"
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
    return {
      id: existing.id as string,
      workspace: existing.data as BudgetWorkspace,
      doneKeys: (existing.done_keys as string[] | null) ?? [],
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("budget_workspace")
    .insert({
      name: "DoBetterMoney",
      data: emptyWorkspace,
      done_keys: [],
      updated_by: userId,
    })
    .select("id, data, done_keys")
    .single()

  if (insertError) throw insertError

  return {
    id: created.id as string,
    workspace: created.data as BudgetWorkspace,
    doneKeys: (created.done_keys as string[] | null) ?? [],
  }
}

export async function saveWorkspace(
  workspaceId: string,
  workspace: BudgetWorkspace,
  doneKeys: string[],
  userId: string,
) {
  const { error } = await supabase
    .from("budget_workspace")
    .update({
      data: workspace,
      done_keys: doneKeys,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId)

  if (error) throw error
}
