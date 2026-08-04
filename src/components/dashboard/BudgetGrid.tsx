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

/** Fixed pixel widths — sticky `left` must match these exactly */
const W = { bucket: 112, category: 192, goal: 96, balance: 96, pay: 128 } as const
const LEFT = {
  bucket: 0,
  category: W.bucket,
  goal: W.bucket + W.category,
  balance: W.bucket + W.category + W.goal,
} as const
const STICKY_TOTAL = W.bucket + W.category + W.goal + W.balance

const stickyBg = "bg-white dark:bg-background"

export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [selected, setSelected] = useState<{
    category: Category
    bucket: Bucket
  } | null>(null)

  const scrolled = scrollLeft > 1

  const orderedBuckets = useMemo(
    () => [
      ...buckets.filter((b) => b.kind !== "savings"),
      ...buckets.filter((b) => b.kind === "savings"),
    ],
    [buckets],
  )

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

  useEffect(() => {
    const el = scrollRef.current
    if (!el || upcomingIndex < 0) return
    el.scrollLeft = Math.max(0, upcomingIndex - 1) * W.pay
    setScrollLeft(el.scrollLeft)
  }, [upcomingIndex])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrollLeft(el.scrollLeft)
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

  /** Thin black when at start; continuous shadow when scrolled (not per-row) */
  const balanceEdge = scrolled ? "" : "border-r border-r-neutral-900"

  return (
    <div>
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative w-max min-w-full">
          {upcomingIndex >= 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-[5] rounded border-2 border-sky-400"
              style={{
                left: STICKY_TOTAL + upcomingIndex * W.pay,
                top: 0,
                bottom: 0,
                width: W.pay,
              }}
            />
          ) : null}

          {/* One smooth vertical shadow along Balance edge (not per row) */}
          {scrolled ? (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 z-[25] w-0"
              style={{
                left: STICKY_TOTAL + scrollLeft,
                boxShadow: "6px 0 10px rgba(0,0,0,0.16)",
              }}
            />
          ) : null}

          <table className="border-separate border-spacing-0 text-sm">
            <colgroup>
              <col style={{ width: W.bucket }} />
              <col style={{ width: W.category }} />
              <col style={{ width: W.goal }} />
              <col style={{ width: W.balance }} />
              {paychecks.map((p) => (
                <col key={p.id} style={{ width: W.pay }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th
                  className={cn(
                    "sticky z-30 relative overflow-visible border-b-2 border-b-neutral-900 border-l border-l-neutral-500 border-t border-t-neutral-500 px-2 py-3",
                    "rounded-tl-lg",
                    stickyBg,
                  )}
                  style={{ left: LEFT.bucket, width: W.bucket, minWidth: W.bucket }}
                >
                  {/* Square opaque underlay — prevents scroll bleed in rounded corner */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 bg-white dark:bg-background"
                  />
                </th>
                <th
                  className={cn(
                    "sticky z-30 border-b-2 border-b-neutral-900 border-r border-r-border/60 border-t border-t-neutral-500 px-3 py-3 text-left font-medium",
                    stickyBg,
                  )}
                  style={{ left: LEFT.category, width: W.category, minWidth: W.category }}
                >
                  Category
                </th>
                <th
                  className={cn(
                    "sticky z-30 border-b-2 border-b-neutral-900 border-r border-r-border/60 border-t border-t-neutral-500 px-3 py-3 text-right font-medium",
                    stickyBg,
                  )}
                  style={{ left: LEFT.goal, width: W.goal, minWidth: W.goal }}
                >
                  Goal
                </th>
                <th
                  className={cn(
                    "sticky z-30 border-b-2 border-b-neutral-900 border-t border-t-neutral-500 px-3 py-3 text-right font-medium",
                    stickyBg,
                    balanceEdge,
                  )}
                  style={{ left: LEFT.balance, width: W.balance, minWidth: W.balance }}
                >
                  Balance
                </th>
                {paychecks.map((p, i) => {
                  const isUpcoming = p.id === currentPaycheckId
                  const isLast = i === paychecks.length - 1
                  return (
                    <th
                      key={p.id}
                      className={cn(
                        "border-b-2 border-b-neutral-900 border-t border-t-neutral-500 px-1 py-3 text-center font-medium",
                        !isLast && "border-r border-r-border/60",
                        isLast && "rounded-tr-lg border-r border-r-neutral-500",
                        isUpcoming
                          ? "bg-sky-100 text-sky-950"
                          : p.completed
                            ? "bg-neutral-100 text-muted-foreground"
                            : cn(stickyBg, "text-muted-foreground"),
                      )}
                      style={{ width: W.pay, minWidth: W.pay }}
                    >
                      {formatPayDate(p.date)}
                    </th>
                  )
                })}
              </tr>
            </thead>

            {orderedBuckets.map((bucket, bucketIndex) => (
              <tbody key={bucket.id}>
                {bucket.categories.map((cat, rowIndex) => {
                  const isFirstRow = rowIndex === 0
                  const isLastBucket = bucketIndex === orderedBuckets.length - 1
                  const isLastRow = rowIndex === bucket.categories.length - 1
                  const isVeryLast = isLastBucket && isLastRow
                  const showBucketDivider = isFirstRow && bucketIndex > 0
                  const showRowDivider = !isLastRow

                  return (
                    <tr key={cat.id}>
                      {isFirstRow ? (
                        <td
                          rowSpan={bucket.categories.length}
                          className={cn(
                            "sticky z-20 relative overflow-visible border-l border-l-neutral-500 border-r border-r-border/60 px-2 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                            stickyBg,
                            showBucketDivider && "border-t-2 border-t-neutral-900",
                            isLastBucket &&
                              "rounded-bl-lg border-b border-b-neutral-500",
                          )}
                          style={{ left: LEFT.bucket, width: W.bucket, minWidth: W.bucket }}
                        >
                          {isLastBucket ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 -z-10 bg-white dark:bg-background"
                            />
                          ) : null}
                          {bucket.name}
                        </td>
                      ) : null}

                      <td
                        className={cn(
                          "sticky z-20 border-r border-r-border/60 px-3",
                          stickyBg,
                          showBucketDivider && "border-t-2 border-t-neutral-900",
                          showRowDivider && "border-b border-b-border/60",
                          isVeryLast && "border-b border-b-neutral-500",
                        )}
                        style={{ left: LEFT.category, width: W.category, minWidth: W.category }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected({ category: cat, bucket })}
                          className="h-9 w-full text-left text-sm underline-offset-2 hover:underline"
                        >
                          {cat.name}
                        </button>
                      </td>

                      <td
                        className={cn(
                          "sticky z-20 border-r border-r-border/60 px-3 text-right tabular-nums text-muted-foreground",
                          stickyBg,
                          showBucketDivider && "border-t-2 border-t-neutral-900",
                          showRowDivider && "border-b border-b-border/60",
                          isVeryLast && "border-b border-b-neutral-500",
                        )}
                        style={{ left: LEFT.goal, width: W.goal, minWidth: W.goal }}
                      >
                        {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
                      </td>

                      <td
                        className={cn(
                          "sticky z-20 px-3 text-right tabular-nums text-muted-foreground",
                          stickyBg,
                          balanceEdge,
                          showBucketDivider && "border-t-2 border-t-neutral-900",
                          showRowDivider && "border-b border-b-border/60",
                          isVeryLast && "border-b border-b-neutral-500",
                        )}
                        style={{ left: LEFT.balance, width: W.balance, minWidth: W.balance }}
                      >
                        {bucket.kind === "savings" ? formatMoney(cat.balance) : ""}
                      </td>

                      {paychecks.map((p, i) => {
                        const raw = cat.allocations[p.date]
                        const key = allocationKey(cat.id, p.id)
                        const hasAmount =
                          raw !== "" && raw !== undefined && Number(raw) !== 0
                        const empty = !hasAmount
                        const isUpcoming = p.id === currentPaycheckId
                        const manuallyDone = doneKeys.has(key)
                        const isLastCol = i === paychecks.length - 1
                        const isPast =
                          p.completed ||
                          (upcomingIndex >= 0 && i < upcomingIndex)
                        const cellGray =
                          isPast && (empty || manuallyDone || p.completed)
                        const canMarkDone =
                          hasAmount && (p.date <= today || isUpcoming)

                        return (
                          <td
                            key={p.id}
                            className={cn(
                              "bg-white px-1 dark:bg-background",
                              !isLastCol && "border-r border-r-border/60",
                              isLastCol && "border-r border-r-neutral-500",
                              showBucketDivider && "border-t-2 border-t-neutral-900",
                              showRowDivider && "border-b border-b-border/60",
                              isVeryLast && "border-b border-b-neutral-500",
                              isVeryLast && isLastCol && "rounded-br-lg",
                              cellGray && "bg-neutral-100 dark:bg-neutral-900",
                            )}
                            style={{ width: W.pay, minWidth: W.pay }}
                          >
                            <AmountCell
                              value={
                                raw === "" || raw === undefined ? "" : String(raw)
                              }
                              done={manuallyDone}
                              showCheck={canMarkDone || manuallyDone}
                              onChange={(value) =>
                                onAmountChange(cat.id, p.date, value)
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
