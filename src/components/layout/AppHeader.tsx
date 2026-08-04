import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/types/budget"

type Props = {
  user: UserRole
  onUserChange: (user: UserRole) => void
}

export function AppHeader({ user, onUserChange }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">DoBetterMoney</p>
          <p className="text-xs text-muted-foreground">
            Rough skeleton · shared account, role views
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Viewing as
          </span>
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
        </div>
      </div>
    </header>
  )
}
