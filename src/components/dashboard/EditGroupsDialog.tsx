import { useEffect, useMemo, useRef, useState } from "react"
import { Eye, EyeOff, Menu, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { isReorderNoOp, reorderById } from "@/lib/reorder"
import { blushHoverClass, cn } from "@/lib/utils"
import type { Bucket } from "@/types/budget"

type ManagedKind = "spending" | "savings" | "payback"

type DraftGroup = {
  id: string
  name: string
  kind: ManagedKind
  hidden: boolean
  /** Soft-deleted in this draft; removed on save */
  removed: boolean
  isNew?: boolean
}

type Props = {
  open: boolean
  buckets: Bucket[]
  onOpenChange: (open: boolean) => void
  onSave: (nextBuckets: Bucket[]) => void
  /** Open the full per-group category editor */
  onEditGroup: (bucket: Bucket) => void
}

const KIND_DEFAULT_NAME: Record<ManagedKind, string> = {
  spending: "New group",
  savings: "New savings",
  payback: "New payback",
}

const KIND_FALLBACK_NAME: Record<ManagedKind, string> = {
  spending: "Group",
  savings: "Savings",
  payback: "Payback",
}

function isManagedBucket(
  bucket: Bucket,
): bucket is Bucket & { kind: ManagedKind } {
  return (
    bucket.kind === "spending" ||
    bucket.kind === "savings" ||
    bucket.kind === "payback"
  )
}

function toDrafts(buckets: Bucket[]): DraftGroup[] {
  return buckets.filter(isManagedBucket).map((b) => ({
    id: b.id,
    name: b.name,
    kind: b.kind,
    hidden: Boolean(b.hidden),
    removed: false,
  }))
}

function mergeOrder(
  all: Bucket[],
  spending: Bucket[],
  payback: Bucket[],
  savings: Bucket[],
): Bucket[] {
  const managed = new Set(
    [...spending, ...payback, ...savings].map((b) => b.id),
  )
  const before: Bucket[] = []
  const after: Bucket[] = []
  let seen = false
  for (const b of all) {
    if (managed.has(b.id)) {
      seen = true
      continue
    }
    if (!seen) before.push(b)
    else after.push(b)
  }
  return [...before, ...spending, ...payback, ...savings, ...after]
}

export function EditGroupsDialog({
  open,
  buckets,
  onOpenChange,
  onSave,
  onEditGroup,
}: Props) {
  const [drafts, setDrafts] = useState<DraftGroup[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null | undefined>(
    undefined,
  )
  const rowRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    if (!open) return
    setDrafts(toDrafts(buckets))
    setDraggingId(null)
    setDropBeforeId(undefined)
  }, [open, buckets])

  const expenseDrafts = useMemo(
    () => drafts.filter((d) => d.kind === "spending" && !d.removed),
    [drafts],
  )
  const paybackDrafts = useMemo(
    () => drafts.filter((d) => d.kind === "payback" && !d.removed),
    [drafts],
  )
  const savingsDrafts = useMemo(
    () => drafts.filter((d) => d.kind === "savings" && !d.removed),
    [drafts],
  )

  function sectionList(kind: ManagedKind) {
    if (kind === "spending") return expenseDrafts
    if (kind === "payback") return paybackDrafts
    return savingsDrafts
  }

  function updateDraft(id: string, patch: Partial<DraftGroup>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  function addGroup(kind: ManagedKind) {
    const id = crypto.randomUUID()
    setDrafts((prev) => [
      ...prev,
      {
        id,
        name: KIND_DEFAULT_NAME[kind],
        kind,
        hidden: false,
        removed: false,
        isNew: true,
      },
    ])
  }

  function startDrag(id: string, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const kind = drafts.find((d) => d.id === id)?.kind
    if (!kind) return
    setDraggingId(id)
    const onMove = (ev: PointerEvent) => {
      const list = sectionList(kind)
      let before: string | null = null
      for (const d of list) {
        if (d.id === id) continue
        const el = rowRefs.current.get(d.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (ev.clientY < rect.top + rect.height / 2) {
          before = d.id
          break
        }
      }
      setDropBeforeId(before)
    }
    const onUp = () => {
      setDraggingId((from) => {
        if (from) {
          setDropBeforeId((before) => {
            const ids = sectionList(kind).map((d) => d.id)
            if (!isReorderNoOp(ids, from, before ?? null)) {
              setDrafts((prev) => {
                const section = prev.filter(
                  (d) => d.kind === kind && !d.removed,
                )
                const reordered = reorderById(section, from, before ?? null)
                const spending =
                  kind === "spending"
                    ? reordered
                    : prev.filter((d) => d.kind === "spending" && !d.removed)
                const payback =
                  kind === "payback"
                    ? reordered
                    : prev.filter((d) => d.kind === "payback" && !d.removed)
                const savings =
                  kind === "savings"
                    ? reordered
                    : prev.filter((d) => d.kind === "savings" && !d.removed)
                const others = prev.filter(
                  (d) =>
                    d.removed ||
                    (d.kind !== "spending" &&
                      d.kind !== "payback" &&
                      d.kind !== "savings"),
                )
                const removed = prev.filter((d) => d.removed)
                return [
                  ...others.filter((d) => !d.removed),
                  ...spending,
                  ...payback,
                  ...savings,
                  ...removed,
                ]
              })
            }
            return undefined
          })
        }
        return null
      })
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  function handleSave() {
    const live = drafts.filter((d) => !d.removed)
    const byId = new Map(buckets.map((b) => [b.id, b]))
    const spending: Bucket[] = []
    const payback: Bucket[] = []
    const savings: Bucket[] = []
    for (const d of live) {
      const existing = byId.get(d.id)
      const next: Bucket = existing
        ? { ...existing, name: d.name.trim() || existing.name, hidden: d.hidden }
        : {
            id: d.id,
            name: d.name.trim() || KIND_FALLBACK_NAME[d.kind],
            kind: d.kind,
            hidden: d.hidden,
            categories: [],
          }
      if (d.kind === "spending") spending.push(next)
      else if (d.kind === "payback") payback.push(next)
      else savings.push(next)
    }
    const removedIds = new Set(drafts.filter((d) => d.removed).map((d) => d.id))
    const kept = buckets.filter((b) => !removedIds.has(b.id))
    onSave(mergeOrder(kept, spending, payback, savings))
    onOpenChange(false)
  }

  function renderSection(
    title: string,
    kind: ManagedKind,
    list: DraftGroup[],
  ) {
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => addGroup(kind)}
          >
            <Plus className="size-3.5" />
            Add group
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No groups yet.</p>
        ) : (
          <ul className="space-y-1">
            {list.map((d) => {
              const showDrop =
                draggingId &&
                drafts.find((x) => x.id === draggingId)?.kind === kind &&
                dropBeforeId === d.id
              return (
                <li key={d.id}>
                  {showDrop ? (
                    <div className="mb-1 h-0.5 rounded-full bg-neutral-900" />
                  ) : null}
                  <div
                    ref={(el) => {
                      if (el) rowRefs.current.set(d.id, el)
                      else rowRefs.current.delete(d.id)
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5",
                      draggingId === d.id && "opacity-50",
                      d.hidden && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      title="Drag to reorder"
                      className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center text-neutral-400 active:cursor-grabbing"
                      onPointerDown={(e) => startDrag(d.id, e)}
                    >
                      <Menu className="size-3.5" strokeWidth={2} />
                    </button>
                    <Input
                      value={d.name}
                      onChange={(e) =>
                        updateDraft(d.id, { name: e.target.value })
                      }
                      className="h-8 min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      title="Edit categories"
                      className={cn(
                        "shrink-0 rounded-md px-2 py-1 text-xs font-medium text-foreground",
                        blushHoverClass,
                      )}
                      onClick={() => {
                        const full = buckets.find((b) => b.id === d.id)
                        if (full) {
                          onOpenChange(false)
                          onEditGroup({
                            ...full,
                            name: d.name.trim() || full.name,
                            hidden: d.hidden,
                          })
                        }
                      }}
                    >
                      Categories
                    </button>
                    <button
                      type="button"
                      title={d.hidden ? "Show group" : "Hide group"}
                      className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() => updateDraft(d.id, { hidden: !d.hidden })}
                    >
                      {d.hidden ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Delete group"
                      className="inline-flex size-8 shrink-0 items-center justify-center text-destructive hover:text-destructive/80"
                      onClick={() => updateDraft(d.id, { removed: true })}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
            {draggingId &&
            drafts.find((x) => x.id === draggingId)?.kind === kind &&
            dropBeforeId === null ? (
              <div className="mt-1 h-0.5 rounded-full bg-neutral-900" />
            ) : null}
          </ul>
        )}
      </section>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle>Edit groups</DialogTitle>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
          {renderSection("Expenses", "spending", expenseDrafts)}
          {renderSection("Payback", "payback", paybackDrafts)}
          {renderSection("Savings", "savings", savingsDrafts)}
        </div>
        <DialogFooter className="m-0 rounded-none border-t px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
