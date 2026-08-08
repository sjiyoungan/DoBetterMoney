import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider, useAuth } from "@/auth/AuthProvider"
import { AuthScreen } from "@/auth/AuthScreen"
import { supabaseConfigured } from "@/lib/supabase"
import App from "./App.tsx"
import "./index.css"

function MissingConfig() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 bg-page px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">DoBetterMoney</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        Supabase isn’t configured for this deploy. Add{" "}
        <code className="text-neutral-800">VITE_SUPABASE_URL</code> and{" "}
        <code className="text-neutral-800">VITE_SUPABASE_ANON_KEY</code> in
        Vercel, then redeploy.
      </p>
    </div>
  )
}

function Root() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!session) return <AuthScreen />
  return <App />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {supabaseConfigured ? (
      <AuthProvider>
        <Root />
      </AuthProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
)
