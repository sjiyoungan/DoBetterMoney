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

type DraftGroup = {
  id: string
  name: string
  kind: "spending" | "savings"
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

function toDrafts(buckets: Bucket[]): DraftGroup[] {
  return buckets
    .filter((b) => b.kind === "spending" || b.kind === "savings")
    .map((b) => ({
      id: b.id,
      name: b.name,
      kind: b.kind as "spending" | "savings",
      hidden: Boolean(b.hidden),
      removed: false,
    }))
}

function mergeOrder(
  all: Bucket[],
  spending: Bucket[],
  savings: Bucket[],
): Bucket[] {
  const managed = new Set([...spending, ...savings].map((b) => b.id))
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
  return [...before, ...spending, ...savings, ...after]
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
  const savingsDrafts = useMemo(
    () => drafts.filter((d) => d.kind === "savings" && !d.removed),
    [drafts],
  )

  function updateDraft(id: string, patch: Partial<DraftGroup>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  function addGroup(kind: "spending" | "savings") {
    const id = crypto.randomUUID()
    setDrafts((prev) => [
      ...prev,
      {
        id,
        name: kind === "savings" ? "New savings" : "New group",
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
      const list = kind === "spending" ? expenseDrafts : savingsDrafts
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
            const ids = (
              kind === "spending" ? expenseDrafts : savingsDrafts
            ).map((d) => d.id)
            if (!isReorderNoOp(ids, from, before ?? null)) {
              setDrafts((prev) => {
                const section = prev.filter(
                  (d) => d.kind === kind && !d.removed,
                )
                const rest = prev.filter(
                  (d) => !(d.kind === kind && !d.removed),
                )
                const reordered = reorderById(section, from, before ?? null)
                const spending =
                  kind === "spending"
                    ? reordered
                    : prev.filter((d) => d.kind === "spending" && !d.removed)
                const savings =
                  kind === "savings"
                    ? reordered
                    : prev.filter((d) => d.kind === "savings" && !d.removed)
                const others = rest.filter(
                  (d) => d.kind !== "spending" && d.kind !== "savings",
                )
                const removed = prev.filter((d) => d.removed)
                return [...others, ...spending, ...savings, ...removed]
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
    const savings: Bucket[] = []
    for (const d of live) {
      const existing = byId.get(d.id)
      const next: Bucket = existing
        ? { ...existing, name: d.name.trim() || existing.name, hidden: d.hidden }
        : {
            id: d.id,
            name: d.name.trim() || (d.kind === "savings" ? "Savings" : "Group"),
            kind: d.kind,
            hidden: d.hidden,
            categories: [],
          }
      if (d.kind === "spending") spending.push(next)
      else savings.push(next)
    }
    const removedIds = new Set(drafts.filter((d) => d.removed).map((d) => d.id))
    const kept = buckets.filter((b) => !removedIds.has(b.id))
    onSave(mergeOrder(kept, spending, savings))
    onOpenChange(false)
  }

  function renderSection(
    title: string,
    kind: "spending" | "savings",
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
                        } else if (d.isNew) {
                          // Save first via parent is awkward; keep inline name only for new
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
