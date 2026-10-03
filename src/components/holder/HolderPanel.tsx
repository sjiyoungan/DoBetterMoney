import { useEffect, useMemo, useRef, useState } from "react"
import { BanknoteArrowDown, History, Settings, Undo2 } from "lucide-react"
import { CategoryDrawer } from "@/components/dashboard/CategoryDrawer"
import { TotalsSourcesEditor } from "@/components/dashboard/TotalsSourcesEditor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  accountCategoryBalances,
  accountTotalBalance,
  pendingTransferPaychecks,
  sourceBucketsForAccount,
  sourceBucketsForJi,
  transferRowsForPaycheck,
} from "@/lib/ji-transfer"
import { formatMoney, formatPayDate } from "@/lib/format"
import { blushHoverClass, cn } from "@/lib/utils"
import type {
  Bucket,
  Category,
  JiTransferLog,
  JiTransferSource,
  YearBudget,
} from "@/types/budget"

type Props = {
  workspace: YearBudget
  doneKeys: Set<string>
  selectedPaycheckId: string
  onSelectedPaycheckChange: (id: string) => void
  onConfirmTransfer: (input: {
    paycheckId: string
    paycheckDate: string
    total: number
    categoryIds: string[]
  }) => void
  onSaveTransferSources: (sources: JiTransferSource[]) => void
  onSaveAccountSources: (sources: JiTransferSource[]) => void
  onSaveTransferLog: (log: JiTransferLog[]) => void
  onWithdraw: (input: { categoryId: string; amount: number }) => void
  onCategoryNoteChange: (categoryId: string, note: string) => void
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

export function HolderPanel({
  workspace,
  doneKeys,
  selectedPaycheckId,
  onSelectedPaycheckChange,
  onConfirmTransfer,
  onSaveTransferSources,
  onSaveAccountSources,
  onSaveTransferLog,
  onWithdraw,
  onCategoryNoteChange,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawCategoryId, setWithdrawCategoryId] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
  const [undoDraftIds, setUndoDraftIds] = useState<Set<string>>(new Set())
  const didInitSelection = useRef(false)

  const sources = workspace.jiTransferSources
  const accountSources = workspace.jiAccountSources
  const log = workspace.jiTransferLog ?? []
  const withdrawals = workspace.withdrawals ?? []

  const pendingPaychecks = useMemo(
    () =>
      pendingTransferPaychecks(
        workspace.paychecks,
        workspace.buckets,
        doneKeys,
        sources,
        log,
      ),
    [workspace.paychecks, workspace.buckets, doneKeys, sources, log],
  )

  useEffect(() => {
    if (pendingPaychecks.length === 0) return
    const earliestId = pendingPaychecks[0]!.id
    if (!didInitSelection.current) {
      didInitSelection.current = true
      if (selectedPaycheckId !== earliestId) {
        onSelectedPaycheckChange(earliestId)
      }
      return
    }
    const stillPending = pendingPaychecks.some(
      (p) => p.id === selectedPaycheckId,
    )
    if (!stillPending) {
      onSelectedPaycheckChange(earliestId)
    }
  }, [pendingPaychecks, selectedPaycheckId, onSelectedPaycheckChange])

  useEffect(() => {
    if (!historyOpen) setUndoDraftIds(new Set())
  }, [historyOpen])

  const selectedPaycheck =
    pendingPaychecks.find((p) => p.id === selectedPaycheckId) ??
    pendingPaychecks[0] ??
    null

  const rows = selectedPaycheck
    ? transferRowsForPaycheck(
        workspace.buckets,
        selectedPaycheck,
        doneKeys,
        sources,
        log,
      )
    : []

  const transferTotal = rows.reduce((sum, row) => sum + row.amount, 0)

  const historyRows = useMemo(() => {
    return [...log].sort((a, b) => {
      const aKey = a.undoneAt ?? a.confirmedAt
      const bKey = b.undoneAt ?? b.confirmedAt
      return bKey.localeCompare(aKey)
    })
  }, [log])

  const accountRows = useMemo(
    () =>
      accountCategoryBalances(
        workspace.buckets,
        log,
        withdrawals,
        accountSources,
      ),
    [workspace.buckets, log, withdrawals, accountSources],
  )

  const accountTotal = useMemo(
    () =>
      accountTotalBalance(
        workspace.buckets,
        log,
        withdrawals,
        accountSources,
      ),
    [workspace.buckets, log, withdrawals, accountSources],
  )

  const jiSourceBuckets = sourceBucketsForJi(workspace.buckets)
  const accountSourceBuckets = sourceBucketsForAccount(workspace.buckets)

  const selectedDetail = selectedCategoryId
    ? findCategory(workspace.buckets, selectedCategoryId)
    : null

  const withdrawOptions = accountRows.filter((row) => row.amount > 0)

  useEffect(() => {
    if (!withdrawOpen) return
    if (
      withdrawCategoryId &&
      withdrawOptions.some((r) => r.id === withdrawCategoryId)
    ) {
      return
    }
    setWithdrawCategoryId(withdrawOptions[0]?.id ?? "")
  }, [withdrawOpen, withdrawOptions, withdrawCategoryId])

  function toggleUndoDraft(id: string) {
    setUndoDraftIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function saveHistoryDraft() {
    if (undoDraftIds.size === 0) {
      setHistoryOpen(false)
      return
    }
    const now = new Date().toISOString()
    const next = log.map((entry) => {
      if (!undoDraftIds.has(entry.id) || entry.undoneAt) return entry
      return { ...entry, undoneAt: now }
    })
    onSaveTransferLog(next)
    setUndoDraftIds(new Set())
    setHistoryOpen(false)
  }

  function openWithdraw() {
    setWithdrawAmount("")
    setWithdrawCategoryId(withdrawOptions[0]?.id ?? "")
    setWithdrawOpen(true)
  }

  function submitWithdraw() {
    const amount = Number(withdrawAmount)
    if (!withdrawCategoryId || !Number.isFinite(amount) || amount <= 0) return
    const max =
      accountRows.find((r) => r.id === withdrawCategoryId)?.amount ?? 0
    const capped = Math.min(amount, max)
    if (capped <= 0) return
    onWithdraw({ categoryId: withdrawCategoryId, amount: capped })
    setWithdrawOpen(false)
    setWithdrawAmount("")
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-6 py-3">
          <div className="flex h-8 items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Transfer
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Transfer history"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-4" />
              </button>
              <button
                type="button"
                title="Choose groups and categories"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col px-6">
          {pendingPaychecks.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-4">
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
                        ? "border-[#E5D4D7] bg-[#F7EBEE] text-[#3A121C]"
                        : "border-neutral-300 bg-white text-foreground hover:border-neutral-400 hover:bg-[#FDF9FA]/60",
                    )}
                  >
                    {formatPayDate(p.date)}
                  </button>
                )
              })}
            </div>
          ) : null}

          {selectedPaycheck && rows.length > 0 ? (
            <>
              <ul className="space-y-0 pt-4">
                {rows.map((row) => (
                  <li
                    key={row.categoryId}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
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
              <div className="flex items-center justify-between border-t border-neutral-200 py-4 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMoney(transferTotal)}
                </span>
              </div>
            </>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              There isn’t anything ready to transfer yet. Once Liz checks off
              allocations, they’ll show up here.
            </p>
          )}
        </div>

        <div className="flex justify-end py-3 pl-6 pr-[14px]">
          <Button
            type="button"
            disabled={!selectedPaycheck || rows.length === 0}
            onClick={() => {
              if (!selectedPaycheck) return
              onConfirmTransfer({
                paycheckId: selectedPaycheck.id,
                paycheckDate: selectedPaycheck.date,
                total: transferTotal,
                categoryIds: rows.map((r) => r.categoryId),
              })
            }}
          >
            Done
          </Button>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-6 py-3">
          <div className="flex h-8 items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Account balance
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Choose groups and categories"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setAccountSettingsOpen(true)}
              >
                <Settings className="size-4" />
              </button>
              <button
                type="button"
                title="Withdraw"
                disabled={withdrawOptions.length === 0}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                onClick={openWithdraw}
              >
                <BanknoteArrowDown className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          {accountRows.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No savings categories yet.
            </p>
          ) : (
            <ul className="space-y-0 pt-3">
              {accountRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-6 py-2.5 text-left text-sm transition-[background] duration-150",
                      blushHoverClass,
                    )}
                    onClick={() => setSelectedCategoryId(row.id)}
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
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(accountTotal)}</span>
          </div>
        </div>
      </section>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="overflow-y-auto">
          <TotalsSourcesEditor
            value={sources}
            sourceBuckets={jiSourceBuckets}
            onCancel={() => setSettingsOpen(false)}
            onSave={(next) => {
              onSaveTransferSources(next)
              setSettingsOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={accountSettingsOpen} onOpenChange={setAccountSettingsOpen}>
        <SheetContent className="overflow-y-auto">
          <TotalsSourcesEditor
            value={accountSources}
            sourceBuckets={accountSourceBuckets}
            onCancel={() => setAccountSettingsOpen(false)}
            onSave={(next) => {
              onSaveAccountSources(next)
              setAccountSettingsOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="flex flex-col overflow-hidden p-0">
          <div className="flex min-h-0 flex-1 flex-col p-8 pb-0">
            <SheetHeader className="mb-6">
              <SheetTitle>Transfer history</SheetTitle>
            </SheetHeader>

            {historyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Confirmed put-aways will show up here.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-6">
                {historyRows.map((entry) => {
                  const markedUndo =
                    Boolean(entry.undoneAt) || undoDraftIds.has(entry.id)
                  return (
                    <li key={entry.id} className="text-sm">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 tabular-nums text-foreground">
                          {formatPayDate(entry.paycheckDate)}
                        </span>
                        <span
                          className={cn(
                            "w-20 shrink-0 text-right tabular-nums",
                            markedUndo
                              ? "text-muted-foreground line-through"
                              : "text-foreground",
                          )}
                        >
                          {formatMoney(entry.total)}
                        </span>
                        <button
                          type="button"
                          title={
                            entry.undoneAt
                              ? "Already undone"
                              : markedUndo
                                ? "Keep this confirmation"
                                : "Undo this confirmation"
                          }
                          disabled={Boolean(entry.undoneAt)}
                          className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                            entry.undoneAt
                              ? "cursor-default text-neutral-300"
                              : markedUndo
                                ? "bg-neutral-100 text-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                          onClick={() => {
                            if (entry.undoneAt) return
                            toggleUndoDraft(entry.id)
                          }}
                        >
                          <Undo2 className="size-4" />
                        </button>
                      </div>
                      {entry.undoneAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Undone {formatPayDate(entry.undoneAt.slice(0, 10))}
                        </p>
                      ) : undoDraftIds.has(entry.id) ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Will undo on save
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t bg-muted/50 px-8 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setHistoryOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveHistoryDraft}>
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Withdraw</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="withdraw-category">Category</Label>
              <Select
                value={withdrawCategoryId}
                onValueChange={setWithdrawCategoryId}
              >
                <SelectTrigger id="withdraw-category" className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {withdrawOptions.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name} ({formatMoney(row.amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="withdraw-amount">Amount</Label>
              <Input
                id="withdraw-amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setWithdrawOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !withdrawCategoryId ||
                !Number.isFinite(Number(withdrawAmount)) ||
                Number(withdrawAmount) <= 0
              }
              onClick={submitWithdraw}
            >
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryDrawer
        open={!!selectedDetail}
        onOpenChange={(open) => {
          if (!open) setSelectedCategoryId(null)
        }}
        category={selectedDetail?.category ?? null}
        bucket={selectedDetail?.bucket ?? null}
        paychecks={workspace.paychecks}
        doneKeys={doneKeys}
        withdrawals={withdrawals}
        onCategoryNoteChange={onCategoryNoteChange}
      />
    </div>
  )
}
