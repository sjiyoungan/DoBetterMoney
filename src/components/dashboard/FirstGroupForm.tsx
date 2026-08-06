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
import { cn } from "@/lib/utils"
import type {
  Bucket,
  BucketKind,
  Category,
  CategoryVariability,
} from "@/types/budget"

type GroupType = "expenses" | "savings"

type CategoryDraft = {
  id: string
  name: string
  amount: string
  goal: string
  dueDay: string
  variability: CategoryVariability | ""
}

type Props = {
  onCreate: (bucket: Bucket) => void
}

const fieldH = "h-10"
const selectH = "h-10 w-full data-[size=default]:h-10"
const selectTypeH = "h-10 w-max data-[size=default]:h-10"
const COL_EXP =
  "grid-cols-[minmax(0,238px)_68px_64px_max-content_40px]" as const
const COL_SAV = "grid-cols-[minmax(0,238px)_68px_40px]" as const

function newDraft(): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    goal: "",
    dueDay: "",
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
  const [editing, setEditing] = useState(false)

  return (
    <div
      className={cn(
        "flex h-10 cursor-text items-center justify-end rounded-md border border-input px-1.5",
        "hover:border-neutral-400 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          className="h-full w-full bg-transparent text-right text-sm tabular-nums text-foreground outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          inputMode="numeric"
          placeholder="0"
        />
      ) : value !== "" ? (
        <span className="text-sm tabular-nums text-foreground">${value}</span>
      ) : null}
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
  const [editing, setEditing] = useState(false)
  const day = parseNum(value)
  const valid = day !== undefined && day >= 1 && day <= 31
  const n = valid ? Math.round(day) : null

  return (
    <div
      className={cn(
        "flex h-10 cursor-text items-center justify-end rounded-md border px-1.5",
        invalid
          ? "border-destructive hover:border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/25"
          : "border-input hover:border-neutral-400 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          className="h-full w-full bg-transparent text-right text-sm tabular-nums text-foreground outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onBlur={(e) => {
            setEditing(false)
            onCommit?.(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          inputMode="numeric"
        />
      ) : n !== null ? (
        <span className="inline-flex items-baseline text-sm tabular-nums text-foreground">
          {n}
          <span className="ml-px text-[10px] leading-none text-muted-foreground">
            {ordinalSuffix(n)}
          </span>
        </span>
      ) : value !== "" ? (
        <span className="text-sm tabular-nums text-foreground">{value}</span>
      ) : null}
    </div>
  )
}

function toBucket(
  name: string,
  type: GroupType,
  drafts: CategoryDraft[],
): Bucket {
  const kind: BucketKind = type === "savings" ? "savings" : "spending"
  const categories: Category[] = drafts.map((d) => {
    const amount = parseNum(d.amount)
    const goal = parseNum(d.goal)
    const dueDay = parseNum(d.dueDay)
    const base: Category = {
      id: crypto.randomUUID(),
      name: d.name.trim(),
      allocations: {},
      ...(d.variability ? { variability: d.variability } : {}),
    }
    if (kind === "savings") {
      return { ...base, goal: goal ?? 0, balance: 0 }
    }
    return {
      ...base,
      ...(amount !== undefined ? { amount } : {}),
      ...(dueDay !== undefined && dueDay >= 1 && dueDay <= 31
        ? { dueDay: Math.round(dueDay) }
        : {}),
    }
  })

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    kind,
    categories,
  }
}

export function FirstGroupForm({ onCreate }: Props) {
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
    onCreate(toBucket(name, type, valid))
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
            <span>Goal</span>
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
                value={draft.goal}
                onChange={(v) => updateDraft(draft.id, { goal: v })}
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
          className="h-10 gap-1"
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
          className="h-10"
        >
          Create
        </Button>
      </div>
    </div>
  )
}
