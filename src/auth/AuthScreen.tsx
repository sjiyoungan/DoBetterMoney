import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/auth/AuthProvider"
import { cn } from "@/lib/utils"
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

  function switchMode(next: "signin" | "signup") {
    setMode(next)
    setError(null)
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#FAFBFC] text-foreground">
      {/* Soft white atmosphere */}
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
          {/* Brand */}
          <div className="mb-10 flex flex-col items-center text-center motion-safe:animate-[auth-fade_0.7s_ease-out_both]">
            <div className="mb-5 flex size-11 items-center justify-center rounded-[10px] bg-[#1A1A1A] text-white shadow-sm">
              <span className="text-lg font-semibold leading-none">$</span>
            </div>
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-neutral-950 sm:text-[2rem]">
              DoBetterMoney
            </h1>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-neutral-500">
              {mode === "signin"
                ? "Sign in to plan paychecks, bills, and savings together."
                : "Create an account to start budgeting with Liz and Ji."}
            </p>
          </div>

          {/* Mode switch */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-neutral-200/80 bg-white/70 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={cn(
                "h-9 rounded-lg text-sm font-medium transition-colors",
                mode === "signin"
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:text-neutral-900",
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={cn(
                "h-9 rounded-lg text-sm font-medium transition-colors",
                mode === "signup"
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:text-neutral-900",
              )}
            >
              Sign up
            </button>
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
