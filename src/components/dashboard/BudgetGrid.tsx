import { useEffect, useMemo, useRef, useState } from "react"
import { Check } from "lucide-react"
import { CategoryDrawer } from "@/components/dashboard/CategoryDrawer"
import { allocationKey, formatMoney, formatPayDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Bucket, Category, Paycheck } from "@/types/budget"

type Props = {
  buckets: Bucket[]
  paychecks: Paycheck[]
  doneKeys: Set<string>
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
}

const W = { bucket: 92, category: 168, goal: 76, balance: 76, pay: 128 } as const
const LEFT_WIDTH = W.bucket + W.category + W.goal + W.balance

const paneBg = "bg-white dark:bg-background"

type GridRow = {
  key: string
  rowCount: number
  isFirstInBucket: boolean
  isLastInBucket: boolean
  showBucketDivider: boolean
}

/**
 * Split-pane budget grid.
 *
 * Left pane (Bucket → Balance) does not scroll horizontally.
 * Right pane (paycheck columns) scrolls independently.
 * Outer frame owns 8px radius + clip. Left pane owns the scroll shadow.
 * Sticky offsets are intentionally not used — that keeps cosmetics independent.
 */
export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftTableRef = useRef<HTMLTableElement>(null)
  const rightTableRef = useRef<HTMLTableElement>(null)
  const leftHeaderRef = useRef<HTMLTableRowElement>(null)
  const rightHeaderRef = useRef<HTMLTableRowElement>(null)
  const leftRowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const rightRowRefs = useRef(new Map<string, HTMLTableRowElement>())

  const [scrolled, setScrolled] = useState(false)
  const [selected, setSelected] = useState<{
    category: Category
    bucket: Bucket
  } | null>(null)

  const orderedBuckets = useMemo(
    () => [
      ...buckets.filter((b) => b.kind !== "savings"),
      ...buckets.filter((b) => b.kind === "savings"),
    ],
    [buckets],
  )

  const rows = useMemo(() => {
    const result: GridRow[] = []
    orderedBuckets.forEach((bucket, bucketIndex) => {
      bucket.categories.forEach((category, rowIndex) => {
        result.push({
          key: category.id,
          rowCount: bucket.categories.length,
          isFirstInBucket: rowIndex === 0,
          isLastInBucket: rowIndex === bucket.categories.length - 1,
          showBucketDivider: rowIndex === 0 && bucketIndex > 0,
        })
      })
    })
    return result
  }, [orderedBuckets])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const currentPaycheckId = useMemo(() => {
    return (
      paychecks.find((p) => !p.completed && p.date >= today)?.id ??
      paychecks.find((p) => !p.completed)?.id
    )
  }, [paychecks, today])

  const upcomingIndex = useMemo(
    () => paychecks.findIndex((p) => p.id === currentPaycheckId),
    [paychecks, currentPaycheckId],
  )

  // Scroll right pane so the upcoming paycheck is visible
  useEffect(() => {
    const el = scrollRef.current
    if (!el || upcomingIndex < 0) return
    el.scrollLeft = Math.max(0, upcomingIndex - 1) * W.pay
    setScrolled(el.scrollLeft > 1)
  }, [upcomingIndex])

  // Track horizontal scroll + map vertical wheel to horizontal in the right pane
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollLeft > 1)
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("wheel", onWheel)
    }
  }, [])

  // Keep left/right row heights matched
  useEffect(() => {
    const sync = () => {
      const pairs: Array<[HTMLTableRowElement | null, HTMLTableRowElement | null]> = [
        [leftHeaderRef.current, rightHeaderRef.current],
        ...rows.map(
          (row) =>
            [
              leftRowRefs.current.get(row.key) ?? null,
              rightRowRefs.current.get(row.key) ?? null,
            ] as [HTMLTableRowElement | null, HTMLTableRowElement | null],
        ),
      ]

      for (const [left, right] of pairs) {
        if (!left || !right) continue
        left.style.height = ""
        right.style.height = ""
      }

      for (const [left, right] of pairs) {
        if (!left || !right) continue
        const height = Math.max(left.offsetHeight, right.offsetHeight)
        left.style.height = `${height}px`
        right.style.height = `${height}px`
      }
    }

    sync()
    const ro = new ResizeObserver(sync)
    if (leftTableRef.current) ro.observe(leftTableRef.current)
    if (rightTableRef.current) ro.observe(rightTableRef.current)
    return () => ro.disconnect()
  }, [rows, paychecks])

  const balanceEdge = scrolled ? "" : "border-r border-r-neutral-900"

  function setLeftRowRef(key: string, el: HTMLTableRowElement | null) {
    if (el) leftRowRefs.current.set(key, el)
    else leftRowRefs.current.delete(key)
  }

  function setRightRowRef(key: string, el: HTMLTableRowElement | null) {
    if (el) rightRowRefs.current.set(key, el)
    else rightRowRefs.current.delete(key)
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[8px] border border-neutral-500">
        <div className="flex">
          {/* Left pane: labels stay put; owns the continuous scroll shadow */}
          <div
            className={cn("relative z-10 shrink-0", paneBg)}
            style={{
              width: LEFT_WIDTH,
              boxShadow: scrolled
                ? "6px 0 10px rgba(0, 0, 0, 0.16)"
                : "none",
            }}
          >
            <table
              ref={leftTableRef}
              className="w-full border-separate border-spacing-0 text-sm"
            >
              <colgroup>
                <col style={{ width: W.bucket }} />
                <col style={{ width: W.category }} />
                <col style={{ width: W.goal }} />
                <col style={{ width: W.balance }} />
              </colgroup>

              <thead>
                <tr ref={leftHeaderRef}>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 border-r border-r-neutral-900 px-2 py-3",
                      paneBg,
                    )}
                  />
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 border-r border-r-border/60 px-3 py-3 text-left font-medium",
                      paneBg,
                    )}
                  >
                    Category
                  </th>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 border-r border-r-border/60 px-3 py-3 text-right font-medium",
                      paneBg,
                    )}
                  >
                    Goal
                  </th>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 px-3 py-3 text-right font-medium",
                      paneBg,
                      balanceEdge,
                    )}
                  >
                    Balance
                  </th>
                </tr>
              </thead>

              {orderedBuckets.map((bucket) => (
                <tbody key={bucket.id}>
                  {bucket.categories.map((category) => {
                    const row = rows.find((r) => r.key === category.id)!

                    return (
                      <tr
                        key={category.id}
                        ref={(el) => setLeftRowRef(category.id, el)}
                      >
                        {row.isFirstInBucket ? (
                          <td
                            rowSpan={row.rowCount}
                            className={cn(
                              "border-r border-r-neutral-900 px-2 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                              paneBg,
                              row.showBucketDivider &&
                                "border-t-2 border-t-neutral-900",
                            )}
                          >
                            {bucket.name}
                          </td>
                        ) : null}

                        <td
                          className={cn(
                            "border-r border-r-border/60 px-3",
                            paneBg,
                            row.showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            !row.isLastInBucket && "border-b border-b-border/60",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelected({ category, bucket })}
                            className="h-9 w-full text-left text-sm underline-offset-2 hover:underline"
                          >
                            {category.name}
                          </button>
                        </td>

                        <td
                          className={cn(
                            "border-r border-r-border/60 px-3 text-right tabular-nums text-muted-foreground",
                            paneBg,
                            row.showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            !row.isLastInBucket && "border-b border-b-border/60",
                          )}
                        >
                          {bucket.kind === "savings"
                            ? formatMoney(category.goal)
                            : ""}
                        </td>

                        <td
                          className={cn(
                            "px-3 text-right tabular-nums text-muted-foreground",
                            paneBg,
                            balanceEdge,
                            row.showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            !row.isLastInBucket && "border-b border-b-border/60",
                          )}
                        >
                          {bucket.kind === "savings"
                            ? formatMoney(category.balance)
                            : ""}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </div>

          {/* Right pane: paycheck columns scroll horizontally */}
          <div
            ref={scrollRef}
            className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="relative w-max min-w-full">
              {upcomingIndex >= 0 ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-[5] border-2 border-sky-400"
                  style={{
                    left: upcomingIndex * W.pay,
                    top: 0,
                    bottom: 0,
                    width: W.pay,
                  }}
                />
              ) : null}

              <table
                ref={rightTableRef}
                className="border-separate border-spacing-0 text-sm"
              >
                <colgroup>
                  {paychecks.map((p) => (
                    <col key={p.id} style={{ width: W.pay }} />
                  ))}
                </colgroup>

                <thead>
                  <tr ref={rightHeaderRef}>
                    {paychecks.map((p, i) => {
                      const isUpcoming = p.id === currentPaycheckId
                      const isLast = i === paychecks.length - 1
                      return (
                        <th
                          key={p.id}
                          className={cn(
                            "border-b-2 border-b-neutral-900 px-1 py-3 text-center font-medium",
                            !isLast && "border-r border-r-border/60",
                            isUpcoming
                              ? "bg-sky-100 text-sky-950"
                              : p.completed
                                ? "bg-neutral-100 text-muted-foreground"
                                : cn(paneBg, "text-muted-foreground"),
                          )}
                          style={{ width: W.pay, minWidth: W.pay }}
                        >
                          {formatPayDate(p.date)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                {orderedBuckets.map((bucket) => (
                  <tbody key={bucket.id}>
                    {bucket.categories.map((category) => {
                      const row = rows.find((r) => r.key === category.id)!

                      return (
                        <tr
                          key={category.id}
                          ref={(el) => setRightRowRef(category.id, el)}
                        >
                          {paychecks.map((p, i) => {
                            const raw = category.allocations[p.date]
                            const key = allocationKey(category.id, p.id)
                            const hasAmount =
                              raw !== "" &&
                              raw !== undefined &&
                              Number(raw) !== 0
                            const empty = !hasAmount
                            const isUpcoming = p.id === currentPaycheckId
                            const manuallyDone = doneKeys.has(key)
                            const isLastCol = i === paychecks.length - 1
                            const isPast =
                              p.completed ||
                              (upcomingIndex >= 0 && i < upcomingIndex)
                            const cellGray =
                              isPast &&
                              (empty || manuallyDone || p.completed)
                            const canMarkDone =
                              hasAmount && (p.date <= today || isUpcoming)

                            return (
                              <td
                                key={p.id}
                                className={cn(
                                  "bg-white px-1 dark:bg-background",
                                  !isLastCol && "border-r border-r-border/60",
                                  row.showBucketDivider &&
                                    "border-t-2 border-t-neutral-900",
                                  !row.isLastInBucket &&
                                    "border-b border-b-border/60",
                                  cellGray &&
                                    "bg-neutral-100 dark:bg-neutral-900",
                                )}
                                style={{ width: W.pay, minWidth: W.pay }}
                              >
                                <AmountCell
                                  value={
                                    raw === "" || raw === undefined
                                      ? ""
                                      : String(raw)
                                  }
                                  done={manuallyDone}
                                  showCheck={canMarkDone || manuallyDone}
                                  onChange={(value) =>
                                    onAmountChange(category.id, p.date, value)
                                  }
                                  onToggleDone={() => onToggleDone(key)}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </div>
      </div>

      <CategoryDrawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        category={selected?.category ?? null}
        bucket={selected?.bucket ?? null}
        paychecks={paychecks}
        doneKeys={doneKeys}
      />
    </div>
  )
}

function AmountCell({
  value,
  done,
  showCheck,
  onChange,
  onToggleDone,
}: {
  value: string
  done: boolean
  showCheck: boolean
  onChange: (value: string) => void
  onToggleDone: () => void
}) {
  const [editing, setEditing] = useState(false)
  const canCheck = showCheck || done

  return (
    <div className="group/cell flex h-9 items-center gap-1 px-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!canCheck) return
          onToggleDone()
        }}
        disabled={!canCheck}
        title={done ? "Unmark" : "Mark moved"}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
          done
            ? "border-neutral-200 bg-neutral-100 text-neutral-400"
            : "border-transparent text-neutral-300 opacity-0 group-hover/cell:opacity-100",
          canCheck &&
            !done &&
            "hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-500",
          !canCheck && "pointer-events-none opacity-0",
        )}
      >
        <Check className="size-3" strokeWidth={2.5} />
      </button>

      <div
        className={cn(
          "flex min-w-0 flex-1 cursor-text items-center justify-end rounded-md border border-transparent px-1",
          "hover:border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        )}
        onClick={() => setEditing(true)}
      >
        {editing ? (
          <input
            autoFocus
            className="h-7 w-full bg-transparent text-right text-sm tabular-nums outline-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
            inputMode="numeric"
          />
        ) : value !== "" ? (
          <span className="text-sm tabular-nums">${value}</span>
        ) : null}
      </div>
    </div>
  )
}
