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
import type { Bucket, BucketKind, Category } from "@/types/budget"

export type BucketDraftType = "expenses" | "savings" | "income"

type CategoryDraft = {
  id: string
  name: string
  goal: string
}

type Props = {
  open: boolean
  /** When set, dialog edits this bucket instead of creating a new one */
  bucket?: Bucket | null
  onOpenChange: (open: boolean) => void
  onAdd: (bucket: Bucket) => void
  onUpdate: (bucket: Bucket) => void
}

const fieldH = "h-10" // 40px

function newDraft(): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    goal: "",
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

function bucketToDrafts(bucket: Bucket): CategoryDraft[] {
  if (bucket.categories.length === 0) return [newDraft()]
  return bucket.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    goal: cat.goal === undefined ? "" : String(cat.goal),
  }))
}

function draftsToBucket(
  bucketName: string,
  bucketType: BucketDraftType,
  drafts: CategoryDraft[],
  existing?: Bucket | null,
): Bucket {
  const bucketKind = mapType(bucketType)
  const isSavings = bucketKind === "savings"

  const categories: Category[] = drafts.map((d) => {
    const goalNum = Number(d.goal.replace(/,/g, ""))
    const prev = existing?.categories.find((c) => c.id === d.id)
    const base: Category = {
      id: prev?.id ?? crypto.randomUUID(),
      name: d.name.trim(),
      allocations: prev?.allocations ?? {},
    }
    if (!isSavings) return base
    return {
      ...base,
      goal:
        Number.isFinite(goalNum) && d.goal.trim() !== ""
          ? goalNum
          : (prev?.goal ?? 0),
      balance: prev?.balance ?? 0,
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
      goal: d.goal.trim(),
    })),
  })
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
  }, [open, bucket])

  const dirty = useMemo(
    () => snapshotKey(bucketName, bucketType, drafts) !== baseline,
    [bucketName, bucketType, drafts, baseline],
  )

  const canSubmit =
    dirty &&
    bucketName.trim() !== "" &&
    drafts.some((d) => d.name.trim() !== "")

  const showGoals = bucketType === "savings"

  function closeClean() {
    setConfirmOpen(false)
    onOpenChange(false)
  }

  function requestClose() {
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    closeClean()
  }

  function handleSubmit() {
    if (!canSubmit) return
    const validDrafts = drafts.filter((d) => d.name.trim() !== "")
    const next = draftsToBucket(bucketName, bucketType, validDrafts, bucket)
    if (editing) onUpdate(next)
    else onAdd(next)
    closeClean()
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
          className="gap-5 p-6 sm:max-w-xl"
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
            <DialogTitle>{editing ? "Edit Bucket" : "Add Bucket"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the bucket name and categories."
                : "Name the bucket, then add one or more categories."}
            </DialogDescription>
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
                    className={`w-full ${fieldH}`}
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
              <div
                className={
                  showGoals
                    ? "grid grid-cols-[1fr_88px_36px] gap-2 px-0.5 text-xs font-medium text-muted-foreground"
                    : "grid grid-cols-[1fr_36px] gap-2 px-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                <span>Category</span>
                {showGoals ? <span>Goal</span> : null}
                <span />
              </div>

              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={
                    showGoals
                      ? "grid grid-cols-[1fr_88px_36px] items-center gap-2"
                      : "grid grid-cols-[1fr_36px] items-center gap-2"
                  }
                >
                  <Input
                    className={fieldH}
                    value={draft.name}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.id === draft.id ? { ...d, name: e.target.value } : d,
                        ),
                      )
                    }
                    placeholder="Category name"
                  />
                  {showGoals ? (
                    <Input
                      className={`${fieldH} text-right tabular-nums`}
                      value={draft.goal}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((d) =>
                            d.id === draft.id
                              ? { ...d, goal: e.target.value }
                              : d,
                          ),
                        )
                      }
                      placeholder="0"
                      inputMode="numeric"
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    disabled={drafts.length === 1}
                    onClick={() =>
                      setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                    }
                    title="Remove category"
                  >
                    ×
                  </Button>
                </div>
              ))}

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
    </>
  )
}
