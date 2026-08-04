import { useMemo, useState } from "react"
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
  "bg-slate-100/80 dark:bg-slate-900/40",
  "bg-white dark:bg-background",
  "bg-stone-100/80 dark:bg-stone-900/30",
  "bg-zinc-100/70 dark:bg-zinc-900/40",
]

export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
}: Props) {
  const [selected, setSelected] = useState<{
    category: Category
    bucket: Bucket
  } | null>(null)

  const spendingBuckets = buckets.filter((b) => b.kind !== "savings")
  const savingsBuckets = buckets.filter((b) => b.kind === "savings")

  const visiblePaychecks = useMemo(
    () => paychecks.filter((p) => !p.completed || p.date >= "2026-08-01"),
    [paychecks],
  )

  const today = "2026-08-03"
  const currentPaycheckId =
    visiblePaychecks.find((p) => !p.completed && p.date >= today)?.id ??
    visiblePaychecks.find((p) => !p.completed)?.id

  const todoCount = useMemo(() => {
    if (!currentPaycheckId) return 0
    const current = visiblePaychecks.find((p) => p.id === currentPaycheckId)
    if (!current) return 0
    return buckets
      .flatMap((b) => b.categories)
      .filter((cat) => {
        const amount = cat.allocations[current.date]
        if (amount === "" || amount === undefined || amount === 0) return false
        return !doneKeys.has(allocationKey(cat.id, current.id))
      }).length
  }, [buckets, visiblePaychecks, currentPaycheckId, doneKeys])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <LegendSwatch className="bg-emerald-100 ring-1 ring-emerald-300" />
        <span className="text-muted-foreground">Moved</span>
        <LegendSwatch className="bg-amber-50 ring-1 ring-amber-300" />
        <span className="text-muted-foreground">Still to move (this week)</span>
        <LegendSwatch className="bg-transparent ring-1 ring-border" />
        <span className="text-muted-foreground">Planned / future</span>
        {todoCount > 0 ? (
          <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {todoCount} left this paycheck
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            This paycheck clear
          </span>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Spending</h2>
            <p className="text-sm text-muted-foreground">
              Bills, rent, variables — click a category for details
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Add bucket
            </Button>
            <Button variant="outline" size="sm" disabled>
              Add category
            </Button>
          </div>
        </div>
        <PlanningTable
          buckets={spendingBuckets}
          paychecks={visiblePaychecks}
          doneKeys={doneKeys}
          today={today}
          currentPaycheckId={currentPaycheckId}
          showGoalBalance={false}
          onToggleDone={onToggleDone}
          onAmountChange={onAmountChange}
          onOpenCategory={(category, bucket) => setSelected({ category, bucket })}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Savings & payback</h2>
          <p className="text-sm text-muted-foreground">
            Goals and remaining balance live here
          </p>
        </div>
        <PlanningTable
          buckets={savingsBuckets}
          paychecks={visiblePaychecks}
          doneKeys={doneKeys}
          today={today}
          currentPaycheckId={currentPaycheckId}
          showGoalBalance
          onToggleDone={onToggleDone}
          onAmountChange={onAmountChange}
          onOpenCategory={(category, bucket) => setSelected({ category, bucket })}
        />
      </section>

      <CategoryDrawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        category={selected?.category ?? null}
        bucket={selected?.bucket ?? null}
        paychecks={visiblePaychecks}
        doneKeys={doneKeys}
      />
    </div>
  )
}

function LegendSwatch({ className }: { className: string }) {
  return <span className={cn("inline-block size-3 rounded-sm", className)} />
}

function PlanningTable({
  buckets,
  paychecks,
  doneKeys,
  today,
  currentPaycheckId,
  showGoalBalance,
  onToggleDone,
  onAmountChange,
  onOpenCategory,
}: {
  buckets: Bucket[]
  paychecks: Paycheck[]
  doneKeys: Set<string>
  today: string
  currentPaycheckId?: string
  showGoalBalance: boolean
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
  onOpenCategory: (category: Category, bucket: Bucket) => void
}) {
  const stickyExtra = showGoalBalance ? 2 : 0

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th
              className={cn(
                "sticky left-0 z-20 min-w-48 bg-background px-4 py-3 text-left font-medium",
                showGoalBalance && "shadow-[2px_0_0_0_var(--border)]",
              )}
            >
              Category
            </th>
            {showGoalBalance ? (
              <>
                <th className="sticky left-48 z-20 min-w-24 bg-background px-3 py-3 text-right font-medium">
                  Goal
                </th>
                <th className="sticky left-72 z-20 min-w-24 bg-background px-3 py-3 text-right font-medium shadow-[2px_0_0_0_var(--border)]">
                  Balance
                </th>
              </>
            ) : null}
            {paychecks.map((p) => (
              <th
                key={p.id}
                className="min-w-32 px-3 py-3 text-right font-medium text-muted-foreground"
              >
                {formatPayDate(p.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket, bucketIndex) => {
            const tint = bucketTints[bucketIndex % bucketTints.length]
            const colSpan = 1 + stickyExtra + paychecks.length
            return (
              <BucketBlock
                key={bucket.id}
                bucket={bucket}
                tint={tint}
                colSpan={colSpan}
                paychecks={paychecks}
                doneKeys={doneKeys}
                today={today}
                currentPaycheckId={currentPaycheckId}
                showGoalBalance={showGoalBalance}
                onToggleDone={onToggleDone}
                onAmountChange={onAmountChange}
                onOpenCategory={onOpenCategory}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BucketBlock({
  bucket,
  tint,
  colSpan,
  paychecks,
  doneKeys,
  today,
  currentPaycheckId,
  showGoalBalance,
  onToggleDone,
  onAmountChange,
  onOpenCategory,
}: {
  bucket: Bucket
  tint: string
  colSpan: number
  paychecks: Paycheck[]
  doneKeys: Set<string>
  today: string
  currentPaycheckId?: string
  showGoalBalance: boolean
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
  onOpenCategory: (category: Category, bucket: Bucket) => void
}) {
  return (
    <>
      <tr className={cn(tint, "border-b")}>
        <td
          colSpan={colSpan}
          className={cn("sticky left-0 z-10 px-4 py-3", tint)}
        >
          <div className="text-base font-bold tracking-tight">{bucket.name}</div>
          {bucket.note ? (
            <div className="text-xs font-normal text-muted-foreground">
              {bucket.note}
            </div>
          ) : null}
        </td>
      </tr>
      {bucket.categories.map((cat) => (
        <tr key={cat.id} className={cn(tint, "border-b border-border/50")}>
          <td className={cn("sticky left-0 z-10 min-w-48 px-4 py-1.5", tint)}>
            <button
              type="button"
              onClick={() => onOpenCategory(cat, bucket)}
              className="text-left text-sm font-normal text-foreground/90 underline-offset-2 hover:underline"
            >
              {cat.name}
            </button>
          </td>
          {showGoalBalance ? (
            <>
              <td
                className={cn(
                  "sticky left-48 z-10 min-w-24 px-3 py-1.5 text-right tabular-nums text-muted-foreground",
                  tint,
                )}
              >
                {formatMoney(cat.goal)}
              </td>
              <td
                className={cn(
                  "sticky left-72 z-10 min-w-24 px-3 py-1.5 text-right tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)]",
                  tint,
                )}
              >
                {formatMoney(cat.balance)}
              </td>
            </>
          ) : null}
          {paychecks.map((p) => {
            const raw = cat.allocations[p.date]
            const key = allocationKey(cat.id, p.id)
            const done = doneKeys.has(key) || p.completed
            const hasAmount =
              raw !== "" && raw !== undefined && Number(raw) !== 0
            const canMarkDone = p.date <= today || p.id === currentPaycheckId
            const isCurrentTodo =
              p.id === currentPaycheckId && hasAmount && !done

            return (
              <td key={p.id} className="px-2 py-1.5">
                <AmountCell
                  value={raw === "" || raw === undefined ? "" : String(raw)}
                  done={done}
                  todo={isCurrentTodo}
                  canMarkDone={canMarkDone && hasAmount}
                  onChange={(value) => onAmountChange(cat.id, p.date, value)}
                  onToggleDone={() => onToggleDone(key)}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
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
        "group relative flex items-center justify-end gap-1 rounded-md px-1 py-0.5",
        done && "bg-emerald-100/90 dark:bg-emerald-950/70",
        todo && !done && "bg-amber-50 dark:bg-amber-950/40",
      )}
    >
      <input
        className={cn(
          "h-8 w-[4.5rem] rounded-md border border-transparent bg-transparent px-2 text-right tabular-nums outline-none transition-colors",
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
            "inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-opacity",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            done &&
              "opacity-100 border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700",
            !done && "hover:border-input hover:bg-background",
          )}
        >
          <Check className="size-3.5" />
        </button>
      ) : (
        <span className="size-7" aria-hidden />
      )}
    </div>
  )
}
