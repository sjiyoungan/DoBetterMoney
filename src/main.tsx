import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider, useAuth } from "@/auth/AuthProvider"
import { AuthScreen } from "@/auth/AuthScreen"
import App from "./App.tsx"
import "./index.css"

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
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
