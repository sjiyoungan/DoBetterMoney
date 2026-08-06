import { BrandMark } from "@/components/BrandMark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/types/budget"

type Props = {
  user: UserRole
  onUserChange: (user: UserRole) => void
  onSignOut?: () => void
  username?: string | null
}

export function AppHeader({ user, onUserChange, onSignOut, username }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-[60px] py-3">
        <div className="flex items-center gap-2">
          <BrandMark className="size-7 text-foreground" />
          <p className="text-lg font-semibold tracking-tight">DoBetterMoney</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {username ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              @{username}
            </span>
          ) : null}
          <div className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={user === "liz" ? "default" : "ghost"}
              onClick={() => onUserChange("liz")}
            >
              Liz
            </Button>
            <Button
              size="sm"
              variant={user === "ji" ? "default" : "ghost"}
              onClick={() => onUserChange("ji")}
            >
              Ji
            </Button>
          </div>
          <Badge variant="secondary">{user === "liz" ? "Planner" : "Holder"}</Badge>
          {onSignOut ? (
            <Button size="sm" variant="ghost" onClick={onSignOut}>
              Sign out
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
