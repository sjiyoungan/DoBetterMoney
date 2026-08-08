import { useEffect, useMemo, useState } from "react"
import { CaretDownIcon } from "@/components/ui/caret-down"
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
import { savingsActualForCategory } from "@/lib/budget-summary"
import { cn } from "@/lib/utils"
import type { Bucket, Category, Paycheck, Withdrawal } from "@/types/budget"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  bucket: Bucket | null
  paychecks: Paycheck[]
  doneKeys: Set<string>
  withdrawals?: Withdrawal[]
  onCategoryNoteChange: (categoryId: string, note: string) => void
}

type PlannedRow = {
  paycheck: Paycheck
  amount: number
}

type HistoryItem = {
  id: string
  date: string
  kind: "deposit" | "payment" | "comment" | "carryover" | "withdrawal"
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

function yearFromPaychecks(paychecks: Paycheck[]): number {
  const first = paychecks[0]?.date
  if (first) {
    const y = Number(first.slice(0, 4))
    if (Number.isFinite(y)) return y
  }
  return new Date().getFullYear()
}

function formatDueDay(day: number): string {
  const n = Math.round(day)
  const mod100 = n % 100
  const mod10 = n % 10
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : mod10 === 1
        ? "st"
        : mod10 === 2
          ? "nd"
          : mod10 === 3
            ? "rd"
            : "th"
  return `${n}${suffix}`
}

function formatCategoryDue(category: Category): string {
  if (
    typeof category.dueDay === "number" &&
    Number.isFinite(category.dueDay) &&
    category.dueDay >= 1 &&
    category.dueDay <= 31
  ) {
    return formatDueDay(category.dueDay)
  }
  const legacy = category.dueDate?.trim()
  return legacy || "—"
}

function historyLabel(item: HistoryItem): string {
  if (item.kind === "carryover") return "Carry over"
  if (item.kind === "deposit") return "Deposit"
  if (item.kind === "payment") return "Payment"
  if (item.kind === "withdrawal") return "Withdrawal"
  return item.comment ?? "Comment"
}

function historyAmountText(item: HistoryItem): string {
  if (item.kind === "comment" || item.amount === undefined) return "—"
  if (item.amount < 0) return `-${formatMoney(Math.abs(item.amount))}`
  return `+${formatMoney(item.amount)}`
}

export function CategoryDrawer({
  open,
  onOpenChange,
  category,
  bucket,
  paychecks,
  doneKeys,
  withdrawals = [],
  onCategoryNoteChange,
}: Props) {
  const [plannedExpanded, setPlannedExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    setPlannedExpanded(false)
    setNoteDraft(category?.note ?? "")
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
  const plannedHiddenCount = Math.max(0, plannedRows.length - PLANNED_PREVIEW)
  const hasMorePlanned = plannedHiddenCount > 0

  const isSavings = bucket?.kind === "savings"
  const isIncome = bucket?.kind === "income"

  const historyItems = useMemo((): HistoryItem[] => {
    if (!category || !bucket) return []
    const items: HistoryItem[] = []
    const savings = bucket.kind === "savings"
    const income = bucket.kind === "income"
    const asDeposit = savings || income

    if (savings) {
      const year = yearFromPaychecks(paychecks)
      const carry =
        typeof category.balance === "number" && Number.isFinite(category.balance)
          ? category.balance
          : 0
      if (carry !== 0) {
        items.push({
          id: "carryover",
          date: `${year}-01-01`,
          kind: "carryover",
          amount: carry,
        })
      }
    }

    for (const p of paychecks) {
      const key = allocationKey(category.id, p.id)
      const checked = doneKeys.has(key)
      const amount = allocationNumber(category.allocations, p.date)
      if (checked && amount !== null) {
        items.push(
          asDeposit
            ? {
                id: `deposit-${p.id}`,
                date: p.date,
                kind: "deposit",
                amount,
              }
            : {
                id: `payment-${p.id}`,
                date: p.date,
                kind: "payment",
                amount: -Math.abs(amount),
              },
        )
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

    if (savings) {
      for (const w of withdrawals) {
        if (w.categoryId !== category.id) continue
        items.push({
          id: `withdrawal-${w.id}`,
          date: w.date,
          kind: "withdrawal",
          amount: -Math.abs(w.amount),
          comment: w.note,
        })
      }
    }

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [category, bucket, paychecks, doneKeys, withdrawals])

  if (!category || !bucket) return null

  const typeLabel =
    bucket.kind === "savings"
      ? "Savings"
      : bucket.kind === "income"
        ? "Income"
        : "Expense"

  const historyEmptyCopy = "Deposits and withdrawals will show up here."

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setPlannedExpanded(false)
        onOpenChange(next)
      }}
    >
      <SheetContent
        className="overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{category.name}</SheetTitle>
          <p className="text-xs text-neutral-400">{typeLabel}</p>
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
                <dt className="text-muted-foreground">Total saved</dt>
                <dd className="mt-2 font-medium tabular-nums">
                  {formatMoney(
                    savingsActualForCategory(
                      category,
                      paychecks,
                      doneKeys,
                      withdrawals,
                    ),
                  )}
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
          ) : isIncome ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Income</dt>
                <dd className="mt-2 font-medium tabular-nums">
                  {formatMoney(
                    category.amount ?? category.recurringAmount,
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Due date</dt>
                <dd className="mt-2 font-medium">
                  {formatCategoryDue(category)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Min / payment</dt>
                <dd className="mt-2 font-medium">
                  {formatMoney(category.minPayment ?? category.recurringAmount)}
                </dd>
              </div>
            </dl>
          )}

          <section className="rounded-xl border border-neutral-200 bg-[#FCF9FA] px-4">
            <div className="pt-4 pb-2">
              <h3 className="text-sm font-medium text-foreground">
                Comments
              </h3>
            </div>
            <textarea
              value={noteDraft}
              placeholder="Add a comment…"
              rows={2}
              className="min-h-[calc(2*1.625em)] w-full resize-none border-0 bg-transparent pb-4 pt-0 text-sm leading-relaxed text-foreground outline-none ring-0 placeholder:text-[#B5AEB0] focus:border-0 focus:outline-none focus:ring-0"
              onChange={(e) => {
                const next = e.target.value
                setNoteDraft(next)
                onCategoryNoteChange(category.id, next)
              }}
            />
          </section>

          {isSavings ? (
            <section className="overflow-hidden rounded-xl border border-neutral-200 px-4">
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
                <div>
                  <ul className="space-y-4 px-0 py-4">
                    {visiblePlanned.map(({ paycheck, amount }) => (
                      <li
                        key={paycheck.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-neutral-600">
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
                      className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-foreground transition-colors hover:text-neutral-700"
                      onClick={() => setPlannedExpanded((v) => !v)}
                    >
                      {plannedExpanded
                        ? "View less"
                        : `View ${plannedHiddenCount} more`}
                      <CaretDownIcon
                        className={cn(
                          "size-2 text-current transition-transform",
                          plannedExpanded && "rotate-180",
                        )}
                      />
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border border-neutral-200 bg-white px-4">
            <div className="flex items-center justify-between gap-3 py-4">
              <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                History
              </h3>
            </div>
            <div className="border-t border-neutral-200" />
            {historyItems.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {historyEmptyCopy}
              </p>
            ) : (
              <ul className="space-y-4 py-4">
                {historyItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {historyLabel(item)}
                    </span>
                    <span
                      className={cn(
                        "w-20 shrink-0 text-right tabular-nums",
                        item.kind === "comment"
                          ? "text-muted-foreground"
                          : "text-foreground",
                      )}
                    >
                      {historyAmountText(item)}
                    </span>
                    <time
                      dateTime={item.date}
                      className="w-14 shrink-0 text-right tabular-nums text-muted-foreground"
                    >
                      {formatPayDate(item.date)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
