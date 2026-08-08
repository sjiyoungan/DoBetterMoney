import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  savingsActualForCategory,
  totalSavingsAllocated,
} from "@/lib/budget-summary"
import { allocationKey, formatMoney, formatPayDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Bucket, Category, Paycheck, YearBudget } from "@/types/budget"

type Props = {
  workspace: YearBudget
  doneKeys: Set<string>
  selectedPaycheckId: string
  onSelectedPaycheckChange: (id: string) => void
  onConfirmTransfer: (paycheckId: string, categoryIds: string[]) => void
}

type TransferRow = {
  categoryId: string
  categoryName: string
  amount: number
}

function allocationAmount(cat: Category, date: string): number {
  const raw = cat.allocations[date]
  if (raw === "" || raw === undefined) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function transferBuckets(buckets: Bucket[]) {
  return buckets.filter(
    (b) => b.kind === "spending" || b.kind === "savings",
  )
}

function transferRowsForPaycheck(
  buckets: Bucket[],
  paycheck: Paycheck,
  doneKeys: Set<string>,
  pendingOnly: boolean,
): TransferRow[] {
  const rows: TransferRow[] = []
  for (const bucket of transferBuckets(buckets)) {
    for (const cat of bucket.categories) {
      if (cat.hidden) continue
      const amount = allocationAmount(cat, paycheck.date)
      if (amount === 0) continue
      const key = allocationKey(cat.id, paycheck.id)
      if (pendingOnly && doneKeys.has(key)) continue
      rows.push({
        categoryId: cat.id,
        categoryName: cat.name,
        amount,
      })
    }
  }
  return rows
}

function isPaycheckPending(
  paycheck: Paycheck,
  buckets: Bucket[],
  doneKeys: Set<string>,
): boolean {
  return (
    transferRowsForPaycheck(buckets, paycheck, doneKeys, true).length > 0
  )
}

export function HolderPanel({
  workspace,
  doneKeys,
  selectedPaycheckId,
  onSelectedPaycheckChange,
  onConfirmTransfer,
}: Props) {
  const pendingPaychecks = useMemo(
    () =>
      workspace.paychecks
        .filter((p) => isPaycheckPending(p, workspace.buckets, doneKeys))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [workspace.paychecks, workspace.buckets, doneKeys],
  )

  useEffect(() => {
    if (pendingPaychecks.length === 0) return
    const stillPending = pendingPaychecks.some(
      (p) => p.id === selectedPaycheckId,
    )
    if (!stillPending) {
      onSelectedPaycheckChange(pendingPaychecks[0]!.id)
    }
  }, [pendingPaychecks, selectedPaycheckId, onSelectedPaycheckChange])

  const selectedPaycheck =
    pendingPaychecks.find((p) => p.id === selectedPaycheckId) ??
    pendingPaychecks[0] ??
    null

  const rows = selectedPaycheck
    ? transferRowsForPaycheck(
        workspace.buckets,
        selectedPaycheck,
        doneKeys,
        true,
      )
    : []

  const transferTotal = rows.reduce((sum, row) => sum + row.amount, 0)

  const accountRows = useMemo(() => {
    const list: { id: string; name: string; amount: number }[] = []
    for (const bucket of workspace.buckets) {
      if (bucket.kind !== "savings") continue
      for (const cat of bucket.categories) {
        if (cat.hidden) continue
        const amount = savingsActualForCategory(
          cat,
          workspace.paychecks,
          doneKeys,
        )
        list.push({ id: cat.id, name: cat.name, amount })
      }
    }
    return list
  }, [workspace.buckets, workspace.paychecks, doneKeys])

  const accountTotal = totalSavingsAllocated(
    workspace.buckets,
    workspace.paychecks,
    doneKeys,
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          {pendingPaychecks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending paychecks to transfer.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pendingPaychecks.map((p) => {
                const selected = p.id === selectedPaycheck?.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectedPaycheckChange(p.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm tabular-nums transition-colors",
                      selected
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-foreground hover:border-neutral-500 hover:bg-neutral-50",
                    )}
                  >
                    {formatPayDate(p.date)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          {selectedPaycheck && rows.length > 0 ? (
            <ul className="flex-1 space-y-3 py-4">
              {rows.map((row) => (
                <li
                  key={row.categoryId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {row.categoryName}
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex-1 py-4 text-sm text-muted-foreground">
              {pendingPaychecks.length === 0
                ? "You’re caught up."
                : "Nothing left to put away for this paycheck."}
            </p>
          )}

          {rows.length > 0 ? (
            <div className="flex items-center justify-between border-t border-neutral-200 py-3 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(transferTotal)}</span>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-neutral-200 px-4 py-3">
          <Button
            type="button"
            disabled={!selectedPaycheck || rows.length === 0}
            onClick={() => {
              if (!selectedPaycheck) return
              onConfirmTransfer(
                selectedPaycheck.id,
                rows.map((r) => r.categoryId),
              )
            }}
          >
            Done
          </Button>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            In the account
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Carry-over plus checked deposits
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4">
          {accountRows.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No savings categories yet.
            </p>
          ) : (
            <ul className="flex-1 space-y-3 py-4">
              {accountRows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      row.amount === 0
                        ? "text-neutral-400"
                        : "text-foreground",
                    )}
                  >
                    {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-neutral-200 py-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(accountTotal)}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
