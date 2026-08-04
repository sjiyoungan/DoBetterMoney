import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  variability: CategoryVariability
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

function newDraft(): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    goal: "",
    dueDay: "",
    frequency: "biweekly",
    variability: "fixed",
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

function ordinalDay(day: number): string {
  const j = day % 10
  const k = day % 100
  if (j === 1 && k !== 11) return `${day}st`
  if (j === 2 && k !== 12) return `${day}nd`
  if (j === 3 && k !== 13) return `${day}rd`
  return `${day}th`
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
    variability: cat.variability ?? "fixed",
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
      variability: d.variability,
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
        amount,
        frequency: d.frequency,
      }
    }

    // expenses
    return {
      ...base,
      amount,
      dueDay:
        dueDay !== undefined && dueDay >= 1 && dueDay <= 31
          ? Math.round(dueDay)
          : undefined,
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
  }, [open, bucket])

  const dirty = useMemo(
    () => snapshotKey(bucketName, bucketType, drafts) !== baseline,
    [bucketName, bucketType, drafts, baseline],
  )

  const canSubmit =
    dirty &&
    bucketName.trim() !== "" &&
    drafts.some((d) => d.name.trim() !== "")

  const removeTarget = removeId
    ? drafts.find((d) => d.id === removeId)
    : undefined

  function closeClean() {
    setConfirmOpen(false)
    setRemoveId(null)
    onOpenChange(false)
  }

  function requestClose() {
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
          if (!next) requestClose()
          else onOpenChange(true)
        }}
      >
        <DialogContent
          className="gap-5 p-6 sm:max-w-3xl"
          showCloseButton={false}
          onInteractOutside={(e) => {
            e.preventDefault()
            requestClose()
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            requestClose()
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {editing ? "Edit bucket" : "Add bucket"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-[1fr_140px] items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bucket-name">Bucket name</Label>
                <Input
                  id="bucket-name"
                  className={fieldH}
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="e.g. Bills"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bucket-type">Type</Label>
                <Select
                  value={bucketType}
                  onValueChange={(value) =>
                    setBucketType(value as BucketDraftType)
                  }
                >
                  <SelectTrigger
                    id="bucket-type"
                    size="default"
                    className={selectH}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expenses">Expenses</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {/* Column headers */}
              {bucketType === "savings" ? (
                <div className="grid grid-cols-[1fr_96px_36px] gap-2 px-0.5 text-xs font-medium text-muted-foreground">
                  <span>Category</span>
                  <span>Goal</span>
                  <span />
                </div>
              ) : bucketType === "income" ? (
                <div className="grid grid-cols-[1fr_96px_120px_110px_36px] gap-2 px-0.5 text-xs font-medium text-muted-foreground">
                  <span>Category</span>
                  <span>Income</span>
                  <span>Frequency</span>
                  <span>Type</span>
                  <span />
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_96px_88px_110px_36px] gap-2 px-0.5 text-xs font-medium text-muted-foreground">
                  <span>Category</span>
                  <span>Payment</span>
                  <span>Due day</span>
                  <span>Type</span>
                  <span />
                </div>
              )}

              {drafts.map((draft) => {
                const due = parseNum(draft.dueDay)
                const dueLabel =
                  due !== undefined && due >= 1 && due <= 31
                    ? `${ordinalDay(Math.round(due))} of every month`
                    : null

                if (bucketType === "savings") {
                  return (
                    <div
                      key={draft.id}
                      className="grid grid-cols-[1fr_96px_36px] items-center gap-2"
                    >
                      <Input
                        className={fieldH}
                        value={draft.name}
                        onChange={(e) =>
                          updateDraft(draft.id, { name: e.target.value })
                        }
                        placeholder="Category name"
                      />
                      <Input
                        className={`${fieldH} text-right tabular-nums`}
                        value={draft.goal}
                        onChange={(e) =>
                          updateDraft(draft.id, { goal: e.target.value })
                        }
                        placeholder="0"
                        inputMode="numeric"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        disabled={drafts.length === 1}
                        onClick={() => requestRemove(draft.id)}
                        title="Remove category"
                      >
                        ×
                      </Button>
                    </div>
                  )
                }

                if (bucketType === "income") {
                  return (
                    <div
                      key={draft.id}
                      className="grid grid-cols-[1fr_96px_120px_110px_36px] items-center gap-2"
                    >
                      <Input
                        className={fieldH}
                        value={draft.name}
                        onChange={(e) =>
                          updateDraft(draft.id, { name: e.target.value })
                        }
                        placeholder="Category name"
                      />
                      <Input
                        className={`${fieldH} text-right tabular-nums`}
                        value={draft.amount}
                        onChange={(e) =>
                          updateDraft(draft.id, { amount: e.target.value })
                        }
                        placeholder="0"
                        inputMode="numeric"
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
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={draft.variability}
                        onValueChange={(value) =>
                          updateDraft(draft.id, {
                            variability: value as CategoryVariability,
                          })
                        }
                      >
                        <SelectTrigger size="default" className={selectH}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="variable">Variable</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        disabled={drafts.length === 1}
                        onClick={() => requestRemove(draft.id)}
                        title="Remove category"
                      >
                        ×
                      </Button>
                    </div>
                  )
                }

                // expenses
                return (
                  <div key={draft.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_96px_88px_110px_36px] items-center gap-2">
                      <Input
                        className={fieldH}
                        value={draft.name}
                        onChange={(e) =>
                          updateDraft(draft.id, { name: e.target.value })
                        }
                        placeholder="Category name"
                      />
                      <Input
                        className={`${fieldH} text-right tabular-nums`}
                        value={draft.amount}
                        onChange={(e) =>
                          updateDraft(draft.id, { amount: e.target.value })
                        }
                        placeholder="0"
                        inputMode="numeric"
                      />
                      <Input
                        className={`${fieldH} text-right tabular-nums`}
                        value={draft.dueDay}
                        onChange={(e) =>
                          updateDraft(draft.id, { dueDay: e.target.value })
                        }
                        placeholder="7"
                        inputMode="numeric"
                      />
                      <Select
                        value={draft.variability}
                        onValueChange={(value) =>
                          updateDraft(draft.id, {
                            variability: value as CategoryVariability,
                          })
                        }
                      >
                        <SelectTrigger size="default" className={selectH}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="variable">Variable</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        disabled={drafts.length === 1}
                        onClick={() => requestRemove(draft.id)}
                        title="Remove category"
                      >
                        ×
                      </Button>
                    </div>
                    {dueLabel ? (
                      <div className="grid grid-cols-[1fr_96px_88px_110px_36px] gap-2">
                        <span />
                        <span />
                        <span className="text-xs text-muted-foreground">
                          {dueLabel}
                        </span>
                        <span />
                        <span />
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setDrafts((prev) => [...prev, newDraft()])}
              >
                <Plus className="size-3.5" />
                Add category
              </Button>
            </div>
          </div>

          <DialogFooter className="-mx-6 -mb-6 p-6 sm:justify-between">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="disabled:border-transparent disabled:bg-muted/60 disabled:text-muted-foreground/40 disabled:opacity-100"
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
          <DialogFooter className="-mx-6 -mb-6 p-6 sm:justify-between">
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
          <DialogFooter className="-mx-6 -mb-6 p-6 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveId(null)}
            >
              Keep category
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRemove}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
