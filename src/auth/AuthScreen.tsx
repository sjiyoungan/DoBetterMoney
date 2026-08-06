import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/auth/AuthProvider"
import type { UserRole } from "@/types/budget"

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("liz")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const message =
      mode === "signin"
        ? await signIn(username, password)
        : await signUp(email, username, password, role)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">DoBetterMoney</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in with username and password"
              : "Create an account"}
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]+"
              title="3–24 characters: letters, numbers, underscore"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {mode === "signup" ? (
            <div className="space-y-2">
              <Label>I am</Label>
              <div className="flex rounded-lg border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  variant={role === "liz" ? "default" : "ghost"}
                  onClick={() => setRole("liz")}
                >
                  Liz
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  variant={role === "ji" ? "default" : "ghost"}
                  onClick={() => setRole("ji")}
                >
                  Ji
                </Button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}

          <Button type="submit" className="h-10 w-full" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setMode("signup")
                  setError(null)
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setMode("signin")
                  setError(null)
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
