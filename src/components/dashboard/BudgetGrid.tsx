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

/** Solid (non-transparent) bucket card backgrounds for sticky columns */
const bucketTints = [
  "bg-slate-100 dark:bg-slate-900",
  "bg-neutral-50 dark:bg-neutral-950",
  "bg-stone-100 dark:bg-stone-900",
  "bg-zinc-100 dark:bg-zinc-900",
  "bg-gray-100 dark:bg-gray-900",
]

const colBorder = "border-r border-border/70"
const stickyCat = "sticky left-0 z-10 min-w-48 w-48"
const stickyGoal = "sticky left-48 z-10 min-w-24 w-24"
const stickyBal = "sticky left-72 z-10 min-w-24 w-24"

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

  const orderedBuckets = useMemo(
    () => [
      ...buckets.filter((b) => b.kind !== "savings"),
      ...buckets.filter((b) => b.kind === "savings"),
    ],
    [buckets],
  )

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

      <div className="max-h-[calc(100svh-11rem)] overflow-auto rounded-xl border bg-muted/20">
        <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
          <thead className="sticky top-0 z-30">
            <tr>
              <th
                className={cn(
                  stickyCat,
                  colBorder,
                  "z-40 bg-background px-4 py-3 text-left font-medium shadow-[0_1px_0_0_var(--border)]",
                )}
              >
                Category
              </th>
              <th
                className={cn(
                  stickyGoal,
                  colBorder,
                  "z-40 bg-background px-3 py-3 text-right font-medium shadow-[0_1px_0_0_var(--border)]",
                )}
              >
                Goal
              </th>
              <th
                className={cn(
                  stickyBal,
                  colBorder,
                  "z-40 bg-background px-3 py-3 text-right font-medium shadow-[2px_0_0_0_var(--border),0_1px_0_0_var(--border)]",
                )}
              >
                Balance
              </th>
              {visiblePaychecks.map((p) => {
                const isUpcoming = p.id === currentPaycheckId
                return (
                  <th
                    key={p.id}
                    className={cn(
                      colBorder,
                      "min-w-32 bg-background px-3 py-3 text-right font-medium shadow-[0_1px_0_0_var(--border)]",
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
                  </th>
                )
              })}
            </tr>
          </thead>

          {orderedBuckets.map((bucket, bucketIndex) => {
            const tint = bucketTints[bucketIndex % bucketTints.length]
            return (
              <tbody
                key={bucket.id}
                className="[&_tr:first-child_td]:border-t [&_tr:last-child_td]:border-b [&_tr_td:first-child]:border-l [&_tr_td:last-child]:border-r [&_td]:border-border [&_tr:first-child_td:first-child]:rounded-tl-xl [&_tr:first-child_td:last-child]:rounded-tr-xl [&_tr:last-child_td:first-child]:rounded-bl-xl [&_tr:last-child_td:last-child]:rounded-br-xl"
              >
                <tr>
                  <td
                    className={cn(
                      stickyCat,
                      colBorder,
                      tint,
                      "z-20 px-4 py-3 text-base font-bold tracking-tight",
                    )}
                  >
                    {bucket.name}
                  </td>
                  <td className={cn(stickyGoal, colBorder, tint)} />
                  <td
                    className={cn(
                      stickyBal,
                      colBorder,
                      tint,
                      "shadow-[2px_0_0_0_var(--border)]",
                    )}
                  />
                  {visiblePaychecks.map((p) => {
                    const isUpcoming = p.id === currentPaycheckId
                    return (
                      <td
                        key={p.id}
                        className={cn(
                          colBorder,
                          isUpcoming
                            ? "bg-sky-100 dark:bg-sky-950"
                            : tint,
                        )}
                      />
                    )
                  })}
                </tr>

                {bucket.categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className={cn(stickyCat, colBorder, tint, "z-20 px-4 py-1.5")}>
                      <button
                        type="button"
                        onClick={() => setSelected({ category: cat, bucket })}
                        className="text-left text-sm font-normal underline-offset-2 hover:underline"
                      >
                        {cat.name}
                      </button>
                    </td>
                    <td
                      className={cn(
                        stickyGoal,
                        colBorder,
                        tint,
                        "px-3 py-1.5 text-right tabular-nums text-muted-foreground",
                      )}
                    >
                      {bucket.kind === "savings" ? formatMoney(cat.goal) : ""}
                    </td>
                    <td
                      className={cn(
                        stickyBal,
                        colBorder,
                        tint,
                        "px-3 py-1.5 text-right tabular-nums text-muted-foreground shadow-[2px_0_0_0_var(--border)]",
                      )}
                    >
                      {bucket.kind === "savings" ? formatMoney(cat.balance) : ""}
                    </td>
                    {visiblePaychecks.map((p) => {
                      const raw = cat.allocations[p.date]
                      const key = allocationKey(cat.id, p.id)
                      const done = doneKeys.has(key) || p.completed
                      const hasAmount =
                        raw !== "" && raw !== undefined && Number(raw) !== 0
                      const canMarkDone =
                        p.date <= today || p.id === currentPaycheckId
                      const isCurrentTodo =
                        p.id === currentPaycheckId && hasAmount && !done
                      const isUpcoming = p.id === currentPaycheckId

                      return (
                        <td
                          key={p.id}
                          className={cn(
                            colBorder,
                            "px-2 py-1.5",
                            isUpcoming
                              ? "bg-sky-100 dark:bg-sky-950"
                              : tint,
                          )}
                        >
                          <AmountCell
                            value={
                              raw === "" || raw === undefined ? "" : String(raw)
                            }
                            done={done}
                            todo={isCurrentTodo}
                            canMarkDone={canMarkDone && hasAmount}
                            onChange={(value) =>
                              onAmountChange(cat.id, p.date, value)
                            }
                            onToggleDone={() => onToggleDone(key)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      </div>

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
        done && "bg-emerald-100 dark:bg-emerald-950",
        todo && !done && "bg-amber-50 dark:bg-amber-950",
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
