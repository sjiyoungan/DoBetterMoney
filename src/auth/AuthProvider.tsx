import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase, type ProfileRow } from "@/lib/supabase"
import type { UserRole } from "@/types/budget"

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (
    email: string,
    password: string,
    preferredRole?: UserRole,
  ) => Promise<string | null>
  signOut: () => Promise<void>
  setPreferredRole: (role: UserRole) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      return
    }

    let cancelled = false
    fetchProfile(userId)
      .then((row) => {
        if (!cancelled) setProfile(row as ProfileRow | null)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, preferredRole: UserRole = "liz") => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { preferred_role: preferredRole },
        },
      })
      return error?.message ?? null
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const setPreferredRole = useCallback(
    async (role: UserRole) => {
      const userId = session?.user?.id
      if (!userId) return
      const { data, error } = await supabase
        .from("profiles")
        .update({ preferred_role: role })
        .eq("id", userId)
        .select("*")
        .single()
      if (error) throw error
      setProfile(data as ProfileRow)
    },
    [session?.user?.id],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      setPreferredRole,
    }),
    [session, profile, loading, signIn, signUp, signOut, setPreferredRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
