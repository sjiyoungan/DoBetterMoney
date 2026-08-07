import { useEffect, useMemo, useRef, useState } from "react"
import { Check } from "lucide-react"
import { AddBucketDialog } from "@/components/dashboard/AddBucketDialog"
import { CategoryDrawer } from "@/components/dashboard/CategoryDrawer"
import { OnboardingFlow } from "@/components/dashboard/OnboardingFlow"
import { Button } from "@/components/ui/button"
import { allocationKey, formatPayDate } from "@/lib/format"
import type { IncomeSourceInput } from "@/lib/income-schedule"
import { cn } from "@/lib/utils"
import type { Bucket, Category, Paycheck } from "@/types/budget"

type Props = {
  buckets: Bucket[]
  paychecks: Paycheck[]
  doneKeys: Set<string>
  onToggleDone: (key: string) => void
  onAmountChange: (categoryId: string, date: string, value: string) => void
  onAmountApplyToFuture: (
    categoryId: string,
    fromDate: string,
    value: string,
  ) => void
  onAmountCommit?: () => void
  onCategoryFieldChange: (
    categoryId: string,
    field: "goal" | "balance",
    value: string,
  ) => void
  onAddBucket: (bucket: Bucket) => void
  onUpdateBucket: (bucket: Bucket) => void
  onSetupIncome: (sources: IncomeSourceInput[]) => void
}

const W = { bucket: 92, category: 168, goal: 96, balance: 96, pay: 128 } as const
const LEFT_WIDTH = W.bucket + W.category + W.goal + W.balance

const paneBg = "bg-white dark:bg-background"

type GridRow = {
  key: string
  rowCount: number
  isFirstInBucket: boolean
  isLastInBucket: boolean
  showBucketDivider: boolean
}

/**
 * Split-pane budget grid.
 *
 * Left pane (Group → Balance) does not scroll horizontally.
 * Right pane (paycheck columns) scrolls independently.
 * Outer frame owns 8px radius + clip. Upcoming stroke overlays the card
 * border (sibling, not clipped) so top/bottom sit on the frame edge.
 * Left pane owns the scroll shadow.
 * Sticky offsets are intentionally not used — that keeps cosmetics independent.
 */
