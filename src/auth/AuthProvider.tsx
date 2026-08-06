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
import { isValidUsername, normalizeUsername } from "@/lib/auth-identity"
import { supabase, type ProfileRow } from "@/lib/supabase"
import type { UserRole } from "@/types/budget"

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  loading: boolean
  signIn: (usernameOrEmail: string, password: string) => Promise<string | null>
  signUp: (
    email: string,
    username: string,
    password: string,
    preferredRole?: UserRole,
  ) => Promise<string | null>
  signOut: () => Promise<void>
  setPreferredRole: (role: UserRole) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SCHEMA_HINT =
  "Database isn’t set up yet. In Supabase → SQL Editor, run supabase/schema.sql, then try again."

function isMissingUsernameFn(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST202" ||
    /get_email_for_username/i.test(error.message)
  )
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function resolveEmailForLogin(usernameOrEmail: string) {
  const raw = usernameOrEmail.trim()
  if (raw.includes("@")) {
    return { email: raw.toLowerCase(), error: null as string | null }
  }

  const normalized = normalizeUsername(raw)
  if (!isValidUsername(normalized)) {
    return {
      email: null,
      error: "Username must be 3–24 characters: letters, numbers, underscore.",
    }
  }

  const { data: email, error } = await supabase.rpc("get_email_for_username", {
    p_username: normalized,
  })

  if (error) {
    return {
      email: null,
      error: isMissingUsernameFn(error) ? SCHEMA_HINT : error.message,
    }
  }

  if (!email || typeof email !== "string") {
    return { email: null, error: "Invalid username or password." }
  }

  return { email, error: null }
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

  const signIn = useCallback(async (usernameOrEmail: string, password: string) => {
    const { email, error: resolveError } =
      await resolveEmailForLogin(usernameOrEmail)
    if (resolveError) return resolveError
    if (!email) return "Invalid username or password."

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return error ? "Invalid username or password." : null
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      username: string,
      password: string,
      preferredRole: UserRole = "liz",
    ) => {
      const normalized = normalizeUsername(username)
      if (!isValidUsername(normalized)) {
        return "Username must be 3–24 characters: letters, numbers, underscore."
      }

      const trimmedEmail = email.trim().toLowerCase()
      if (!trimmedEmail.includes("@")) {
        return "Enter a valid email."
      }

      const { data: existingEmail, error: existingError } = await supabase.rpc(
        "get_email_for_username",
        { p_username: normalized },
      )
      if (existingError) {
        if (!isMissingUsernameFn(existingError)) return existingError.message
      } else if (existingEmail) {
        return "That username is already taken."
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            username: normalized,
            preferred_role: preferredRole,
          },
        },
      })
      if (error) return error.message

      // Land on dashboard immediately (needs Confirm email = OFF in Supabase)
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (signInError) {
          return "Account created, but email confirmation is still required. Turn OFF Confirm email in Supabase → Authentication → Providers → Email."
        }
      }

      return null
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
