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
import {
  WEEKDAY_SHORT,
  defaultRecurrence,
  todayIso,
} from "@/lib/recurrence"
import type { IncomeRecurrence, RecurrenceUnit } from "@/types/budget"

type Props = {
  value: IncomeRecurrence | null
  onCancel: () => void
  onSave: (next: IncomeRecurrence) => void
}

const MONTH_DAY_PRESETS: { label: string; value: number }[] = [
  { label: "1st", value: 1 },
  { label: "15th", value: 15 },
  { label: "Last", value: -1 },
]

function toggleNumber(list: number[], value: number) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value].sort((a, b) => {
        if (a === -1) return 1
        if (b === -1) return -1
        return a - b
      })
}

export function FrequencyEditor({ value, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<IncomeRecurrence>(
    () => value ?? defaultRecurrence(),
  )

  const canSave = useMemo(() => {
    if (draft.interval < 1) return false
    if (draft.unit === "week") return draft.weekdays.length > 0
    if (draft.unit === "month") return draft.monthDays.length > 0
    if (draft.ends.kind === "on" && !draft.ends.date) return false
    if (draft.ends.kind === "after" && draft.ends.count < 1) return false
    return true
  }, [draft])

  function setUnit(unit: RecurrenceUnit) {
    setDraft((prev) => ({ ...prev, unit }))
  }

  return (
    <div className="min-w-[22rem]">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Frequency
      </h2>

      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-foreground">Repeat every</span>
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
          <Select
            value={draft.unit}
            onValueChange={(v) => setUnit(v as RecurrenceUnit)}
          >
            <SelectTrigger className="h-10 w-[7.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">day</SelectItem>
              <SelectItem value="week">week</SelectItem>
              <SelectItem value="month">month</SelectItem>
              <SelectItem value="year">year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {draft.unit === "week" ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">Repeat on</p>
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
          </div>
        ) : null}

        {draft.unit === "month" ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">Repeat on</p>
            <div className="flex flex-wrap gap-2">
              {MONTH_DAY_PRESETS.map((opt) => {
                const on = draft.monthDays.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        monthDays: toggleNumber(prev.monthDays, opt.value),
                      }))
                    }
                    className={cn(
                      "h-9 rounded-full px-3 text-sm font-medium transition-colors",
                      on
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-neutral-200",
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Custom day</span>
              <Input
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 20"
                className="h-9 w-20"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  const n = Number((e.target as HTMLInputElement).value)
                  if (!Number.isFinite(n) || n < 1 || n > 31) return
                  setDraft((prev) => ({
                    ...prev,
                    monthDays: toggleNumber(prev.monthDays, Math.round(n)),
                  }))
                  ;(e.target as HTMLInputElement).value = ""
                }}
              />
              <span className="text-xs text-muted-foreground">press Enter</span>
            </div>
            {draft.monthDays.filter((d) => d !== 1 && d !== 15 && d !== -1)
              .length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draft.monthDays
                  .filter((d) => d !== 1 && d !== 15 && d !== -1)
                  .map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          monthDays: prev.monthDays.filter((x) => x !== d),
                        }))
                      }
                      className="h-8 rounded-full bg-foreground px-3 text-xs font-medium text-background"
                    >
                      {d}
                      <span className="ml-1 opacity-70">×</span>
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm text-foreground">Ends</p>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="ends"
                checked={draft.ends.kind === "never"}
                onChange={() =>
                  setDraft((prev) => ({ ...prev, ends: { kind: "never" } }))
                }
                className="size-4 accent-foreground"
              />
              <span className="text-sm">Never</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="ends"
                checked={draft.ends.kind === "on"}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    ends: {
                      kind: "on",
                      date:
                        prev.ends.kind === "on"
                          ? prev.ends.date
                          : todayIso(),
                    },
                  }))
                }
                className="size-4 accent-foreground"
              />
              <span className="text-sm">On</span>
              <Input
                type="date"
                disabled={draft.ends.kind !== "on"}
                value={draft.ends.kind === "on" ? draft.ends.date : ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    ends: { kind: "on", date: e.target.value },
                  }))
                }
                className="h-9 w-[10.5rem] disabled:opacity-50"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="ends"
                checked={draft.ends.kind === "after"}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    ends: {
                      kind: "after",
                      count: prev.ends.kind === "after" ? prev.ends.count : 13,
                    },
                  }))
                }
                className="size-4 accent-foreground"
              />
              <span className="text-sm">After</span>
              <Input
                type="number"
                min={1}
                max={999}
                disabled={draft.ends.kind !== "after"}
                value={draft.ends.kind === "after" ? draft.ends.count : 13}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value) || 1)
                  setDraft((prev) => ({
                    ...prev,
                    ends: { kind: "after", count: n },
                  }))
                }}
                className="h-9 w-16 disabled:opacity-50"
              />
              <span
                className={cn(
                  "text-sm",
                  draft.ends.kind !== "after" && "text-muted-foreground",
                )}
              >
                occurrences
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-10"
          disabled={!canSave}
          onClick={() => onSave(draft)}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
