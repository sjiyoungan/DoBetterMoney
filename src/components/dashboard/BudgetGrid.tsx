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
const STICKY_WIDTH_PX = 192 + 96 + 96 // cat + goal + balance
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
        <div className="relative w-max min-w-full py-1">
          {/* One continuous upcoming column outline (no per-row strokes) */}
          {upcomingIndex >= 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-[15] rounded border-2 border-sky-400 dark:border-sky-500"
              style={{
                left: STICKY_WIDTH_PX + upcomingIndex * PAY_COL_PX,
                top: -4,
                bottom: -4,
                width: PAY_COL_PX,
              }}
            />
          ) : null}

          <HeaderCard
            paychecks={paychecks}
            currentPaycheckId={currentPaycheckId}
          />

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

function HeaderCard({
  paychecks,
  currentPaycheckId,
}: {
  paychecks: Paycheck[]
  currentPaycheckId?: string
}) {
  return (
    <div className="mb-4 flex">
      <div
        className={cn(
          stickyCat,
          colBorder,
          stickyFill,
          "rounded-l-xl border-y border-l border-border px-4 py-3 text-sm font-medium",
        )}
      >
        Category
      </div>
      <div
        className={cn(
          stickyGoal,
          colBorder,
          stickyFill,
          "border-y border-border px-3 py-3 text-right text-sm font-medium",
        )}
      >
        Goal
      </div>
      <div
        className={cn(
          stickyBal,
          stickyFill,
          "border-y border-r border-border px-3 py-3 text-right text-sm font-medium shadow-[2px_0_0_0_var(--border)]",
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
              "border-y border-border px-3 py-3 text-center text-sm font-medium",
              !isLast && colBorder,
              isLast && "rounded-r-xl border-r border-border",
              isUpcoming
                ? "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50"
                : p.completed
                  ? "bg-neutral-100 text-muted-foreground dark:bg-neutral-900"
                  : "bg-white text-muted-foreground dark:bg-background",
            )}
          >
            {formatPayDate(p.date)}
          </div>
        )
      })}
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
      <div className="mb-2 flex">
        <div
          className={cn(
            stickyCat,
            stickyFill,
            "z-20 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
          )}
        >
          {bucket.name}
        </div>
        <div className={cn(stickyGoal, stickyFill, "z-20")} />
        <div className={cn(stickyBal, stickyFill, "z-20")} />
        {paychecks.map((p) => (
          <div key={p.id} className={payCol} />
        ))}
      </div>

      {bucket.categories.map((cat, rowIndex) => {
        const isFirst = rowIndex === 0
        const isLast = rowIndex === bucket.categories.length - 1

        return (
          <div key={cat.id} className="flex">
            <div
              className={cn(
                stickyCat,
                stickyFill,
                "flex h-9 items-center border-l border-border px-4",
                colBorder,
                isFirst && "rounded-tl-xl border-t border-border",
                isLast && "rounded-bl-xl border-b border-border",
                !isLast && "border-b border-border/60",
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
                stickyFill,
                colBorder,
                "flex h-9 items-center justify-end px-3 text-sm tabular-nums text-muted-foreground",
                isFirst && "border-t border-border",
                isLast && "border-b border-border",
                !isLast && "border-b border-border/60",
              )}
            >
              {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
            </div>
            <div
              className={cn(
                stickyBal,
                stickyFill,
                "flex h-9 items-center justify-end border-r border-border px-3 text-sm tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)]",
                isFirst && "border-t border-border",
                isLast && "border-b border-border",
                !isLast && "border-b border-border/60",
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
              const manuallyDone = doneKeys.has(key)
              const pastDone = p.completed
              const isLastCol = i === paychecks.length - 1

              const upcomingIdx = currentPaycheckId
                ? paychecks.findIndex((x) => x.id === currentPaycheckId)
                : -1
              const thisIdx = paychecks.findIndex((x) => x.id === p.id)
              const isPast =
                p.completed || (upcomingIdx >= 0 && thisIdx < upcomingIdx)

              // Only past columns get gray empties / done. Future + upcoming stay white.
              const cellGray =
                isPast && (empty || manuallyDone || p.completed)

              const canMarkDone =
                hasAmount && (p.date <= today || isUpcoming)

              return (
                <div
                  key={p.id}
                  className={cn(
                    payCol,
                    "flex h-9 items-center justify-end bg-white px-1 dark:bg-background",
                    !isLastCol && colBorder,
                    isLastCol && "border-r border-border",
                    isFirst && "border-t border-border",
                    isLast && "border-b border-border",
                    !isLast && "border-b border-border/60",
                    isFirst && isLastCol && "rounded-tr-xl",
                    isLast && isLastCol && "rounded-br-xl",
                    cellGray && "bg-neutral-100 dark:bg-neutral-900",
                  )}
                >
                  <AmountCell
                    value={raw === "" || raw === undefined ? "" : String(raw)}
                    done={(manuallyDone || pastDone) && hasAmount}
                    canMarkDone={canMarkDone}
                    onChange={(value) => onAmountChange(cat.id, p.date, value)}
                    onToggleDone={() => onToggleDone(key)}
                  />
                </div>
              )
            })}
          </div>
        )
      })}
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
    <div className="group relative flex items-center justify-end gap-0.5">
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
            "inline-flex size-4 items-center justify-center text-neutral-400 transition-opacity",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            done && "opacity-100",
          )}
        >
          <Check className="size-3" strokeWidth={2.5} />
        </button>
      ) : (
        <span className="size-4" aria-hidden />
      )}
    </div>
  )
}
