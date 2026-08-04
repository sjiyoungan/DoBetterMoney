import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  PayFrequency,
} from "@/types/budget"

export type BucketDraftType = "expenses" | "savings" | "income"

type CategoryDraft = {
  id: string
  name: string
  amount: string
  goal: string
  dueDay: string
  frequency: PayFrequency
  variability: CategoryVariability | ""
}

type Props = {
  open: boolean
  bucket?: Bucket | null
  onOpenChange: (open: boolean) => void
  onAdd: (bucket: Bucket) => void
  onUpdate: (bucket: Bucket) => void
}

const fieldH = "h-10" // 40px
const selectH = "h-10 w-full data-[size=default]:h-10"
/** Type column hugs “Select type” / Fixed / Variable */
const selectTypeH = "h-10 w-max data-[size=default]:h-10"

/** Expenses / income category row columns */
const COL_EXP =
  "grid-cols-[minmax(0,238px)_68px_64px_max-content_40px]" as const
const COL_INC =
  "grid-cols-[minmax(0,238px)_68px_112px_max-content_40px]" as const
const COL_SAV = "grid-cols-[minmax(0,238px)_68px_40px]" as const

const TYPE_LABEL: Record<BucketDraftType, string> = {
  expenses: "Expenses",
  savings: "Savings",
  income: "Income",
}

function newDraft(): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    goal: "",
    dueDay: "",
    frequency: "biweekly",
    variability: "",
  }
}

function mapType(type: BucketDraftType): BucketKind {
  if (type === "savings") return "savings"
  if (type === "income") return "income"
  return "spending"
}

function kindToDraftType(kind: BucketKind): BucketDraftType {
  if (kind === "savings") return "savings"
  if (kind === "income") return "income"
  return "expenses"
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

function bucketToDrafts(bucket: Bucket): CategoryDraft[] {
  if (bucket.categories.length === 0) return [newDraft()]
  return bucket.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    amount:
      cat.amount !== undefined
        ? String(cat.amount)
        : cat.recurringAmount !== undefined
          ? String(cat.recurringAmount)
          : cat.minPayment !== undefined
            ? String(cat.minPayment)
            : "",
    goal: cat.goal === undefined ? "" : String(cat.goal),
    dueDay:
      cat.dueDay !== undefined
        ? String(cat.dueDay)
        : cat.dueDate && /^\d+$/.test(cat.dueDate)
          ? cat.dueDate
          : "",
    frequency: cat.frequency ?? "biweekly",
    variability: cat.variability ?? "",
  }))
}

function draftsToBucket(
  bucketName: string,
  bucketType: BucketDraftType,
  drafts: CategoryDraft[],
  existing?: Bucket | null,
): Bucket {
  const bucketKind = mapType(bucketType)

  const categories: Category[] = drafts.map((d) => {
    const prev = existing?.categories.find((c) => c.id === d.id)
    const amount = parseNum(d.amount)
    const goal = parseNum(d.goal)
    const dueDay = parseNum(d.dueDay)

    const base: Category = {
      id: prev?.id ?? crypto.randomUUID(),
      name: d.name.trim(),
      allocations: prev?.allocations ?? {},
      ...(d.variability ? { variability: d.variability } : {}),
    }

    if (bucketKind === "savings") {
      return {
        ...base,
        goal: goal ?? prev?.goal ?? 0,
        balance: prev?.balance ?? 0,
      }
    }

    if (bucketKind === "income") {
      return {
        ...base,
        ...(amount !== undefined ? { amount } : {}),
        frequency: d.frequency,
      }
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
    id: existing?.id ?? crypto.randomUUID(),
    name: bucketName.trim(),
    kind: bucketKind,
    note: existing?.note,
    categories,
  }
}

function snapshotKey(
  name: string,
  type: BucketDraftType,
  drafts: CategoryDraft[],
) {
  return JSON.stringify({
    name: name.trim(),
    type,
    drafts: drafts.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      amount: d.amount.trim(),
      goal: d.goal.trim(),
      dueDay: d.dueDay.trim(),
      frequency: d.frequency,
      variability: d.variability,
    })),
  })
}

function draftHasData(d: CategoryDraft) {
  return (
    d.name.trim() !== "" ||
    d.amount.trim() !== "" ||
    d.goal.trim() !== "" ||
    d.dueDay.trim() !== ""
  )
}

