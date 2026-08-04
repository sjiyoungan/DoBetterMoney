import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/types/budget"

type Props = {
  user: UserRole
  onUserChange: (user: UserRole) => void
}

export function AppHeader({ user, onUserChange }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-[60px] py-3">
        <p className="text-lg font-semibold tracking-tight">DoBetterMoney</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled>
            Add bucket
          </Button>
          <Button variant="outline" size="sm" disabled>
            Add category
          </Button>
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
