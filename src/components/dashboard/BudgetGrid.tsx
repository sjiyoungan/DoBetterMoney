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
const BUCKET_W = 112
const CAT_W = 192
const GOAL_W = 96
const BAL_W = 96
const STICKY_WIDTH_PX = BUCKET_W + CAT_W + GOAL_W + BAL_W // 112+192+96+96 = 496

const stickyBucket = "sticky left-0 z-20 w-28 min-w-28"
const stickyCat = "sticky left-[7rem] z-20 w-48 min-w-48"
const stickyGoal = "sticky left-[19rem] z-20 w-24 min-w-24"
const stickyBal = "sticky left-[25rem] z-20 w-24 min-w-24"
const payCol = "w-32 min-w-32 shrink-0"
const stickyFill = "bg-white dark:bg-background"
const colBorder = "border-r border-border/70"
const bucketDivider = "border-t-2 border-neutral-800 dark:border-neutral-200"

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
              className="pointer-events-none absolute z-[15] rounded border-2 border-sky-400 dark:border-sky-500"
              style={{
                left: STICKY_WIDTH_PX + upcomingIndex * PAY_COL_PX,
                top: 0,
                bottom: 0,
                width: PAY_COL_PX,
              }}
            />
          ) : null}

          <HeaderRow
            paychecks={paychecks}
            currentPaycheckId={currentPaycheckId}
          />

          {orderedBuckets.map((bucket, bucketIndex) => (
            <BucketSection
              key={bucket.id}
              bucket={bucket}
              isFirstBucket={bucketIndex === 0}
              isLastBucket={bucketIndex === orderedBuckets.length - 1}
              paychecks={paychecks}
              doneKeys={doneKeys}
              today={today}
              currentPaycheckId={currentPaycheckId}
              onToggleDone={onToggleDone}
              onAmountChange={onAmountChange}
              onOpenCategory={(category) => setSelected({ category, bucket })}
            />
          ))}
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

function HeaderRow({
  paychecks,
  currentPaycheckId,
}: {
  paychecks: Paycheck[]
  currentPaycheckId?: string
}) {
  return (
    <div className="flex">
      <div
        className={cn(
          stickyBucket,
          stickyFill,
          colBorder,
          "rounded-tl-xl border-t border-l border-border px-2 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        )}
      />
      <div
        className={cn(
          stickyCat,
          stickyFill,
          colBorder,
          "border-t border-border px-4 py-3 text-sm font-medium",
        )}
      >
        Category
      </div>
      <div
        className={cn(
          stickyGoal,
          stickyFill,
          colBorder,
          "border-t border-border px-3 py-3 text-right text-sm font-medium",
        )}
      >
        Goal
      </div>
      <div
        className={cn(
          stickyBal,
          stickyFill,
          "border-t border-r border-border px-3 py-3 text-right text-sm font-medium shadow-[2px_0_0_0_var(--border)]",
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
              "border-t border-border px-2 py-3 text-center text-sm font-medium",
              !isLast && colBorder,
              isLast && "border-r border-border",
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

function BucketSection({
  bucket,
  isFirstBucket,
  isLastBucket,
  paychecks,
  doneKeys,
  today,
  currentPaycheckId,
  onToggleDone,
  onAmountChange,
  onOpenCategory,
}: {
  bucket: Bucket
  isFirstBucket: boolean
  isLastBucket: boolean
  paychecks: Paycheck[]
  doneKeys: Set<string>
  today: string
  currentPaycheckId?: string
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
  onOpenCategory: (category: Category) => void
}) {
  const rowCount = bucket.categories.length

  return (
    <div className={cn(!isFirstBucket && bucketDivider)}>
      {bucket.categories.map((cat, rowIndex) => {
        const isFirstRow = rowIndex === 0
        const isLastRow = rowIndex === rowCount - 1
        const isVeryLastRow = isLastBucket && isLastRow

        return (
          <div key={cat.id} className="flex">
            {/* Bucket name column — only label on first row of section */}
            <div
              className={cn(
                stickyBucket,
                stickyFill,
                colBorder,
                "border-l border-border px-2",
                isFirstRow && !isFirstBucket && "pt-0",
                isVeryLastRow && "rounded-bl-xl border-b border-border",
                !isVeryLastRow && "border-b border-border/60",
                isFirstRow &&
                  "flex items-start pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
              )}
            >
              {isFirstRow ? bucket.name : null}
            </div>

            <div
              className={cn(
                stickyCat,
                stickyFill,
                colBorder,
                "flex h-9 items-center px-4",
                !isVeryLastRow && "border-b border-border/60",
                isVeryLastRow && "border-b border-border",
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
                !isVeryLastRow && "border-b border-border/60",
                isVeryLastRow && "border-b border-border",
              )}
            >
              {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
            </div>

            <div
              className={cn(
                stickyBal,
                stickyFill,
                "flex h-9 items-center justify-end border-r border-border px-3 text-sm tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)]",
                !isVeryLastRow && "border-b border-border/60",
                isVeryLastRow && "border-b border-border",
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

              const cellGray = isPast && (empty || manuallyDone || p.completed)

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
                    !isVeryLastRow && "border-b border-border/60",
                    isVeryLastRow && "border-b border-border",
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
      <span className="select-none text-sm text-neutral-300 dark:text-neutral-600">
        $
      </span>
      <input
        className={cn(
          "h-7 w-[3.75rem] rounded-md border border-transparent bg-transparent px-1 text-right text-sm tabular-nums outline-none transition-colors",
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
