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

const PAY_COL_PX = 128
const STICKY_WIDTH_PX = 112 + 192 + 96 + 96
const HEADER_RULE =
  "shadow-[inset_0_-2px_0_0_#171717] dark:shadow-[inset_0_-2px_0_0_#f5f5f5]"
const COL_DIV = "border-r border-border/60"
const ROW_DIV = "border-b border-border/60"
const BUCKET_RULE =
  "shadow-[inset_0_2px_0_0_#171717] dark:shadow-[inset_0_2px_0_0_#f5f5f5]"

/**
 * Square solid white layer (no radius) so nothing scrolled behind can show through.
 * Visual corner radius stays on the cell border only.
 */
function StickyFill() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 bg-white dark:bg-background"
    />
  )
}

export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
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
    el.scrollLeft = Math.max(0, upcomingIndex - 1) * PAY_COL_PX
    setScrolled(el.scrollLeft > 1)
  }, [upcomingIndex])

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

  const balanceEdge = scrolled
    ? "shadow-[6px_0_10px_-4px_rgba(0,0,0,0.18)]"
    : "border-r border-neutral-900"

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
                left: STICKY_WIDTH_PX + upcomingIndex * PAY_COL_PX,
                top: 0,
                bottom: 0,
                width: PAY_COL_PX,
              }}
            />
          ) : null}

          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  className={cn(
                    "sticky left-0 z-30 w-28 min-w-28 relative px-1 py-3",
                    "rounded-tl-lg border-l border-l-neutral-500 border-t border-t-neutral-500",
                    HEADER_RULE,
                  )}
                >
                  <StickyFill />
                </th>
                <th
                  className={cn(
                    "sticky left-[7rem] z-30 w-48 min-w-48 relative border-t border-t-neutral-500 px-1 py-3 text-left font-medium",
                    COL_DIV,
                    HEADER_RULE,
                  )}
                >
                  <StickyFill />
                  <span className="relative z-10 px-3">Category</span>
                </th>
                <th
                  className={cn(
                    "sticky left-[19rem] z-30 w-24 min-w-24 relative border-t border-t-neutral-500 px-1 py-3 text-right font-medium",
                    COL_DIV,
                    HEADER_RULE,
                  )}
                >
                  <StickyFill />
                  <span className="relative z-10 px-3">Goal</span>
                </th>
                <th
                  className={cn(
                    "sticky left-[25rem] z-30 w-24 min-w-24 relative border-t border-t-neutral-500 px-1 py-3 text-right font-medium",
                    HEADER_RULE,
                    balanceEdge,
                  )}
                >
                  <StickyFill />
                  <span className="relative z-10 px-3">Balance</span>
                </th>
                {paychecks.map((p, i) => {
                  const isUpcoming = p.id === currentPaycheckId
                  const isLast = i === paychecks.length - 1
                  return (
                    <th
                      key={p.id}
                      className={cn(
                        "w-32 min-w-32 border-t border-t-neutral-500 px-1 py-3 text-center font-medium",
                        HEADER_RULE,
                        !isLast && COL_DIV,
                        isLast &&
                          "rounded-tr-lg border-r border-r-neutral-500",
                        isUpcoming
                          ? "bg-sky-100 text-sky-950"
                          : p.completed
                            ? "bg-neutral-100 text-muted-foreground"
                            : "bg-white text-muted-foreground dark:bg-background",
                      )}
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
                  const isLastBucket =
                    bucketIndex === orderedBuckets.length - 1
                  const isLastRow =
                    rowIndex === bucket.categories.length - 1
                  const isVeryLast = isLastBucket && isLastRow
                  const showBucketDivider = isFirstRow && bucketIndex > 0
                  const showRowDivider = !isLastRow

                  const isPastCol = (p: Paycheck, idx: number) =>
                    p.completed ||
                    (upcomingIndex >= 0 && idx < upcomingIndex)

                  return (
                    <tr key={cat.id}>
                      {isFirstRow ? (
                        <td
                          rowSpan={bucket.categories.length}
                          className={cn(
                            "sticky left-0 z-20 w-28 min-w-28 relative border-l border-l-neutral-500 px-1 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                            COL_DIV,
                            showBucketDivider && BUCKET_RULE,
                            isLastBucket &&
                              "rounded-bl-lg border-b border-b-neutral-500",
                          )}
                        >
                          <StickyFill />
                          <span className="relative z-10 px-3">
                            {bucket.name}
                          </span>
                        </td>
                      ) : null}

                      <td
                        className={cn(
                          "sticky left-[7rem] z-20 w-48 min-w-48 relative px-1",
                          COL_DIV,
                          showBucketDivider && BUCKET_RULE,
                          showRowDivider && ROW_DIV,
                          isVeryLast && "border-b border-b-neutral-500",
                        )}
                      >
                        <StickyFill />
                        <button
                          type="button"
                          onClick={() => setSelected({ category: cat, bucket })}
                          className="relative z-10 h-9 w-full px-3 text-left text-sm font-normal underline-offset-2 hover:underline"
                        >
                          {cat.name}
                        </button>
                      </td>

                      <td
                        className={cn(
                          "sticky left-[19rem] z-20 w-24 min-w-24 relative px-1 text-right tabular-nums text-muted-foreground",
                          COL_DIV,
                          showBucketDivider && BUCKET_RULE,
                          showRowDivider && ROW_DIV,
                          isVeryLast && "border-b border-b-neutral-500",
                        )}
                      >
                        <StickyFill />
                        <span className="relative z-10 block px-3">
                          {bucket.kind === "savings"
                            ? formatMoney(cat.goal)
                            : ""}
                        </span>
                      </td>

                      <td
                        className={cn(
                          "sticky left-[25rem] z-20 w-24 min-w-24 relative px-1 text-right tabular-nums text-muted-foreground",
                          balanceEdge,
                          showBucketDivider && BUCKET_RULE,
                          showRowDivider && ROW_DIV,
                          isVeryLast && "border-b border-b-neutral-500",
                        )}
                      >
                        <StickyFill />
                        <span className="relative z-10 block px-3">
                          {bucket.kind === "savings"
                            ? formatMoney(cat.balance)
                            : ""}
                        </span>
                      </td>

                      {paychecks.map((p, i) => {
                        const raw = cat.allocations[p.date]
                        const key = allocationKey(cat.id, p.id)
                        const hasAmount =
                          raw !== "" &&
                          raw !== undefined &&
                          Number(raw) !== 0
                        const empty = !hasAmount
                        const isUpcoming = p.id === currentPaycheckId
                        const manuallyDone = doneKeys.has(key)
                        const isLastCol = i === paychecks.length - 1
                        const cellGray =
                          isPastCol(p, i) &&
                          (empty || manuallyDone || p.completed)
                        const canMarkDone =
                          hasAmount && (p.date <= today || isUpcoming)

                        return (
                          <td
                            key={p.id}
                            className={cn(
                              "w-32 min-w-32 bg-white px-1 dark:bg-background",
                              !isLastCol && COL_DIV,
                              isLastCol && "border-r border-r-neutral-500",
                              showBucketDivider && BUCKET_RULE,
                              showRowDivider && ROW_DIV,
                              isVeryLast && "border-b border-b-neutral-500",
                              isVeryLast && isLastCol && "rounded-br-lg",
                              cellGray && "bg-neutral-100 dark:bg-neutral-900",
                            )}
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
            className="h-7 w-full bg-transparent text-right text-sm tabular-nums text-foreground outline-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
            inputMode="numeric"
          />
        ) : value !== "" ? (
          <span className="text-sm tabular-nums text-foreground">
            ${value}
          </span>
        ) : null}
      </div>
    </div>
  )
}
