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

export type CategoryDraftType = "expenses" | "savings" | "income"

type CategoryDraft = {
  id: string
  name: string
  type: CategoryDraftType
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

function newDraft(type: CategoryDraftType = "expenses"): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    type,
    goal: "",
  }
}

function mapType(type: CategoryDraftType): BucketKind {
  if (type === "savings") return "savings"
  if (type === "income") return "income"
  return "spending"
}

function kindToDraftType(kind: BucketKind): CategoryDraftType {
  if (kind === "savings") return "savings"
  if (kind === "income") return "income"
  return "expenses"
}

function bucketToDrafts(bucket: Bucket): CategoryDraft[] {
  const type = kindToDraftType(bucket.kind)
  if (bucket.categories.length === 0) return [newDraft(type)]
  return bucket.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    type,
    goal: cat.goal === undefined ? "" : String(cat.goal),
  }))
}

function draftsToBucket(
  bucketName: string,
  drafts: CategoryDraft[],
  existing?: Bucket | null,
): Bucket {
  const kinds = drafts.map((d) => mapType(d.type))
  const allSame = kinds.every((k) => k === kinds[0])
  const bucketKind: BucketKind = allSame ? kinds[0]! : "spending"

  const categories: Category[] = drafts.map((d) => {
    const kind = mapType(d.type)
    const goalNum = Number(d.goal.replace(/,/g, ""))
    const prev = existing?.categories.find((c) => c.id === d.id)
    const base: Category = {
      id: prev?.id ?? crypto.randomUUID(),
      name: d.name.trim(),
      allocations: prev?.allocations ?? {},
    }
    if (kind === "savings") {
      return {
        ...base,
        goal:
          Number.isFinite(goalNum) && d.goal.trim() !== ""
            ? goalNum
            : (prev?.goal ?? 0),
        balance: prev?.balance ?? 0,
      }
    }
    return base
  })

  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: bucketName.trim(),
    kind: bucketKind,
    note: existing?.note,
    categories,
  }
}

function snapshotKey(name: string, drafts: CategoryDraft[]) {
  return JSON.stringify({
    name: name.trim(),
    drafts: drafts.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      type: d.type,
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
  const [drafts, setDrafts] = useState<CategoryDraft[]>([newDraft()])
  const [baseline, setBaseline] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    if (bucket) {
      const nextDrafts = bucketToDrafts(bucket)
      setBucketName(bucket.name)
      setDrafts(nextDrafts)
      setBaseline(snapshotKey(bucket.name, nextDrafts))
    } else {
      const nextDrafts = [newDraft()]
      setBucketName("")
      setDrafts(nextDrafts)
      setBaseline(snapshotKey("", nextDrafts))
    }
    setConfirmOpen(false)
  }, [open, bucket])

  const dirty = useMemo(
    () => snapshotKey(bucketName, drafts) !== baseline,
    [bucketName, drafts, baseline],
  )

  const canSubmit =
    dirty &&
    bucketName.trim() !== "" &&
    drafts.some((d) => d.name.trim() !== "")

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
    const next = draftsToBucket(bucketName, validDrafts, bucket)
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
          className="sm:max-w-xl"
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

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bucket-name">Bucket name</Label>
              <Input
                id="bucket-name"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="e.g. Bills"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_120px_88px_36px] gap-2 px-0.5 text-xs font-medium text-muted-foreground">
                <span>Category</span>
                <span>Type</span>
                <span>Goal</span>
                <span />
              </div>

              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="grid grid-cols-[1fr_120px_88px_36px] items-center gap-2"
                >
                  <Input
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
                  <Select
                    value={draft.type}
                    onValueChange={(value) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.id === draft.id
                            ? { ...d, type: value as CategoryDraftType }
                            : d,
                        ),
                      )
                    }
                  >
                    <SelectTrigger size="default" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expenses">Expenses</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                  {draft.type === "savings" ? (
                    <Input
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
                      className="text-right tabular-nums"
                    />
                  ) : (
                    <div />
                  )}
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
                onClick={() =>
                  setDrafts((prev) => [
                    ...prev,
                    newDraft(editing ? kindToDraftType(bucket!.kind) : "expenses"),
                  ])
                }
              >
                <Plus className="size-3.5" />
                Add category
              </Button>
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
              {editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits. If you cancel, that information will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
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
