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
const colBorder = "border-r border-border/70"
const stickyCat = "sticky left-0 z-20 w-48 min-w-48"
const stickyGoal = "sticky left-48 z-20 w-24 min-w-24"
const stickyBal = "sticky left-72 z-20 w-24 min-w-24"
const payCol = "w-32 min-w-32 shrink-0"
const stickyFill = "bg-white dark:bg-background"

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
        <div className="w-max min-w-full">
          {/* One header card — sticky first 3 cols, radius only on true ends */}
          <div className="mb-4 rounded-xl border border-border bg-white dark:bg-background">
            <div className="flex">
              <div
                className={cn(
                  stickyCat,
                  colBorder,
                  stickyFill,
                  "rounded-l-xl px-4 py-3 text-sm font-medium",
                )}
              >
                Category
              </div>
              <div
                className={cn(
                  stickyGoal,
                  colBorder,
                  stickyFill,
                  "px-3 py-3 text-right text-sm font-medium",
                )}
              >
                Goal
              </div>
              <div
                className={cn(
                  stickyBal,
                  colBorder,
                  stickyFill,
                  "px-3 py-3 text-right text-sm font-medium shadow-[2px_0_0_0_var(--border)]",
                )}
              >
                Balance
              </div>
              {paychecks.map((p, i) => {
                const isUpcoming = p.id === currentPaycheckId
                const isLast = i === paychecks.length - 1
                return (
                  <div
                    key={p.id}
                    className={cn(
                      payCol,
                      !isLast && colBorder,
                      "px-3 py-3 text-right text-sm font-medium",
                      isLast && "rounded-r-xl",
                      isUpcoming
                        ? "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50"
                        : p.completed
                          ? "bg-neutral-100 text-muted-foreground dark:bg-neutral-900"
                          : "text-muted-foreground",
                    )}
                  >
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{formatPayDate(p.date)}</span>
                      {isUpcoming ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                          Upcoming
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {orderedBuckets.map((bucket) => (
              <BucketCard
                key={bucket.id}
                bucket={bucket}
                paychecks={paychecks}
                doneKeys={doneKeys}
                today={today}
                currentPaycheckId={currentPaycheckId}
                onToggleDone={onToggleDone}
                onAmountChange={onAmountChange}
                onOpenCategory={(category) =>
                  setSelected({ category, bucket })
                }
              />
            ))}
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

function BucketCard({
  bucket,
  paychecks,
  doneKeys,
  today,
  currentPaycheckId,
  onToggleDone,
  onAmountChange,
  onOpenCategory,
}: {
  bucket: Bucket
  paychecks: Paycheck[]
  doneKeys: Set<string>
  today: string
  currentPaycheckId?: string
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
  onOpenCategory: (category: Category) => void
}) {
  return (
    <div>
      <div
        className={cn(
          stickyCat,
          stickyFill,
          "z-20 mb-2 px-1 text-base font-bold tracking-tight",
        )}
      >
        {bucket.name}
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-background">
        {bucket.categories.map((cat, rowIndex) => {
          const isFirst = rowIndex === 0
          const isLast = rowIndex === bucket.categories.length - 1

          return (
            <div
              key={cat.id}
              className={cn(
                "flex",
                !isLast && "border-b border-border/60",
              )}
            >
              <div
                className={cn(
                  stickyCat,
                  colBorder,
                  stickyFill,
                  "flex h-9 items-center px-4",
                  isFirst && "rounded-tl-xl",
                  isLast && "rounded-bl-xl",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenCategory(cat)}
                  className="w-full text-left text-sm font-normal underline-offset-2 hover:underline"
                >
                  {cat.name}
                </button>
              </div>
              <div
                className={cn(
                  stickyGoal,
                  colBorder,
                  stickyFill,
                  "flex h-9 items-center justify-end px-3 text-sm tabular-nums text-muted-foreground",
                )}
              >
                {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
              </div>
              <div
                className={cn(
                  stickyBal,
                  colBorder,
                  stickyFill,
                  "flex h-9 items-center justify-end px-3 text-sm tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)]",
                )}
              >
                {bucket.kind === "savings" ? formatMoney(cat.balance) : ""}
              </div>
              {paychecks.map((p, i) => {
                const raw = cat.allocations[p.date]
                const key = allocationKey(cat.id, p.id)
                const hasAmount =
                  raw !== "" && raw !== undefined && Number(raw) !== 0
                const empty = !hasAmount
                const isUpcoming = p.id === currentPaycheckId
                const isFuture = !p.completed && p.id !== currentPaycheckId
                const manuallyDone = doneKeys.has(key)
                const pastDone = p.completed
                const isGray =
                  !isFuture && (empty || pastDone || manuallyDone)
                const canMarkDone =
                  hasAmount && (p.date <= today || p.id === currentPaycheckId)
                const isLastCol = i === paychecks.length - 1

                return (
                  <div
                    key={p.id}
                    className={cn(
                      payCol,
                      !isLastCol && colBorder,
                      "flex h-9 items-center justify-end px-1",
                      isLastCol && isFirst && "rounded-tr-xl",
                      isLastCol && isLast && "rounded-br-xl",
                      isUpcoming && !isGray && "bg-sky-50 dark:bg-sky-950/40",
                      isGray && "bg-neutral-100 dark:bg-neutral-900",
                    )}
                  >
                    <AmountCell
                      value={
                        raw === "" || raw === undefined ? "" : String(raw)
                      }
                      done={(manuallyDone || pastDone) && hasAmount}
                      canMarkDone={canMarkDone}
                      onChange={(value) =>
                        onAmountChange(cat.id, p.date, value)
                      }
                      onToggleDone={() => onToggleDone(key)}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
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
    <div className="group relative flex items-center justify-end gap-1 rounded-md px-0.5">
      <input
        className={cn(
          "h-7 w-[4.25rem] rounded-md border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums outline-none transition-colors",
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
            "inline-flex size-6 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-opacity",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            done &&
              "opacity-100 border-neutral-300 bg-neutral-500 text-white hover:bg-neutral-600",
            !done &&
              "hover:border-input hover:bg-white dark:hover:bg-background",
          )}
        >
          <Check className="size-3.5" />
        </button>
      ) : (
        <span className="size-6" aria-hidden />
      )}
    </div>
  )
}
