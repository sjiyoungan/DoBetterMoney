import { Check, ChevronDown, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/types/budget"

type Props = {
  user: UserRole
  onUserChange: (user: UserRole) => void
  onSignOut?: () => void
  username?: string | null
}

export function AppHeader({ user, onUserChange, onSignOut, username }: Props) {
  const label = username?.trim() ? username : "Profile"
  const initial = (username?.trim()?.[0] ?? "P").toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-[60px] py-3">
        <p className="text-lg font-semibold tracking-tight">DoBetterMoney</p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2 rounded-full border-neutral-200 bg-white px-2.5 pr-3 shadow-none"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-semibold text-white">
                {initial}
              </span>
              <span className="max-w-[8rem] truncate text-sm font-medium">
                {label}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              className="justify-between gap-3"
              onSelect={() => onUserChange("liz")}
            >
              Liz
              {user === "liz" ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="justify-between gap-3"
              onSelect={() => onUserChange("ji")}
            >
              Ji
              {user === "ji" ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onSignOut?.()}
            >
              <LogOut className="size-3.5" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
