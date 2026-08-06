import { createClient } from "@supabase/supabase-js"
import type { BudgetWorkspace, UserRole } from "@/types/budget"

export type ProfileRow = {
  id: string
  email: string | null
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

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
  )
}

export const supabase = createClient(url, anonKey)
