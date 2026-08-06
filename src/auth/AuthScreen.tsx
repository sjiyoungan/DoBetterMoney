import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/auth/AuthProvider"
import type { UserRole } from "@/types/budget"

/** Soft, minimal money mark — rounded stroke, not a classic sharp $ */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#1A1A1A" />
      <path
        d="M19.6 11.2c-.35-1.15-1.55-1.85-3.6-1.85-2.15 0-3.55.95-3.55 2.45 0 1.35.9 2.05 3.35 2.55l.9.18c2.55.5 3.85 1.4 3.85 3.35 0 2.05-1.7 3.35-4.35 3.35-2.3 0-3.85-1-4.35-2.7"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 8.25v15.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

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
          <div className="mb-10 flex items-center justify-center gap-3 motion-safe:animate-[auth-fade_0.7s_ease-out_both]">
            <BrandMark className="size-11 shrink-0" />
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-neutral-950 sm:text-[1.85rem]">
              DoBetterMoney
            </h1>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === "signup" ? (
              <div className="space-y-2 motion-safe:animate-[auth-rise_0.35s_ease-out_both]">
                <Label htmlFor="email" className="text-neutral-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm shadow-none"
                  placeholder="you@email.com"
                  required
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-neutral-700">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm shadow-none"
                placeholder="liz"
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                title="3–24 characters: letters, numbers, underscore"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm shadow-none"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {mode === "signup" ? (
              <div className="space-y-2 motion-safe:animate-[auth-rise_0.35s_ease-out_both]">
                <Label className="text-neutral-700">I am</Label>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-neutral-200 bg-white p-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 flex-1 rounded-lg"
                    variant={role === "liz" ? "default" : "ghost"}
                    onClick={() => setRole("liz")}
                  >
                    Liz
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 flex-1 rounded-lg"
                    variant={role === "ji" ? "default" : "ghost"}
                    onClick={() => setRole("ji")}
                  >
                    Ji
                  </Button>
                </div>
              </div>
            ) : null}

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

      <footer className="relative z-10 pb-6 text-center text-xs text-neutral-400 motion-safe:animate-[auth-fade_1s_ease-out_both]">
        dobettermoney.com
      </footer>

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
