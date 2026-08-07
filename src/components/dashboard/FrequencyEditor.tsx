import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { WEEKDAY_SHORT, defaultRecurrence, todayIso } from "@/lib/recurrence"
import type { IncomeRecurrence } from "@/types/budget"

type Props = {
  value: IncomeRecurrence | null
  onCancel: () => void
  onSave: (next: IncomeRecurrence) => void
}

type PayKind = "dates" | "weekday"

function toggleNumber(list: number[], value: number) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value].sort((a, b) => {
        if (a === -1) return 1
        if (b === -1) return -1
        return a - b
      })
}

function kindFromRecurrence(r: IncomeRecurrence | null): PayKind | null {
  if (!r) return null
  if (r.unit === "week" && r.weekdays.length > 0) return "weekday"
  if (r.unit === "month" && r.monthDays.length > 0) return "dates"
  return null
}

export function FrequencyEditor({ value, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<IncomeRecurrence>(
    () => value ?? defaultRecurrence(),
  )
  const [kind, setKind] = useState<PayKind | null>(() =>
    kindFromRecurrence(value),
  )

  const canSave = useMemo(() => {
    if (kind === "dates") return draft.monthDays.length > 0
    if (kind === "weekday") return draft.weekdays.length > 0 && draft.interval >= 1
    return false
  }, [kind, draft])

  function switchKind(next: PayKind) {
    setKind(next)
    setDraft((prev) => {
      if (next === "dates") {
        return {
          ...prev,
          unit: "month",
          interval: 1,
          monthDays: prev.unit === "month" ? prev.monthDays : [],
          ends: { kind: "never" },
          startDate: prev.startDate || todayIso(),
        }
      }
      return {
        ...prev,
        unit: "week",
        interval: Math.max(1, prev.unit === "week" ? prev.interval : 1),
        weekdays: prev.unit === "week" ? prev.weekdays : [],
        ends: { kind: "never" },
        startDate: prev.startDate || todayIso(),
      }
    })
  }

  function handleSave() {
    if (kind === "dates") {
      onSave({
        ...draft,
        unit: "month",
        interval: 1,
        ends: { kind: "never" },
      })
      return
    }
    if (kind === "weekday") {
      onSave({
        ...draft,
        unit: "week",
        interval: Math.max(1, draft.interval),
        ends: { kind: "never" },
      })
    }
  }

  return (
    <div className="min-w-[22rem] max-w-[24rem]">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Frequency
      </h2>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            How do you get paid?
          </p>
          <Select
            value={kind ?? undefined}
            onValueChange={(v) => switchKind(v as PayKind)}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              sideOffset={4}
              avoidCollisions={false}
              align="start"
              className="w-[var(--radix-select-trigger-width)]"
            >
              <SelectItem value="dates">On dates in the month</SelectItem>
              <SelectItem value="weekday">On a day of the week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "dates" ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Which dates?</p>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const on = draft.monthDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        monthDays: toggleNumber(prev.monthDays, day),
                      }))
                    }
                    className={cn(
                      "flex h-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      on
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-neutral-200",
                    )}
                  >
                    {day}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    monthDays: toggleNumber(prev.monthDays, -1),
                  }))
                }
                className={cn(
                  "col-span-4 flex h-9 items-center justify-center rounded-full px-2 text-xs font-medium transition-colors",
                  draft.monthDays.includes(-1)
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-neutral-200",
                )}
              >
                Last day of the month
              </button>
            </div>
          </div>
        ) : null}

        {kind === "weekday" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_SHORT.map((label, day) => {
                const on = draft.weekdays.includes(day)
                return (
                  <button
                    key={`${label}-${day}`}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        weekdays: toggleNumber(prev.weekdays, day),
                      }))
                    }
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      on
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-neutral-200",
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-foreground">Every</span>
              <Input
                type="number"
                min={1}
                max={99}
                value={draft.interval}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(99, Number(e.target.value) || 1))
                  setDraft((prev) => ({ ...prev, interval: n }))
                }}
                className="h-10 w-16 text-center"
              />
              <span className="text-sm text-foreground">weeks</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
