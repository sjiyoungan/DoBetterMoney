import { Check, ChevronDown, LogOut, Plus, Redo2, Undo2 } from "lucide-react"
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
  activeYear: number
  years: number[]
  nextYearLabel: number
  onYearChange: (year: number) => void
  onCreateYear: () => void
  canCreateYear: boolean
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

export function AppHeader({
  user,
  onUserChange,
  onSignOut,
  username,
  activeYear,
  years,
  nextYearLabel,
  onYearChange,
  onCreateYear,
  canCreateYear,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: Props) {
  const label = username?.trim() ? username : "Profile"
  const initial = (username?.trim()?.[0] ?? "P").toUpperCase()
  const mod =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘"
      : "Ctrl+"

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-[60px] py-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-lg font-semibold tracking-tight text-foreground transition-colors hover:bg-muted"
              >
                {activeYear}
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              {years.map((year) => (
                <DropdownMenuItem
                  key={year}
                  className="justify-between gap-3"
                  onSelect={() => onYearChange(year)}
                >
                  {year}
                  {year === activeYear ? <Check className="size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
              {canCreateYear ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => onCreateYear()}
                  >
                    <Plus className="size-3.5" />
                    Create {nextYearLabel}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              disabled={!canUndo}
              title={`Undo (${mod}Z)`}
              onClick={() => onUndo?.()}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              disabled={!canRedo}
              title={`Redo (${mod}Shift+Z)`}
              onClick={() => onRedo?.()}
            >
              <Redo2 className="size-4" />
            </Button>
          </div>
        </div>

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
