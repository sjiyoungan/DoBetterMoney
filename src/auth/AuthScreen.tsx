import { useState, type FormEvent } from "react"
import { BrandMark } from "@/components/BrandMark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/auth/AuthProvider"

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const message =
      mode === "signin"
        ? await signIn(username, password)
        : await signUp(email, username, password)
    setBusy(false)
    if (message) setError(message)
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next)
    setError(null)
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#FAFBFC] text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,0,0,0.045),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-black/[0.03] blur-3xl motion-safe:animate-[auth-glow_10s_ease-in-out_infinite]"
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[22rem] motion-safe:animate-[auth-rise_0.55s_ease-out_both]">
          <div className="mb-10 flex items-center justify-center motion-safe:animate-[auth-fade_0.7s_ease-out_both]">
            <BrandMark className="size-12 shrink-0" />
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === "signup" ? (
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm shadow-none motion-safe:animate-[auth-rise_0.35s_ease-out_both]"
                placeholder="Email"
                required
              />
            ) : null}

            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm shadow-none"
              placeholder="Username"
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]+"
              title="3–24 characters: letters, numbers, underscore"
              required
            />

            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm shadow-none"
              placeholder="Password"
              minLength={6}
              required
            />

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-11 w-full rounded-xl bg-neutral-950 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-neutral-500">
            {mode === "signin" ? (
              <button
                type="button"
                className="text-neutral-600 underline-offset-4 transition-colors hover:text-neutral-950 hover:underline"
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            ) : (
              <button
                type="button"
                className="text-neutral-600 underline-offset-4 transition-colors hover:text-neutral-950 hover:underline"
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
            )}
          </p>
        </div>
      </main>

      <style>{`
        @keyframes auth-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes auth-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes auth-glow {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.7; }
          50% { transform: translateX(-50%) scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
