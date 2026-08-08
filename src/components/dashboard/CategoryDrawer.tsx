import { useEffect, useMemo, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  allocationKey,
  formatMoney,
  formatPayDate,
  savingsBalanceLeft,
} from "@/lib/format"
import type { Bucket, Category, Paycheck } from "@/types/budget"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  bucket: Bucket | null
  paychecks: Paycheck[]
  doneKeys: Set<string>
}

type PlannedRow = {
  paycheck: Paycheck
  amount: number
}

type HistoryItem = {
  id: string
  date: string
  kind: "added" | "comment"
  amount?: number
  comment?: string
}

const PLANNED_PREVIEW = 6

function allocationNumber(
  allocations: Category["allocations"],
  date: string,
): number | null {
  const raw = allocations[date]
  if (raw === "" || raw === undefined) return null
  const n = Number(raw)
  return Number.isFinite(n) && n !== 0 ? n : null
}

export function CategoryDrawer({
  open,
  onOpenChange,
  category,
  bucket,
  paychecks,
  doneKeys,
}: Props) {
  const [plannedExpanded, setPlannedExpanded] = useState(false)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    setPlannedExpanded(false)
  }, [category?.id, open])

  const upcomingIndex = useMemo(() => {
    const id =
      paychecks.find((p) => !p.completed && p.date >= today)?.id ??
      paychecks.find((p) => !p.completed)?.id
    if (!id) return -1
    return paychecks.findIndex((p) => p.id === id)
  }, [paychecks, today])

  const plannedRows = useMemo((): PlannedRow[] => {
    if (!category || upcomingIndex < 0) return []
    const rows: PlannedRow[] = []
    for (let i = upcomingIndex; i < paychecks.length; i++) {
      const paycheck = paychecks[i]!
      const amount = allocationNumber(category.allocations, paycheck.date)
      if (amount === null) continue
      rows.push({ paycheck, amount })
    }
    return rows
  }, [category, paychecks, upcomingIndex])

  const totalPlanned = useMemo(
    () => plannedRows.reduce((sum, row) => sum + row.amount, 0),
    [plannedRows],
  )

  const visiblePlanned = plannedExpanded
    ? plannedRows
    : plannedRows.slice(0, PLANNED_PREVIEW)
  const hasMorePlanned = plannedRows.length > PLANNED_PREVIEW

  const historyItems = useMemo((): HistoryItem[] => {
    if (!category) return []
    const items: HistoryItem[] = []

    for (const p of paychecks) {
      const key = allocationKey(category.id, p.id)
      const checked = doneKeys.has(key)
      const amount = allocationNumber(category.allocations, p.date)
      if (checked && amount !== null) {
        items.push({
          id: `added-${p.id}`,
          date: p.date,
          kind: "added",
          amount,
        })
      }
      const comment = category.comments?.[p.date]?.trim()
      if (comment) {
        items.push({
          id: `comment-${p.id}`,
          date: p.date,
          kind: "comment",
          comment,
        })
      }
    }

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [category, paychecks, doneKeys])

  if (!category || !bucket) return null

  const isSavings = bucket.kind === "savings"

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setPlannedExpanded(false)
        onOpenChange(next)
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{category.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isSavings ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Goal</dt>
                <dd className="mt-2 font-medium">
                  {formatMoney(category.goal)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Balance left</dt>
                <dd className="mt-2 font-medium">
                  {formatMoney(
                    savingsBalanceLeft(
                      category.goal,
                      category.allocations,
                      paychecks.map((p) => p.date),
                    ),
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Due date</dt>
                <dd className="mt-2 font-medium">{category.dueDate ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Min / payment</dt>
                <dd className="mt-2 font-medium">
                  {formatMoney(category.minPayment ?? category.recurringAmount)}
                </dd>
              </div>
            </dl>
          )}

          {isSavings ? (
            <>
              <section className="rounded-xl border border-neutral-200 bg-white px-4">
                <div className="flex items-center justify-between gap-3 py-4">
                  <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                    Planned savings
                  </h3>
                  <span className="shrink-0 text-base tabular-nums text-foreground">
                    {formatMoney(totalPlanned)}
                  </span>
                </div>
                <div className="border-t border-neutral-200" />
                {plannedRows.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No upcoming or future plans yet.
                  </p>
                ) : (
                  <div className="py-4">
                    <ul className="space-y-4">
                      {visiblePlanned.map(({ paycheck, amount }) => (
                        <li
                          key={paycheck.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-foreground">
                            {formatPayDate(paycheck.date)}
                          </span>
                          <span className="tabular-nums text-foreground">
                            {formatMoney(amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {hasMorePlanned ? (
                      <button
                        type="button"
                        className="mt-4 text-sm font-medium text-foreground underline-offset-2 hover:underline"
                        onClick={() => setPlannedExpanded((v) => !v)}
                      >
                        {plannedExpanded ? "View less" : "View more"}
                      </button>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white px-4">
                <div className="flex items-center justify-between gap-3 py-4">
                  <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                    History
                  </h3>
                </div>
                <div className="border-t border-neutral-200" />
                {historyItems.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No additions or comments yet. Withdrawals will show up here
                    later.
                  </p>
                ) : (
                  <ul className="space-y-4 py-4">
                    {historyItems.map((item) => (
                      <li key={item.id} className="text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-muted-foreground">
                            {formatPayDate(item.date)}
                          </span>
                          {item.kind === "added" ? (
                            <span className="tabular-nums text-foreground">
                              +{formatMoney(item.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Comment</span>
                          )}
                        </div>
                        {item.kind === "added" ? (
                          <p className="mt-1 text-foreground">Added to savings</p>
                        ) : (
                          <p className="mt-1 text-foreground">{item.comment}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
