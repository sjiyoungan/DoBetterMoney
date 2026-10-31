import { useEffect, useMemo, useState } from "react"
import { MessageSquareText } from "lucide-react"
import { CaretDownIcon } from "@/components/ui/caret-down"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { SavingsBucketTotal } from "@/lib/budget-summary"
import {
  COMPOSITION_COLORS,
  savingsActualForCategory,
} from "@/lib/budget-summary"
import { allocationKey, formatMoney, formatPayDate } from "@/lib/format"
import { blushHoverClass, cn } from "@/lib/utils"
import type {
  Bucket,
  Category,
  Deposit,
  Paycheck,
  Withdrawal,
} from "@/types/budget"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: SavingsBucketTotal[]
  total: number
  buckets: Bucket[]
  paychecks: Paycheck[]
  doneKeys: Set<string>
  withdrawals?: Withdrawal[]
  deposits?: Deposit[]
}

type HistoryItem = {
  id: string
  date: string
  kind: "carryover" | "deposit" | "withdrawal" | "repayment"
  amount: number
  comment?: string
  borrow?: boolean
}

function findCategory(
  buckets: Bucket[],
  categoryId: string,
): { category: Category; bucket: Bucket } | null {
  for (const bucket of buckets) {
    const category = bucket.categories.find((c) => c.id === categoryId)
    if (category) return { category, bucket }
  }
  return null
}

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

function historyLabel(item: HistoryItem): string {
  if (item.kind === "carryover") return "Carry over"
  if (item.kind === "deposit") return "Deposit"
  if (item.kind === "repayment") return "Payback"
  if (item.borrow) return "Borrow"
  return "Withdrawal"
}

function historyAmountText(item: HistoryItem): string {
  if (item.amount < 0) return `-${formatMoney(Math.abs(item.amount))}`
  return `+${formatMoney(item.amount)}`
}

export function SavingsDetailDrawer({
  open,
  onOpenChange,
  rows,
  total,
  buckets,
  paychecks,
  doneKeys,
  withdrawals = [],
  deposits = [],
}: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
  const groups = rows.filter((row) => row.categories.length > 0)

  useEffect(() => {
    if (!open) setSelectedCategoryId(null)
  }, [open])

  const selected = selectedCategoryId
    ? findCategory(buckets, selectedCategoryId)
    : null

  const selectedAmount = useMemo(() => {
    if (!selected) return 0
    return savingsActualForCategory(
      selected.category,
      paychecks,
      doneKeys,
      withdrawals,
      deposits,
    )
  }, [selected, paychecks, doneKeys, withdrawals, deposits])

  const historyItems = useMemo((): HistoryItem[] => {
    if (!selected) return []
    const { category } = selected
    const items: HistoryItem[] = []
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

    for (const p of paychecks) {
      const key = allocationKey(category.id, p.id)
      if (!doneKeys.has(key)) continue
      const amount = allocationNumber(category.allocations, p.date)
      if (amount === null) continue
      items.push({
        id: `deposit-${p.id}`,
        date: p.date,
        kind: "deposit",
        amount,
      })
    }

    for (const w of withdrawals) {
      if (w.categoryId !== category.id) continue
      items.push({
        id: `withdrawal-${w.id}`,
        date: w.date,
        kind: "withdrawal",
        amount: -Math.abs(w.amount),
        comment: w.note,
        borrow: w.kind === "borrow",
      })
    }

    for (const d of deposits) {
      if (d.categoryId !== category.id) continue
      items.push({
        id: `repayment-${d.id}`,
        date: d.date,
        kind: "repayment",
        amount: Math.abs(d.amount),
        comment: d.note,
      })
    }

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [selected, paychecks, doneKeys, withdrawals, deposits])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {selected ? (
          <>
            <SheetHeader>
              <button
                type="button"
                className="mb-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setSelectedCategoryId(null)}
              >
                <CaretDownIcon className="size-2 rotate-90 text-current" />
                Total savings
              </button>
              <SheetTitle>{selected.category.name}</SheetTitle>
              <p className="text-xs text-neutral-400">
                {selected.bucket.name}
              </p>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <p className="text-3xl font-light tracking-tight tabular-nums text-foreground">
                {formatMoney(selectedAmount)}
              </p>

              <section className="rounded-xl border border-neutral-200 bg-white px-4">
                <div className="flex items-center justify-between gap-3 py-4">
                  <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                    History
                  </h3>
                </div>
                <div className="border-t border-neutral-200" />
                {historyItems.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Deposits and withdrawals will show up here.
                  </p>
                ) : (
                  <ul className="space-y-4 py-4">
                    {historyItems.map((item) => {
                      const tip = item.comment?.trim() || undefined
                      return (
                        <li
                          key={item.id}
                          title={tip}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-foreground">
                            <span className="truncate">
                              {historyLabel(item)}
                            </span>
                            {tip ? (
                              <MessageSquareText
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-label={tip}
                              />
                            ) : null}
                          </span>
                          <span className="w-20 shrink-0 text-right tabular-nums text-foreground">
                            {historyAmountText(item)}
                          </span>
                          <time
                            dateTime={item.date}
                            className="w-14 shrink-0 text-right tabular-nums text-muted-foreground"
                          >
                            {formatPayDate(item.date)}
                          </time>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Total savings</SheetTitle>
            </SheetHeader>

            <div className="mt-2 space-y-5">
              <p className="text-3xl font-light tracking-tight tabular-nums text-foreground">
                {formatMoney(total)}
              </p>

              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No savings categories yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <section
                      key={group.bucketId}
                      className="rounded-xl border border-neutral-200 bg-white px-4"
                    >
                      <div className="flex items-center justify-between gap-3 py-4">
                        <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
                          {group.bucketName}
                        </h3>
                        <span
                          className={cn(
                            "shrink-0 text-base tabular-nums",
                            group.amount === 0
                              ? "text-neutral-400"
                              : "text-foreground",
                          )}
                        >
                          {formatMoney(group.amount)}
                        </span>
                      </div>
                      <div className="border-t border-neutral-200" />
                      <ul className="py-2">
                        {group.categories.map((cat) => {
                          const goal =
                            typeof cat.goal === "number" &&
                            Number.isFinite(cat.goal) &&
                            cat.goal > 0
                              ? cat.goal
                              : 0
                          const progress =
                            goal > 0 ? (cat.amount / goal) * 100 : 0
                          const pct = goal > 0 ? Math.round(progress) : 0
                          return (
                            <li key={cat.categoryId}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCategoryId(cat.categoryId)
                                }
                                className={cn(
                                  "-mx-2 flex w-[calc(100%+1rem)] items-center rounded-md px-2 py-2.5 text-left text-sm transition-[background] duration-150",
                                  blushHoverClass,
                                )}
                              >
                                <span className="min-w-0 flex-1 truncate font-normal text-foreground">
                                  {cat.categoryName}
                                </span>
                                <div className="ml-auto flex shrink-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      "tabular-nums",
                                      cat.amount === 0
                                        ? "text-neutral-400"
                                        : "text-foreground",
                                    )}
                                  >
                                    {formatMoney(cat.amount)}
                                  </span>
                                  <div className="h-2 w-16 overflow-hidden rounded-full bg-neutral-200 sm:w-20">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(progress, 100)}%`,
                                        backgroundColor:
                                          COMPOSITION_COLORS.savings,
                                      }}
                                    />
                                  </div>
                                  <span className="w-8 text-right tabular-nums text-neutral-600">
                                    {pct}%
                                  </span>
                                </div>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
