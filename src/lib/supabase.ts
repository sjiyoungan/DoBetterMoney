import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { BudgetWorkspace, UserRole } from "@/types/budget"

export type ProfileRow = {
  id: string
  email: string | null
  username: string
  preferred_role: UserRole
  created_at: string
}

export type WorkspaceRow = {
  id: string
  name: string
  data: BudgetWorkspace
  done_keys: string[]
  updated_at: string
  updated_by: string | null
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : (null as unknown as SupabaseClient)
