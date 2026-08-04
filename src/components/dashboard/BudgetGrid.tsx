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

export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
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
  }, [upcomingIndex])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

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
                    "sticky left-0 z-30 w-28 min-w-28 border-b-2 border-l border-t border-neutral-900 bg-white px-2 py-3 text-left font-medium dark:bg-background",
                    "rounded-tl-lg",
                  )}
                />
                <th
                  className={cn(
                    "sticky left-[7rem] z-30 w-48 min-w-48 border-b-2 border-t border-r border-neutral-900 bg-white px-4 py-3 text-left font-medium dark:bg-background",
                  )}
                >
                  Category
                </th>
                <th
                  className={cn(
                    "sticky left-[19rem] z-30 w-24 min-w-24 border-b-2 border-t border-r border-neutral-900 bg-white px-3 py-3 text-right font-medium dark:bg-background",
                  )}
                >
                  Goal
                </th>
                <th
                  className={cn(
                    "sticky left-[25rem] z-30 w-24 min-w-24 border-b-2 border-t border-r border-neutral-900 bg-white px-3 py-3 text-right font-medium shadow-[2px_0_0_0_var(--border)] dark:bg-background",
                  )}
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
                        "w-32 min-w-32 border-b-2 border-t border-neutral-900 px-2 py-3 text-center font-medium",
                        !isLast && "border-r border-border/70",
                        isLast && "rounded-tr-lg border-r border-border",
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

                  const upcomingIdx = upcomingIndex
                  const isPastCol = (p: Paycheck, idx: number) =>
                    p.completed || (upcomingIdx >= 0 && idx < upcomingIdx)

                  return (
                    <tr key={cat.id}>
                      {isFirstRow ? (
                        <td
                          rowSpan={bucket.categories.length}
                          className={cn(
                            "sticky left-0 z-20 w-28 min-w-28 border-l border-r border-border bg-white px-2 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-background",
                            showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            isVeryLast &&
                              "rounded-bl-lg border-b border-border",
                          )}
                        >
                          {bucket.name}
                        </td>
                      ) : null}

                      <td
                        className={cn(
                          "sticky left-[7rem] z-20 w-48 min-w-48 border-r border-border bg-white px-4 dark:bg-background",
                          showBucketDivider && "border-t-2 border-t-neutral-900",
                          isVeryLast && "border-b border-border",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected({ category: cat, bucket })}
                          className="h-9 w-full text-left text-sm font-normal underline-offset-2 hover:underline"
                        >
                          {cat.name}
                        </button>
                      </td>

                      <td
                        className={cn(
                          "sticky left-[19rem] z-20 w-24 min-w-24 border-r border-border bg-white px-3 text-right tabular-nums text-muted-foreground dark:bg-background",
                          showBucketDivider && "border-t-2 border-t-neutral-900",
                          isVeryLast && "border-b border-border",
                        )}
                      >
                        {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
                      </td>

                      <td
                        className={cn(
                          "sticky left-[25rem] z-20 w-24 min-w-24 border-r border-border bg-white px-3 text-right tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)] dark:bg-background",
                          showBucketDivider && "border-t-2 border-t-neutral-900",
                          isVeryLast && "border-b border-border",
                        )}
                      >
                        {bucket.kind === "savings"
                          ? formatMoney(cat.balance)
                          : ""}
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
                        const pastDone = p.completed
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
                              !isLastCol && "border-r border-border/70",
                              isLastCol && "border-r border-border",
                              showBucketDivider &&
                                "border-t-2 border-t-neutral-900",
                              isVeryLast && "border-b border-border",
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
                              done={(manuallyDone || pastDone) && hasAmount}
                              canMarkDone={canMarkDone}
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
  canMarkDone,
  onChange,
  onToggleDone,
}: {
  value: string
  done: boolean
  canMarkDone: boolean
  onChange: (value: string) => void
  onToggleDone: () => void
}) {
  return (
    <div className="group flex h-9 items-center justify-end">
      <span className="select-none text-sm leading-none text-neutral-300">
        $
      </span>
      <input
        className={cn(
          "h-7 w-[3.5rem] rounded-md border border-transparent bg-transparent py-0 pl-0 pr-0.5 text-right text-sm tabular-nums outline-none",
          "hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/30",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
      />
      {canMarkDone ? (
        <button
          type="button"
          onClick={onToggleDone}
          title={done ? "Mark not moved" : "Mark moved"}
          className={cn(
            "ml-0.5 inline-flex size-4 items-center justify-center text-neutral-400 transition-opacity",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            done && "opacity-100",
          )}
        >
          <Check className="size-3" strokeWidth={2.5} />
        </button>
      ) : (
        <span className="ml-0.5 size-4" aria-hidden />
      )}
    </div>
  )
}
