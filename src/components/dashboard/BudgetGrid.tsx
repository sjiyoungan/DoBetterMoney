import { useEffect, useMemo, useRef, useState } from "react"
import { Check } from "lucide-react"
import { CategoryDrawer } from "@/components/dashboard/CategoryDrawer"
import { Button } from "@/components/ui/button"
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

const bucketTints = [
  "bg-slate-100 dark:bg-slate-900",
  "bg-neutral-50 dark:bg-neutral-950",
  "bg-stone-100 dark:bg-stone-900",
  "bg-zinc-100 dark:bg-zinc-900",
  "bg-gray-100 dark:bg-gray-900",
]

const PAY_COL_PX = 128
const colBorder = "border-r border-border/70"
const stickyCat = "sticky left-0 z-10 min-w-48 w-48"
const stickyGoal = "sticky left-48 z-10 min-w-24 w-24"
const stickyBal = "sticky left-72 z-10 min-w-24 w-24"
const payCol = "min-w-32 w-32"

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

  /** Full Jan–Dec grid (no filtering) */
  const allPaychecks = paychecks

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const currentPaycheckId = useMemo(() => {
    return (
      allPaychecks.find((p) => !p.completed && p.date >= today)?.id ??
      allPaychecks.find((p) => !p.completed)?.id
    )
  }, [allPaychecks, today])

  const upcomingIndex = useMemo(
    () => allPaychecks.findIndex((p) => p.id === currentPaycheckId),
    [allPaychecks, currentPaycheckId],
  )

  const todoCount = useMemo(() => {
    if (!currentPaycheckId) return 0
    const current = allPaychecks.find((p) => p.id === currentPaycheckId)
    if (!current) return 0
    return buckets
      .flatMap((b) => b.categories)
      .filter((cat) => {
        const amount = cat.allocations[current.date]
        if (amount === "" || amount === undefined || amount === 0) return false
        return !doneKeys.has(allocationKey(cat.id, current.id))
      }).length
  }, [buckets, allPaychecks, currentPaycheckId, doneKeys])

  // On load/reload: previous week in col 1, upcoming in col 2
  useEffect(() => {
    const el = scrollRef.current
    if (!el || upcomingIndex < 0) return
    const startIndex = Math.max(0, upcomingIndex - 1)
    el.scrollLeft = startIndex * PAY_COL_PX
  }, [upcomingIndex])

  // Wheel over grid → horizontal; outside → normal page vertical
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <LegendSwatch className="bg-emerald-100 ring-1 ring-emerald-300" />
        <span className="text-muted-foreground">Moved</span>
        <LegendSwatch className="bg-amber-50 ring-1 ring-amber-300" />
        <span className="text-muted-foreground">Still to move</span>
        <LegendSwatch className="bg-sky-100 ring-1 ring-sky-300" />
        <span className="text-muted-foreground">Upcoming paycheck</span>
        {todoCount > 0 ? (
          <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {todoCount} left this paycheck
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            This paycheck clear
          </span>
        )}
        <Button variant="outline" size="sm" disabled>
          Add bucket
        </Button>
        <Button variant="outline" size="sm" disabled>
          Add category
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-max">
          <HeaderRow
            paychecks={allPaychecks}
            currentPaycheckId={currentPaycheckId}
          />

          <div className="mt-3 flex flex-col gap-3">
            {orderedBuckets.map((bucket, bucketIndex) => (
              <BucketCard
                key={bucket.id}
                bucket={bucket}
                tint={bucketTints[bucketIndex % bucketTints.length]}
                paychecks={allPaychecks}
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
        paychecks={allPaychecks}
        doneKeys={doneKeys}
      />
    </div>
  )
}

function LegendSwatch({ className }: { className: string }) {
  return <span className={cn("inline-block size-3 rounded-sm", className)} />
}

function HeaderRow({
  paychecks,
  currentPaycheckId,
}: {
  paychecks: Paycheck[]
  currentPaycheckId?: string
}) {
  return (
    <div className="sticky top-0 z-30 flex border-b bg-background shadow-[0_1px_0_0_var(--border)]">
      <div
        className={cn(
          stickyCat,
          colBorder,
          "z-40 bg-background px-4 py-3 text-sm font-medium",
        )}
      >
        Category
      </div>
      <div
        className={cn(
          stickyGoal,
          colBorder,
          "z-40 bg-background px-3 py-3 text-right text-sm font-medium",
        )}
      >
        Goal
      </div>
      <div
        className={cn(
          stickyBal,
          colBorder,
          "z-40 bg-background px-3 py-3 text-right text-sm font-medium shadow-[2px_0_0_0_var(--border)]",
        )}
      >
        Balance
      </div>
      {paychecks.map((p) => {
        const isUpcoming = p.id === currentPaycheckId
        return (
          <div
            key={p.id}
            className={cn(
              payCol,
              colBorder,
              "bg-background px-3 py-3 text-right text-sm font-medium",
              isUpcoming
                ? "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50"
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
  )
}

function BucketCard({
  bucket,
  tint,
  paychecks,
  doneKeys,
  today,
  currentPaycheckId,
  onToggleDone,
  onAmountChange,
  onOpenCategory,
}: {
  bucket: Bucket
  tint: string
  paychecks: Paycheck[]
  doneKeys: Set<string>
  today: string
  currentPaycheckId?: string
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
  onOpenCategory: (category: Category) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex">
        <div
          className={cn(
            stickyCat,
            colBorder,
            tint,
            "z-20 px-4 py-2.5 text-base font-bold tracking-tight",
          )}
        >
          {bucket.name}
        </div>
        <div className={cn(stickyGoal, colBorder, tint, "z-20")} />
        <div
          className={cn(
            stickyBal,
            colBorder,
            tint,
            "z-20 shadow-[2px_0_0_0_var(--border)]",
          )}
        />
        {paychecks.map((p) => (
          <div
            key={p.id}
            className={cn(
              payCol,
              colBorder,
              p.id === currentPaycheckId
                ? "bg-sky-100 dark:bg-sky-950"
                : tint,
            )}
          />
        ))}
      </div>

      {bucket.categories.map((cat, i) => (
        <div
          key={cat.id}
          className={cn(
            "flex",
            i < bucket.categories.length - 1 && "border-b border-border/60",
          )}
        >
          <div className={cn(stickyCat, colBorder, tint, "z-20 px-4 py-0")}>
            <button
              type="button"
              onClick={() => onOpenCategory(cat)}
              className="h-9 w-full text-left text-sm font-normal underline-offset-2 hover:underline"
            >
              {cat.name}
            </button>
          </div>
          <div
            className={cn(
              stickyGoal,
              colBorder,
              tint,
              "z-20 flex h-9 items-center justify-end px-3 text-sm tabular-nums text-muted-foreground",
            )}
          >
            {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
          </div>
          <div
            className={cn(
              stickyBal,
              colBorder,
              tint,
              "z-20 flex h-9 items-center justify-end px-3 text-sm tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)]",
            )}
          >
            {bucket.kind === "savings" ? formatMoney(cat.balance) : ""}
          </div>
          {paychecks.map((p) => {
            const raw = cat.allocations[p.date]
            const key = allocationKey(cat.id, p.id)
            const done = doneKeys.has(key) || p.completed
            const hasAmount =
              raw !== "" && raw !== undefined && Number(raw) !== 0
            const canMarkDone = p.date <= today || p.id === currentPaycheckId
            const isCurrentTodo =
              p.id === currentPaycheckId && hasAmount && !done
            const isUpcoming = p.id === currentPaycheckId

            return (
              <div
                key={p.id}
                className={cn(
                  payCol,
                  colBorder,
                  "flex h-9 items-center justify-end px-1",
                  isUpcoming ? "bg-sky-100 dark:bg-sky-950" : tint,
                )}
              >
                <AmountCell
                  value={raw === "" || raw === undefined ? "" : String(raw)}
                  done={done}
                  todo={isCurrentTodo}
                  canMarkDone={canMarkDone && hasAmount}
                  onChange={(value) => onAmountChange(cat.id, p.date, value)}
                  onToggleDone={() => onToggleDone(key)}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function AmountCell({
  value,
  done,
  todo,
  canMarkDone,
  onChange,
  onToggleDone,
}: {
  value: string
  done: boolean
  todo: boolean
  canMarkDone: boolean
  onChange: (value: string) => void
  onToggleDone: () => void
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center justify-end gap-1 rounded-md px-0.5",
        done && "bg-emerald-100 dark:bg-emerald-950",
        todo && !done && "bg-amber-50 dark:bg-amber-950",
      )}
    >
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
              "opacity-100 border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700",
            !done && "hover:border-input hover:bg-background",
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
