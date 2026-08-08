import { Check, LogOut, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CaretDownIcon } from "@/components/ui/caret-down"
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
}: Props) {
  const label = username?.trim() ? username : "Profile"
  const initial = (username?.trim()?.[0] ?? "P").toUpperCase()

  return (
    <header className="z-50 shrink-0 border-b bg-page">
      <div className="flex items-center justify-between gap-3 px-[60px] py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-3 rounded-md px-2 py-1.5 text-lg font-semibold tracking-tight text-foreground transition-colors hover:bg-muted"
            >
              {activeYear}
              <CaretDownIcon className="size-2 text-muted-foreground" />
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
              <CaretDownIcon className="size-2 text-muted-foreground" />
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
