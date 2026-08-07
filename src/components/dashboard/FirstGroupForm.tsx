import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { prefillAllocations } from "@/lib/allocations"
import { cn } from "@/lib/utils"
import type {
  Bucket,
  BucketKind,
  Category,
  CategoryVariability,
  PayFrequency,
  Paycheck,
} from "@/types/budget"

type GroupType = "expenses" | "savings"

type CategoryDraft = {
  id: string
  name: string
  amount: string
  goal: string
  dueDay: string
  frequency: PayFrequency | ""
  variability: CategoryVariability | ""
}

type Props = {
  paychecks: Paycheck[]
  onCreate: (bucket: Bucket) => void
}

const fieldH = "h-10"
const selectH = "h-10 w-full data-[size=default]:h-10"
const selectTypeH = "h-10 w-full data-[size=default]:h-10"
const selectFreqH = "h-10 w-full data-[size=default]:h-10"
const COL_EXP =
  "grid-cols-[minmax(0,200px)_68px_64px_9.75rem_7.5rem_40px]" as const
const COL_SAV =
  "grid-cols-[minmax(0,200px)_68px_68px_9.75rem_40px]" as const

const FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
]

function newDraft(): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    goal: "",
    dueDay: "",
    frequency: "",
    variability: "",
  }
}

function parseNum(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const n = Number(trimmed.replace(/,/g, ""))
  return Number.isFinite(n) ? n : undefined
}

function ordinalSuffix(day: number): string {
  const j = day % 10
  const k = day % 100
  if (j === 1 && k !== 11) return "st"
  if (j === 2 && k !== 12) return "nd"
  if (j === 3 && k !== 13) return "rd"
  return "th"
}

function isDueDayInvalid(dueDay: string) {
  if (dueDay.trim() === "") return false
  const day = parseNum(dueDay)
  return day === undefined || day < 1 || day > 31
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-md border border-input px-1.5",
        "hover:border-neutral-400 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
    >
      <span className="pr-1 text-sm text-neutral-500">$</span>
      <input
        className="h-full w-full bg-transparent text-right text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        inputMode="numeric"
        placeholder="0"
      />
    </div>
  )
}