export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
  onAmountApplyToFuture,
  onAmountCommit,
  onCategoryFieldChange,
  onAddBucket,
  onUpdateBucket,
  onSetupIncome,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftTableRef = useRef<HTMLTableElement>(null)
  const rightTableRef = useRef<HTMLTableElement>(null)
  const leftHeaderRef = useRef<HTMLTableRowElement>(null)
  const rightHeaderRef = useRef<HTMLTableRowElement>(null)
  const leftRowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const rightRowRefs = useRef(new Map<string, HTMLTableRowElement>())

  const [scrolled, setScrolled] = useState(false)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [bucketDialog, setBucketDialog] = useState<
    { mode: "create" } | { mode: "edit"; bucket: Bucket } | null
  >(null)
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

  const rows = useMemo(() => {
    const result: GridRow[] = []
    orderedBuckets.forEach((bucket, bucketIndex) => {
      bucket.categories.forEach((category, rowIndex) => {
        result.push({
          key: category.id,
          rowCount: bucket.categories.length,
          isFirstInBucket: rowIndex === 0,
          isLastInBucket: rowIndex === bucket.categories.length - 1,
          showBucketDivider: rowIndex === 0 && bucketIndex > 0,
        })
      })
    })
    return result
  }, [orderedBuckets])

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

  // Scroll right pane so the upcoming paycheck is visible
  useEffect(() => {
    const el = scrollRef.current
    if (!el || upcomingIndex < 0) return
    el.scrollLeft = Math.max(0, upcomingIndex - 1) * W.pay
    setScrolled(el.scrollLeft > 1)
    setScrollLeft(el.scrollLeft)
  }, [upcomingIndex])

  // Track horizontal scroll + map vertical wheel to horizontal in the right pane
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      setScrolled(el.scrollLeft > 1)
      setScrollLeft(el.scrollLeft)
    }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("wheel", onWheel)
    }
  }, [])

  // Keep left/right row heights matched
  useEffect(() => {
    const sync = () => {
      const pairs: Array<[HTMLTableRowElement | null, HTMLTableRowElement | null]> = [
        [leftHeaderRef.current, rightHeaderRef.current],
        ...rows.map(
          (row) =>
            [
              leftRowRefs.current.get(row.key) ?? null,
              rightRowRefs.current.get(row.key) ?? null,
            ] as [HTMLTableRowElement | null, HTMLTableRowElement | null],
        ),
      ]

      for (const [left, right] of pairs) {
        if (!left || !right) continue
        left.style.height = ""
        right.style.height = ""
      }

      for (const [left, right] of pairs) {
        if (!left || !right) continue
        const height = Math.max(left.offsetHeight, right.offsetHeight)
        left.style.height = `${height}px`
        right.style.height = `${height}px`
      }
    }

    sync()
    const ro = new ResizeObserver(sync)
    if (leftTableRef.current) ro.observe(leftTableRef.current)
    if (rightTableRef.current) ro.observe(rightTableRef.current)
    return () => ro.disconnect()
  }, [rows, paychecks])

  const balanceEdge = scrolled ? "" : "border-r border-r-neutral-900"

  function setLeftRowRef(key: string, el: HTMLTableRowElement | null) {
    if (el) leftRowRefs.current.set(key, el)
    else leftRowRefs.current.delete(key)
  }

  function setRightRowRef(key: string, el: HTMLTableRowElement | null) {
    if (el) rightRowRefs.current.set(key, el)
    else rightRowRefs.current.delete(key)
  }

  if (buckets.every((b) => b.kind === "income")) {
    return (
      <OnboardingFlow
        hasIncome={buckets.some((b) => b.kind === "income")}
        paychecks={paychecks}
        onSetupIncome={onSetupIncome}
        onAddGroup={onAddBucket}
      />
    )
  }

  return (
    <div>
      <div className="relative">
        <div className="overflow-hidden rounded-[8px] border border-neutral-500">
          <div className="flex">
          {/* Left pane: labels stay put; owns the continuous scroll shadow */}
          <div
            className={cn("relative z-10 shrink-0", paneBg)}
            style={{
              width: LEFT_WIDTH,
              boxShadow: scrolled
                ? "6px 0 10px rgba(0, 0, 0, 0.16)"
                : "none",
            }}
          >
            <table
              ref={leftTableRef}
              className="w-full border-separate border-spacing-0 text-sm"
            >
              <colgroup>
                <col style={{ width: W.bucket }} />
                <col style={{ width: W.category }} />
                <col style={{ width: W.goal }} />
                <col style={{ width: W.balance }} />
              </colgroup>

              <thead>
                <tr ref={leftHeaderRef}>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 border-r border-r-neutral-900 px-3 py-3 text-center font-medium",
                      paneBg,
                    )}
                  >
                    Group
                  </th>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 border-r border-r-border/60 px-3 py-3 text-left font-medium",
                      paneBg,
                    )}
                  >
                    Category
                  </th>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 border-r border-r-border/60 px-3 py-3 text-right font-medium",
                      paneBg,
                    )}
                  >
                    Goal
                  </th>
                  <th
                    className={cn(
                      "border-b-2 border-b-neutral-900 px-3 py-3 text-right font-medium",
                      paneBg,
                      balanceEdge,
                    )}
                  >
                    Balance
                  </th>
                </tr>
              </thead>

              {orderedBuckets.map((bucket) => (
                <tbody key={bucket.id}>
                  {bucket.categories.map((category) => {
                    const row = rows.find((r) => r.key === category.id)!
                    const isSavings = bucket.kind === "savings"

                    return (
                      <tr
                        key={category.id}
                        ref={(el) => setLeftRowRef(category.id, el)}
                      >
                        {row.isFirstInBucket ? (
                          <td
                            rowSpan={row.rowCount}
                            className={cn(
                              "relative border-r border-r-neutral-900 p-0 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                              paneBg,
                              row.showBucketDivider &&
                                "border-t-2 border-t-neutral-900",
                            )}
                          >
                            <button
                              type="button"
                              title={`Edit ${bucket.name}`}
                              onClick={() =>
                                setBucketDialog({ mode: "edit", bucket })
                              }
                              className="absolute inset-0 flex items-center justify-center px-2 transition-colors hover:bg-neutral-100 hover:text-foreground"
                            >
                              {bucket.name}
                            </button>
                          </td>
                        ) : null}

                        <td
                          className={cn(
                            "border-r border-r-border/60 p-0",
                            paneBg,
                            row.showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            !row.isLastInBucket && "border-b border-b-border/60",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelected({ category, bucket })}
                            className="h-9 w-full px-3 text-left text-sm transition-colors hover:bg-neutral-100 hover:text-foreground"
                          >
                            {category.name}
                          </button>
                        </td>

                        <td
                          className={cn(
                            "border-r border-r-border/60 px-1",
                            paneBg,
                            row.showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            !row.isLastInBucket && "border-b border-b-border/60",
                          )}
                        >
                          {isSavings ? (
                            <MoneyField
                              value={
                                category.goal === undefined
                                  ? ""
                                  : String(category.goal)
                              }
                              onChange={(value) =>
                                onCategoryFieldChange(category.id, "goal", value)
                              }
                            />
                          ) : null}
                        </td>

                        <td
                          className={cn(
                            "px-1 text-right tabular-nums text-muted-foreground",
                            paneBg,
                            balanceEdge,
                            row.showBucketDivider &&
                              "border-t-2 border-t-neutral-900",
                            !row.isLastInBucket && "border-b border-b-border/60",
                          )}
                        >
                          {isSavings ? (
                            <MoneyField
                              value={
                                category.balance === undefined
                                  ? ""
                                  : String(category.balance)
                              }
                              onChange={(value) =>
                                onCategoryFieldChange(
                                  category.id,
                                  "balance",
                                  value,
                                )
                              }
                            />
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </div>

          {/* Right pane: paycheck columns scroll horizontally */}
          <div
            ref={scrollRef}
            className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="relative w-max min-w-full">
              <table
                ref={rightTableRef}
                className="border-separate border-spacing-0 text-sm"
              >
                <colgroup>
                  {paychecks.map((p) => (
                    <col key={p.id} style={{ width: W.pay }} />
                  ))}
                </colgroup>

                <thead>
                  <tr ref={rightHeaderRef}>
                    {paychecks.map((p, i) => {
                      const isUpcoming = p.id === currentPaycheckId
                      const isPast =
                        !isUpcoming &&
                        (p.completed ||
                          (upcomingIndex >= 0 && i < upcomingIndex))
                      const isLast = i === paychecks.length - 1
                      return (
                        <th
                          key={p.id}
                          className={cn(
                            "border-b-2 border-b-neutral-900 px-1 py-3 text-center font-medium",
                            !isLast && "border-r border-r-border/60",
                            isUpcoming
                              ? "bg-[#FDF9FA] text-[#3A121C]"
                              : isPast
                                ? "bg-neutral-100 text-[#969696]"
                                : cn(paneBg, "text-muted-foreground"),
                          )}
                          style={{ width: W.pay, minWidth: W.pay }}
                        >
                          {formatPayDate(p.date)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                {orderedBuckets.map((bucket) => (
                  <tbody key={bucket.id}>
                    {bucket.categories.map((category) => {
                      const row = rows.find((r) => r.key === category.id)!

                      return (
                        <tr
                          key={category.id}
                          ref={(el) => setRightRowRef(category.id, el)}
                        >
                          {paychecks.map((p, i) => {
                            const raw = category.allocations[p.date]
                            const key = allocationKey(category.id, p.id)
                            const hasAmount =
                              raw !== "" &&
                              raw !== undefined &&
                              Number(raw) !== 0
                            const isUpcoming = p.id === currentPaycheckId
                            const manuallyDone = doneKeys.has(key)
                            const isLastCol = i === paychecks.length - 1
                            const isPast =
                              p.completed ||
                              (upcomingIndex >= 0 && i < upcomingIndex)
                            const cellGray = isPast
                            const canMarkDone =
                              hasAmount && (p.date <= today || isUpcoming)

                            return (
                              <td
                                key={p.id}
                                className={cn(
                                  "px-1",
                                  cellGray
                                    ? "bg-neutral-100 text-[#969696] dark:bg-neutral-900"
                                    : isUpcoming
                                      ? "bg-[#FDF9FA] text-[#3A121C] dark:bg-rose-950/10 dark:text-rose-100"
                                      : "bg-white dark:bg-background",
                                  !isLastCol && "border-r border-r-border/60",
                                  row.showBucketDivider &&
                                    "border-t-2 border-t-neutral-900",
                                  !row.isLastInBucket &&
                                    "border-b border-b-border/60",
                                )}
                                style={{ width: W.pay, minWidth: W.pay }}
                              >
                                <AmountCell
                                  value={
                                    raw === "" ||
                                    raw === undefined ||
                                    Number(raw) === 0
                                      ? ""
                                      : String(raw)
                                  }
                                  done={manuallyDone}
                                  accent={isUpcoming && !cellGray}
                                  showCheck={canMarkDone || manuallyDone}
                                  onChange={(value) =>
                                    onAmountChange(category.id, p.date, value)
                                  }
                                  onApplyToFuture={(value) =>
                                    onAmountApplyToFuture(
                                      category.id,
                                      p.date,
                                      value,
                                    )
                                  }
                                  onCommit={() => onAmountCommit?.()}
                                  onToggleDone={() => onToggleDone(key)}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </div>
        </div>

        {upcomingIndex >= 0 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[8px]"
            style={{ clipPath: `inset(0px 0px 0px ${LEFT_WIDTH}px)` }}
          >
            <div
              className="absolute border-2 border-[#C9A8AE]"
              style={{
                left: LEFT_WIDTH + upcomingIndex * W.pay - scrollLeft - 2,
                width: W.pay + 4,
                top: 0,
                bottom: 0,
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setBucketDialog({ mode: "create" })}
        >
          Add group
        </Button>
      </div>

      <AddBucketDialog
        key={
          bucketDialog
            ? bucketDialog.mode === "edit"
              ? bucketDialog.bucket.id
              : "create"
            : "closed"
        }
        open={!!bucketDialog}
        bucket={bucketDialog?.mode === "edit" ? bucketDialog.bucket : null}
        paychecks={paychecks}
        onOpenChange={(open) => {
          if (!open) setBucketDialog(null)
        }}
        onAdd={onAddBucket}
        onUpdate={onUpdateBucket}
      />

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

function MoneyField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div
      className={cn(
        "flex h-9 cursor-text items-center justify-end rounded-md border border-transparent px-2",
        "hover:border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
      )}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          className="h-7 w-full bg-transparent text-right text-sm tabular-nums text-foreground outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          inputMode="numeric"
        />
      ) : value !== "" ? (
        <span className="text-sm tabular-nums text-muted-foreground">
          ${value}
        </span>
      ) : null}
    </div>
  )
}

function AmountCell({
  value,
  done,
  accent = false,
  showCheck,
  onChange,
  onApplyToFuture,
  onCommit,
  onToggleDone,
}: {
  value: string
  done: boolean
  accent?: boolean
  showCheck: boolean
  onChange: (value: string) => void
  onApplyToFuture: (value: string) => void
  onCommit?: () => void
  onToggleDone: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [showFutureHint, setShowFutureHint] = useState(false)
  const startValueRef = useRef(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressApplyUntilRef = useRef(0)
  const hasAmount = value !== "" && Number(value) !== 0
  const canCheck = hasAmount && (showCheck || done)

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!showFutureHint) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setShowFutureHint(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [showFutureHint])

  function clearHintTimer() {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }

  function offerApplyToFuture() {
    // Delay showing the chip so the click/tap that blurred the input
    // cannot land on "Apply to future" and fan the value out.
    clearHintTimer()
    suppressApplyUntilRef.current = Date.now() + 500
    hintTimerRef.current = setTimeout(() => {
      setShowFutureHint(true)
      hintTimerRef.current = null
    }, 250)
  }

  return (
    <div ref={rootRef} className="group/cell relative flex h-9 items-center gap-1 px-1">
      {showFutureHint ? (
        <div className="absolute -top-1 right-0 z-30 flex translate-y-[-100%] items-center rounded-md border border-neutral-400 bg-white shadow-sm dark:border-neutral-500 dark:bg-neutral-900">
          <button
            type="button"
            title="Apply this amount to matching future pay periods"
            className="flex items-center px-1.5 py-[10px] text-[10px] leading-none text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 whitespace-nowrap dark:text-neutral-200 dark:hover:text-white"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation()
              if (Date.now() < suppressApplyUntilRef.current) return
              onApplyToFuture(value)
              setShowFutureHint(false)
              window.setTimeout(() => onCommit?.(), 0)
            }}
          >
            Apply to future
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!canCheck) return
          onToggleDone()
        }}
        disabled={!canCheck}
        title={done ? "Unmark" : "Mark moved"}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
          !canCheck && "pointer-events-none opacity-0",
          canCheck &&
            done &&
            accent &&
            "border-[#E5D4D7] bg-[#F3EBED] text-[#B09096] hover:border-[#D9C4C8] hover:bg-[#EDE3E6] hover:text-[#A08288]",
          canCheck &&
            done &&
            !accent &&
            "border-neutral-200 bg-neutral-100 text-neutral-400 hover:border-neutral-300 hover:bg-neutral-200 hover:text-neutral-500",
          canCheck &&
            !done &&
            "border-transparent text-neutral-300 opacity-0 group-hover/cell:opacity-100 group-hover/cell:border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-600",
        )}
      >
        <Check className="size-3" strokeWidth={2.5} />
      </button>

      <div
        className={cn(
          "flex h-7 min-w-0 flex-1 cursor-text items-center justify-end rounded-md border border-transparent px-1",
          "hover:border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        )}
        onClick={() => {
          startValueRef.current = value
          clearHintTimer()
          setEditing(true)
          setShowFutureHint(false)
        }}
      >
        {editing ? (
          <input
            autoFocus
            className={cn(
              "h-full w-full bg-transparent text-right text-sm tabular-nums outline-none",
              accent && !done && "text-[#3A121C]",
              accent && done && "text-[#7A5C62]",
            )}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              let changed = false
              if (value.trim() === "" || Number(value) === 0) {
                if (value !== "") {
                  onChange("")
                  changed = true
                }
              }
              setEditing(false)
              const next =
                value.trim() === "" || Number(value) === 0 ? "" : value
              if (next !== startValueRef.current) {
                changed = true
                offerApplyToFuture()
              }
              if (changed) {
                // Let React commit the cell patch into workspaceRef first
                window.setTimeout(() => onCommit?.(), 0)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") {
                onChange(startValueRef.current)
                setEditing(false)
                clearHintTimer()
                setShowFutureHint(false)
              }
            }}
            inputMode="numeric"
          />
        ) : hasAmount ? (
          <span
            className={cn(
              "text-sm tabular-nums",
              done && accent && "text-[#7A5C62]",
              done && !accent && "text-[#969696]",
              !done && accent && "text-[#3A121C]",
            )}
          >
            ${value}
          </span>
        ) : null}
      </div>
    </div>
  )
}
