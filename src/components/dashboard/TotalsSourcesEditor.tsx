import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Bucket, TotalSource } from "@/types/budget"

type DraftSource = {
  key: string
  bucketId: string
  mode: "all" | "selected"
  categoryIds: string[]
}

type Props = {
  value: TotalSource[] | undefined
  /** Groups available to sum (excludes totals / empty). */
  sourceBuckets: Bucket[]
  onCancel: () => void
  onSave: (next: TotalSource[]) => void
}

function toDraft(sources: TotalSource[] | undefined): DraftSource[] {
  if (!sources || sources.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        bucketId: "",
        mode: "all",
        categoryIds: [],
      },
    ]
  }
  return sources.map((s) => ({
    key: crypto.randomUUID(),
    bucketId: s.bucketId,
    mode: s.categoryIds === "all" ? "all" : "selected",
    categoryIds: s.categoryIds === "all" ? [] : [...s.categoryIds],
  }))
}

export function TotalsSourcesEditor({
  value,
  sourceBuckets,
  onCancel,
  onSave,
}: Props) {
  const [drafts, setDrafts] = useState<DraftSource[]>(() => toDraft(value))

  const canSave = useMemo(
    () =>
      drafts.some(
        (d) =>
          d.bucketId !== "" &&
          (d.mode === "all" || d.categoryIds.length > 0),
      ),
    [drafts],
  )

  function update(key: string, patch: Partial<DraftSource>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    )
  }

  function handleSave() {
    const next: TotalSource[] = drafts
      .filter(
        (d) =>
          d.bucketId !== "" &&
          (d.mode === "all" || d.categoryIds.length > 0),
      )
      .map((d) => ({
        bucketId: d.bucketId,
        categoryIds: d.mode === "all" ? "all" : d.categoryIds,
      }))
    onSave(next)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Sources</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick groups (and optional categories) to sum for each paycheck.
        </p>
      </div>

      <div className="space-y-3">
        {drafts.map((draft) => {
          const bucket = sourceBuckets.find((b) => b.id === draft.bucketId)
          const categories = (bucket?.categories ?? []).filter((c) => !c.hidden)

          return (
            <div
              key={draft.key}
              className="grid grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_28px] items-start gap-2"
            >
              <Select
                value={draft.bucketId || undefined}
                onValueChange={(id) =>
                  update(draft.key, {
                    bucketId: id,
                    mode: "all",
                    categoryIds: [],
                  })
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {sourceBuckets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={draft.mode}
                disabled={!draft.bucketId}
                onValueChange={(v) =>
                  update(draft.key, {
                    mode: v as "all" | "selected",
                    categoryIds: v === "all" ? [] : draft.categoryIds,
                  })
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="selected">Select categories</SelectItem>
                </SelectContent>
              </Select>

              {draft.mode === "selected" && draft.bucketId ? (
                <CategoryMultiSelect
                  categories={categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                  }))}
                  selected={draft.categoryIds}
                  onChange={(ids) => update(draft.key, { categoryIds: ids })}
                />
              ) : (
                <div className="h-10" />
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-1.5 text-muted-foreground"
                disabled={drafts.length === 1}
                onClick={() =>
                  setDrafts((prev) => prev.filter((d) => d.key !== draft.key))
                }
                title="Remove source"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )
        })}

        <Button
          type="button"
          variant="outline"
          className="gap-1"
          onClick={() =>
            setDrafts((prev) => [
              ...prev,
              {
                key: crypto.randomUUID(),
                bucketId: "",
                mode: "all",
                categoryIds: [],
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          Add group
        </Button>
      </div>

      <div className="-mx-6 -mb-6 mt-6 flex items-center justify-end gap-3 border-t bg-muted/50 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" disabled={!canSave} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )
}

function CategoryMultiSelect({
  categories,
  selected,
  onChange,
}: {
  categories: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(selected), [selected])

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id))
    else onChange([...selected, id])
  }

  const label =
    selected.length === 0
      ? "Category"
      : `${selected.length} selected`

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-left text-sm",
          selected.length === 0 && "text-muted-foreground",
        )}
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            setOpen(false)
          }
        }}
      >
        <span className="truncate">{label}</span>
      </button>
      {open ? (
        <div
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-auto rounded-lg border bg-popover p-1 shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {categories.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No categories
            </p>
          ) : (
            categories.map((c) => {
              const checked = selectedSet.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    checked
                      ? "bg-neutral-100 font-medium text-foreground"
                      : "hover:bg-muted",
                  )}
                  onClick={() => toggle(c.id)}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border text-[10px]",
                      checked
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-input",
                    )}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