function DueDayInput({
  value,
  onChange,
  onCommit,
  invalid = false,
}: {
  value: string
  onChange: (value: string) => void
  onCommit?: (value: string) => void
  invalid?: boolean
}) {
  const day = parseNum(value)
  const valid = day !== undefined && day >= 1 && day <= 31
  const n = valid ? Math.round(day) : null

  return (
    <div
      className={cn(
        "flex h-10 items-center justify-end rounded-md border px-1.5",
        invalid
          ? "border-destructive hover:border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/25"
          : "border-input hover:border-neutral-400 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
    >
      <input
        className="h-full w-full min-w-0 bg-transparent text-right text-sm tabular-nums text-foreground outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onBlur={(e) => onCommit?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        inputMode="numeric"
      />
      {n !== null ? (
        <span className="shrink-0 text-[10px] leading-none text-muted-foreground">
          {ordinalSuffix(n)}
        </span>
      ) : null}
    </div>
  )
}

function FrequencySelect({
  value,
  onChange,
}: {
  value: PayFrequency | ""
  onChange: (value: PayFrequency) => void
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v as PayFrequency)}
    >
      <SelectTrigger size="default" className={selectFreqH}>
        <SelectValue placeholder="Select frequency" />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className="min-w-0 w-[var(--radix-select-trigger-width)]"
      >
        {FREQUENCY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function toBucket(
  name: string,
  type: GroupType,
  drafts: CategoryDraft[],
  paychecks: Paycheck[],
): Bucket {
  const kind: BucketKind = type === "savings" ? "savings" : "spending"
  const categories: Category[] = drafts.map((d) => {
    const amount = parseNum(d.amount)
    const goal = parseNum(d.goal)
    const dueDayRaw = parseNum(d.dueDay)
    const dueDay =
      dueDayRaw !== undefined && dueDayRaw >= 1 && dueDayRaw <= 31
        ? Math.round(dueDayRaw)
        : undefined
    const frequency = d.frequency || undefined
    const allocations =
      frequency && amount !== undefined
        ? prefillAllocations({
            paychecks,
            frequency,
            amount,
            dueDay,
          })
        : {}

    const base: Category = {
      id: crypto.randomUUID(),
      name: d.name.trim(),
      allocations,
      ...(d.variability ? { variability: d.variability } : {}),
      ...(frequency ? { frequency } : {}),
    }
    if (kind === "savings") {
      return {
        ...base,
        goal: goal ?? 0,
        balance: 0,
        ...(amount !== undefined
          ? { amount, recurringAmount: amount, isRecurring: true }
          : {}),
      }
    }
    return {
      ...base,
      ...(amount !== undefined
        ? { amount, recurringAmount: amount, isRecurring: true }
        : {}),
      ...(dueDay !== undefined ? { dueDay } : {}),
    }
  })

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    kind,
    categories,
  }
}

export function FirstGroupForm({ paychecks, onCreate }: Props) {
  const [name, setName] = useState("")
  const [type, setType] = useState<GroupType | "">("")
  const [drafts, setDrafts] = useState<CategoryDraft[]>([newDraft()])
  const [dueDayError, setDueDayError] = useState(false)

  const canSubmit = useMemo(
    () =>
      name.trim() !== "" &&
      type !== "" &&
      drafts.some((d) => d.name.trim() !== "") &&
      !drafts.some((d) => isDueDayInvalid(d.dueDay)),
    [name, type, drafts],
  )

  function updateDraft(id: string, patch: Partial<CategoryDraft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  function handleCreate() {
    if (!canSubmit || !type) return
    const valid = drafts.filter((d) => d.name.trim() !== "")
    onCreate(toBucket(name, type, valid, paychecks))
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="space-y-3">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className={cn(fieldH, "text-base md:text-sm")}
        />
        <Select
          value={type || undefined}
          onValueChange={(value) => setType(value as GroupType)}
        >
          <SelectTrigger size="default" className={selectH}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            className="w-max min-w-[var(--radix-select-trigger-width)]"
          >
            <SelectItem value="expenses">Expenses</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-2">
        {type === "savings" ? (
          <div
            className={cn(
              "grid gap-2 text-xs font-medium text-muted-foreground",
              COL_SAV,
            )}
          >
            <span>Category</span>
            <span>Amount</span>
            <span>Goal</span>
            <span>Frequency</span>
            <span />
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-2 text-xs font-medium text-muted-foreground",
              COL_EXP,
            )}
          >
            <span>Category</span>
            <span>Payment</span>
            <span>Due day</span>
            <span>Frequency</span>
            <span>Type</span>
            <span />
          </div>
        )}

        {drafts.map((draft) =>
          type === "savings" ? (
            <div key={draft.id} className={cn("grid items-center gap-2", COL_SAV)}>
              <Input
                className={fieldH}
                value={draft.name}
                onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                placeholder="Category name"
              />
              <MoneyInput
                value={draft.amount}
                onChange={(v) => updateDraft(draft.id, { amount: v })}
              />
              <MoneyInput
                value={draft.goal}
                onChange={(v) => updateDraft(draft.id, { goal: v })}
              />
              <FrequencySelect
                value={draft.frequency}
                onChange={(v) => updateDraft(draft.id, { frequency: v })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-1 text-muted-foreground"
                disabled={drafts.length === 1}
                onClick={() =>
                  setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                }
                title="Remove category"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div key={draft.id} className={cn("grid items-center gap-2", COL_EXP)}>
              <Input
                className={fieldH}
                value={draft.name}
                onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                placeholder="Category name"
              />
              <MoneyInput
                value={draft.amount}
                onChange={(v) => updateDraft(draft.id, { amount: v })}
              />
              <DueDayInput
                value={draft.dueDay}
                invalid={dueDayError && isDueDayInvalid(draft.dueDay)}
                onChange={(v) => {
                  updateDraft(draft.id, { dueDay: v })
                  if (dueDayError) {
                    setDueDayError(
                      drafts.some((d) =>
                        isDueDayInvalid(d.id === draft.id ? v : d.dueDay),
                      ),
                    )
                  }
                }}
                onCommit={(v) => {
                  setDueDayError(
                    drafts.some((d) =>
                      isDueDayInvalid(d.id === draft.id ? v : d.dueDay),
                    ),
                  )
                }}
              />
              <FrequencySelect
                value={draft.frequency}
                onChange={(v) => updateDraft(draft.id, { frequency: v })}
              />
              <Select
                value={draft.variability || undefined}
                onValueChange={(value) =>
                  updateDraft(draft.id, {
                    variability: value as CategoryVariability,
                  })
                }
              >
                <SelectTrigger size="default" className={selectTypeH}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="min-w-0 w-[var(--radix-select-trigger-width)]"
                >
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-1 text-muted-foreground"
                disabled={drafts.length === 1}
                onClick={() =>
                  setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                }
                title="Remove category"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ),
        )}

        <Button
          type="button"
          variant="outline"
          className="gap-1"
          onClick={() => setDrafts((prev) => [...prev, newDraft()])}
        >
          <Plus className="size-3.5" />
          Add category
        </Button>
        {dueDayError ? (
          <p className="text-xs text-destructive">
            Due day can&apos;t be more than the days in a month.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={handleCreate}
        >
          Create
        </Button>
      </div>
    </div>
  )
}