/** Click-to-edit money field with $ prefix when not editing; border always on */
function MoneyInput({
  value,
  onChange,
  placeholder = "0",
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
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
          placeholder={placeholder}
        />
      ) : value !== "" ? (
        <span className="text-sm tabular-nums text-foreground">${value}</span>
      ) : null}
    </div>
  )
}

/** Due day: digits only; small gray ordinal when valid */
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

function isDueDayInvalid(dueDay: string) {
  if (dueDay.trim() === "") return false
  const day = parseNum(dueDay)
  return day === undefined || day < 1 || day > 31
}

export function AddBucketDialog({
  open,
  bucket = null,
  onOpenChange,
  onAdd,
  onUpdate,
}: Props) {
  const editing = !!bucket
  const [bucketName, setBucketName] = useState("")
  const [bucketType, setBucketType] = useState<BucketDraftType>("expenses")
  const [drafts, setDrafts] = useState<CategoryDraft[]>([newDraft()])
  const [baseline, setBaseline] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [dueDayError, setDueDayError] = useState(false)

  useEffect(() => {
    if (!open) return
    if (bucket) {
      const nextDrafts = bucketToDrafts(bucket)
      const nextType = kindToDraftType(bucket.kind)
      setBucketName(bucket.name)
      setBucketType(nextType)
      setDrafts(nextDrafts)
      setBaseline(snapshotKey(bucket.name, nextType, nextDrafts))
    } else {
      const nextDrafts = [newDraft()]
      setBucketName("")
      setBucketType("expenses")
      setDrafts(nextDrafts)
      setBaseline(snapshotKey("", "expenses", nextDrafts))
    }
    setConfirmOpen(false)
    setRemoveId(null)
    setEditingName(false)
    setTypeOpen(false)
    setDueDayError(false)
  }, [open, bucket])

  const dirty = useMemo(
    () => snapshotKey(bucketName, bucketType, drafts) !== baseline,
    [bucketName, bucketType, drafts, baseline],
  )

  const canSubmit =
    dirty &&
    bucketName.trim() !== "" &&
    drafts.some((d) => d.name.trim() !== "") &&
    !drafts.some((d) => isDueDayInvalid(d.dueDay))

  const removeTarget = removeId
    ? drafts.find((d) => d.id === removeId)
    : undefined
  const nestedOpen = confirmOpen || !!removeId

  function closeClean() {
    setConfirmOpen(false)
    setRemoveId(null)
    onOpenChange(false)
  }

  function requestClose() {
    if (nestedOpen) return
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    closeClean()
  }

  function requestRemove(id: string) {
    const draft = drafts.find((d) => d.id === id)
    if (!draft) return
    const existed = bucket?.categories.some((c) => c.id === id)
    if (existed || draftHasData(draft)) {
      setRemoveId(id)
      return
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  function confirmRemove() {
    if (!removeId) return
    setDrafts((prev) => prev.filter((d) => d.id !== removeId))
    setRemoveId(null)
  }

  function handleSubmit() {
    if (!canSubmit) return
    const validDrafts = drafts.filter((d) => d.name.trim() !== "")
    const next = draftsToBucket(bucketName, bucketType, validDrafts, bucket)
    if (editing) onUpdate(next)
    else onAdd(next)
    closeClean()
  }

  function updateDraft(id: string, patch: Partial<CategoryDraft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true)
            return
          }
          // Nested confirm dialogs — don't treat as closing the bucket dialog
          if (confirmOpen || removeId) return
          requestClose()
        }}
      >
        <DialogContent
          className="w-max max-w-[calc(100%-2rem)] gap-0 pt-4 pr-4 pb-6 pl-6 sm:max-w-none"
          showCloseButton={false}
          onPointerDownOutside={(e) => {
            e.preventDefault()
            if (confirmOpen || removeId) return
            requestClose()
          }}
          onInteractOutside={(e) => {
            e.preventDefault()
            if (confirmOpen || removeId) return
            requestClose()
          }}
          onFocusOutside={(e) => {
            // Keep focus when a nested confirm dialog takes over
            if (confirmOpen || removeId) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            if (removeId) {
              setRemoveId(null)
              return
            }
            if (confirmOpen) {
              setConfirmOpen(false)
              return
            }
            requestClose()
          }}
        >
          {/* Header */}
          <div>
            <div className="group -ml-[3px] flex min-h-10 items-center gap-1.5">
              {editingName ? (
                <input
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                  }}
                  placeholder={editing ? "Bucket name" : "New bucket"}
                />
              ) : (
                <>
                  <h2 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground">
                    {bucketName.trim() !== ""
                      ? bucketName
                      : editing
                        ? "Bucket name"
                        : "New bucket"}
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                    onClick={() => setEditingName(true)}
                    title="Edit name"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </>
              )}
            </div>

            <Select
              value={bucketType}
              open={typeOpen}
              onOpenChange={setTypeOpen}
              onValueChange={(value) =>
                setBucketType(value as BucketDraftType)
              }
            >
              <SelectTrigger
                size="default"
                className={cn(
                  "mt-0 h-auto min-w-[5.75rem] justify-between gap-3 border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground shadow-none",
                  "hover:bg-transparent hover:text-foreground",
                  "focus-visible:ring-0 focus-visible:outline-none",
                  "data-[size=default]:h-auto [&_svg]:size-3.5 [&_svg]:opacity-0 hover:[&_svg]:opacity-100 data-[state=open]:[&_svg]:opacity-100",
                )}
              >
                <SelectValue>{TYPE_LABEL[bucketType]}</SelectValue>
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="w-max min-w-[var(--radix-select-trigger-width)]"
              >
                <SelectItem value="expenses">Expenses</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-6 space-y-2">
            {bucketType === "savings" ? (
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
            ) : bucketType === "income" ? (
              <div
                className={cn(
                  "grid gap-2 text-xs font-medium text-muted-foreground",
                  COL_INC,
                )}
              >
                <span>Category</span>
                <span>Income</span>
                <span>Frequency</span>
                <span>Type</span>
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

            {drafts.map((draft) => {
              if (bucketType === "savings") {
                return (
                  <div key={draft.id} className={cn("grid items-center gap-2", COL_SAV)}>
                    <Input
                      className={fieldH}
                      value={draft.name}
                      onChange={(e) =>
                        updateDraft(draft.id, { name: e.target.value })
                      }
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
                      onClick={() => requestRemove(draft.id)}
                      title="Remove category"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )
              }

              if (bucketType === "income") {
                return (
                  <div key={draft.id} className={cn("grid items-center gap-2", COL_INC)}>
                    <Input
                      className={fieldH}
                      value={draft.name}
                      onChange={(e) =>
                        updateDraft(draft.id, { name: e.target.value })
                      }
                      placeholder="Category name"
                    />
                    <MoneyInput
                      value={draft.amount}
                      onChange={(v) => updateDraft(draft.id, { amount: v })}
                    />
                    <Select
                      value={draft.frequency}
                      onValueChange={(value) =>
                        updateDraft(draft.id, {
                          frequency: value as PayFrequency,
                        })
                      }
                    >
                      <SelectTrigger size="default" className={selectH}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        align="start"
                        className="min-w-0 w-[var(--radix-select-trigger-width)]"
                      >
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
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
                      onClick={() => requestRemove(draft.id)}
                      title="Remove category"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )
              }

              return (
                <div key={draft.id} className={cn("grid items-center gap-2", COL_EXP)}>
                  <Input
                    className={fieldH}
                    value={draft.name}
                    onChange={(e) =>
                      updateDraft(draft.id, { name: e.target.value })
                    }
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
                            isDueDayInvalid(
                              d.id === draft.id ? v : d.dueDay,
                            ),
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
                    onClick={() => requestRemove(draft.id)}
                    title="Remove category"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            })}

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

          <DialogFooter className="-ml-6 -mr-4 -mb-6 mt-5 items-center pl-6 pr-4 py-4 sm:justify-end sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="h-10 disabled:border disabled:border-neutral-200 disabled:bg-transparent disabled:text-muted-foreground/35 disabled:opacity-100 dark:disabled:border-neutral-700"
            >
              {editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-6 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits. If you cancel, that information will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={closeClean}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeId}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null)
        }}
      >
        <DialogContent className="p-6 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove category?</DialogTitle>
            <DialogDescription>
              {removeTarget?.name
                ? `Removing “${removeTarget.name}” will delete its existing data from this bucket.`
                : "Removing this category will delete its existing data from this bucket."}{" "}
              This can’t be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveId(null)}
            >
              Keep category
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
