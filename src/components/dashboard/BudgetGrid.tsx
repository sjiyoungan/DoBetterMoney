import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Check, Menu, Redo2, Undo2 } from "lucide-react"
import { AddBucketDialog } from "@/components/dashboard/AddBucketDialog"
import { CategoryDrawer } from "@/components/dashboard/CategoryDrawer"
import { OnboardingFlow } from "@/components/dashboard/OnboardingFlow"
import { Button } from "@/components/ui/button"
import { allocationKey, formatPayDate, savingsBalanceLeft } from "@/lib/format"
import type { IncomeSourceInput } from "@/lib/income-schedule"
import { isReorderNoOp } from "@/lib/reorder"
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
    field: "goal" | "amount",
    value: string,
  ) => void
  onAddBucket: (bucket: Bucket) => void
  onUpdateBucket: (bucket: Bucket) => void
  onReorderBuckets: (fromId: string, beforeId: string | null) => void
  onSetupIncome: (sources: IncomeSourceInput[]) => void
  onPaycheckDateChange?: (paycheckId: string, date: string) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  saveStatus?: "idle" | "saving" | "saved" | "error"
}

const W = { bucket: 92, category: 168, goal: 110, balance: 96, pay: 128 } as const
const LEFT_WIDTH = W.bucket + W.category + W.goal + W.balance

const paneBg = "bg-white dark:bg-background"

/** Right edge of column i is a month boundary when the next paycheck is a new month. */
function isMonthBoundaryAfter(
  paychecks: Paycheck[],
  index: number,
): boolean {
  const next = paychecks[index + 1]
  if (!next) return false
  return paychecks[index].date.slice(0, 7) !== next.date.slice(0, 7)
}

function payColumnBorderClass(paychecks: Paycheck[], index: number) {
  if (index >= paychecks.length - 1) return undefined
  return isMonthBoundaryAfter(paychecks, index)
    ? "border-r border-r-neutral-500"
    : "border-r border-r-border/60"
}

/** Group divider: default 2px. Drop target uses an overlay so layout does not jump. */
function groupDividerTopClass(showDivider: boolean) {
  return showDivider ? "border-t-2 border-t-neutral-900" : undefined
}

function groupDividerBottomClass(isLastInBucket: boolean) {
  return !isLastInBucket ? "border-b border-b-border/60" : undefined
}

function DropLine({
  show,
  edge,
}: {
  show: boolean
  edge: "top" | "bottom"
}) {
  if (!show) return null
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 h-1 bg-neutral-900",
        edge === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
      )}
    />
  )
}

type GridRow = {
  key: string
  rowCount: number
  isFirstInBucket: boolean
  isLastInBucket: boolean
  showBucketDivider: boolean
  bucketId: string
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
  onReorderBuckets,
  onSetupIncome,
  onPaycheckDateChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  saveStatus = "idle",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftTableRef = useRef<HTMLTableElement>(null)
  const rightTableRef = useRef<HTMLTableElement>(null)
  const leftHeaderRef = useRef<HTMLTableRowElement>(null)
  const rightHeaderRef = useRef<HTMLTableRowElement>(null)
  const leftRowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const rightRowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const bucketBodyRefs = useRef(new Map<string, HTMLTableSectionElement>())
  const gridFrameRef = useRef<HTMLDivElement>(null)

  const [scrolled, setScrolled] = useState(false)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [bucketDialog, setBucketDialog] = useState<
    { mode: "create" } | { mode: "edit"; bucket: Bucket } | null
  >(null)
  const [selected, setSelected] = useState<{
    category: Category
    bucket: Bucket
  } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null | undefined>(
    undefined,
  )
  const [hoveredBucketId, setHoveredBucketId] = useState<string | null>(null)
  const [gripRects, setGripRects] = useState<
    Record<string, { top: number; height: number }>
  >({})
  const dragMovedRef = useRef(false)

  /** Visible rows only — hidden categories stay in stored data / edit modal. */
  const displayBuckets = useMemo(
    () =>
      buckets
        .map((bucket) => ({
          ...bucket,
          categories: bucket.categories.filter((c) => !c.hidden),
        }))
        .filter((bucket) => bucket.categories.length > 0),
    [buckets],
  )

  const displayBucketIds = useMemo(
    () => displayBuckets.map((b) => b.id),
    [displayBuckets],
  )

  const rows = useMemo(() => {
    const result: GridRow[] = []
    displayBuckets.forEach((bucket, bucketIndex) => {
      bucket.categories.forEach((category, rowIndex) => {
        result.push({
          key: category.id,
          bucketId: bucket.id,
          rowCount: bucket.categories.length,
          isFirstInBucket: rowIndex === 0,
          isLastInBucket: rowIndex === bucket.categories.length - 1,
          showBucketDivider: rowIndex === 0 && bucketIndex > 0,
        })
      })
    })
    return result
  }, [displayBuckets])

  const dropIndicatorActive =
    draggingId !== null &&
    dropBeforeId !== undefined &&
    !isReorderNoOp(displayBucketIds, draggingId, dropBeforeId)

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

  // Keep left/right row heights matched + sync external grip positions
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

      const frame = gridFrameRef.current
      if (!frame) return
      const frameTop = frame.getBoundingClientRect().top
      const next: Record<string, { top: number; height: number }> = {}
      for (const id of displayBucketIds) {
        const body = bucketBodyRefs.current.get(id)
        if (!body) continue
        const r = body.getBoundingClientRect()
        next[id] = { top: r.top - frameTop, height: r.height }
      }
      setGripRects((prev) => {
        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(next)
        if (
          prevKeys.length === nextKeys.length &&
          nextKeys.every(
            (id) =>
              prev[id]?.top === next[id]?.top &&
              prev[id]?.height === next[id]?.height,
          )
        ) {
          return prev
        }
        return next
      })
    }

    sync()
    const ro = new ResizeObserver(sync)
    if (leftTableRef.current) ro.observe(leftTableRef.current)
    if (rightTableRef.current) ro.observe(rightTableRef.current)
    return () => ro.disconnect()
  }, [rows, paychecks, displayBucketIds])

  // Group rearrange: track drop line while pointer is down on the grip
  useEffect(() => {
    if (!draggingId) return

    const resolveDropBefore = (clientY: number) => {
      for (let i = 0; i < displayBucketIds.length; i++) {
        const id = displayBucketIds[i]!
        const body = bucketBodyRefs.current.get(id)
        if (!body) continue
        const rect = body.getBoundingClientRect()
        if (clientY < rect.top) return id
        if (clientY <= rect.bottom) {
          const mid = rect.top + rect.height / 2
          if (clientY < mid) return id
          return displayBucketIds[i + 1] ?? null
        }
      }
      return null
    }

    const onMove = (e: PointerEvent) => {
      dragMovedRef.current = true
      setDropBeforeId(resolveDropBefore(e.clientY))
    }

    const onUp = (e: PointerEvent) => {
      const before = resolveDropBefore(e.clientY)
      const from = draggingId
      setDraggingId(null)
      setDropBeforeId(undefined)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
      if (
        dragMovedRef.current &&
        !isReorderNoOp(displayBucketIds, from, before)
      ) {
        onReorderBuckets(from, before)
      }
    }

    document.body.style.cursor = "grabbing"
    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
  }, [draggingId, displayBucketIds, onReorderBuckets])

  const balanceEdge = scrolled ? "" : "border-r border-r-neutral-900"

  function setLeftRowRef(key: string, el: HTMLTableRowElement | null) {
    if (el) leftRowRefs.current.set(key, el)
    else leftRowRefs.current.delete(key)
  }

  function setRightRowRef(key: string, el: HTMLTableRowElement | null) {
    if (el) rightRowRefs.current.set(key, el)
    else rightRowRefs.current.delete(key)
  }

  function setBucketBodyRef(id: string, el: HTMLTableSectionElement | null) {
    if (el) bucketBodyRefs.current.set(id, el)
    else bucketBodyRefs.current.delete(id)
  }

  function startBucketDrag(
    bucketId: string,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) {
    e.preventDefault()
    e.stopPropagation()
    dragMovedRef.current = false
    setDraggingId(bucketId)
    setDropBeforeId(bucketId)
  }

  function isDropBeforeBucket(bucketId: string) {
    return (
      dropIndicatorActive &&
      dropBeforeId !== undefined &&
      dropBeforeId === bucketId
    )
  }

  function isDropAfterLast(bucketId: string) {
    const lastId = displayBucketIds[displayBucketIds.length - 1]
    return (
      dropIndicatorActive &&
      dropBeforeId === null &&
      bucketId === lastId
    )
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
      <div ref={gridFrameRef} className="relative">
        {/* Rearrange grips sit outside the table so group labels stay clean */}
        <div
          aria-hidden={false}
          className="pointer-events-none absolute top-0 bottom-0 -left-5 z-30 w-5"
        >
          {displayBuckets.map((bucket) => {
            const rect = gripRects[bucket.id]
            if (!rect) return null
            const visible =
              hoveredBucketId === bucket.id || draggingId === bucket.id
            return (
              <button
                key={bucket.id}
                type="button"
                title="Rearrange group"
                aria-label={`Rearrange ${bucket.name}`}
                onPointerDown={(e) => startBucketDrag(bucket.id, e)}
                onMouseEnter={() => setHoveredBucketId(bucket.id)}
                onMouseLeave={() =>
                  setHoveredBucketId((id) => (id === bucket.id ? null : id))
                }
                style={{ top: rect.top, height: rect.height }}
                className={cn(
                  "pointer-events-auto absolute left-0 flex w-full cursor-grab items-center justify-center text-neutral-400 opacity-0 transition-opacity hover:opacity-100 active:cursor-grabbing",
                  visible && "opacity-100",
                )}
              >
                <Menu className="size-3.5" strokeWidth={2} />
              </button>
            )
          })}
        </div>

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
                    Goal/payment
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

              {displayBuckets.map((bucket) => (
                <tbody
                  key={bucket.id}
                  ref={(el) => setBucketBodyRef(bucket.id, el)}
                  data-bucket-id={bucket.id}
                  className={cn(draggingId === bucket.id && "opacity-50")}
                  onMouseEnter={() => setHoveredBucketId(bucket.id)}
                  onMouseLeave={(e) => {
                    // Keep grip visible when moving left into the external rail
                    const frame = gridFrameRef.current
                    if (
                      frame &&
                      e.clientX < frame.getBoundingClientRect().left
                    ) {
                      return
                    }
                    setHoveredBucketId((id) =>
                      id === bucket.id ? null : id,
                    )
                  }}
                >
                  {bucket.categories.map((category) => {
                    const row = rows.find((r) => r.key === category.id)!
                    const isSavings = bucket.kind === "savings"
                    const isExpense = bucket.kind === "spending"
                    const fullBucket =
                      buckets.find((b) => b.id === bucket.id) ?? bucket
                    const dropBefore = isDropBeforeBucket(bucket.id)
                    const dropAfterLast =
                      row.isLastInBucket && isDropAfterLast(bucket.id)
                    const topBorder = groupDividerTopClass(
                      row.showBucketDivider,
                    )
                    const bottomBorder = groupDividerBottomClass(
                      row.isLastInBucket,
                    )
                    const showTopLine = dropBefore && row.isFirstInBucket
                    const showBottomLine = dropAfterLast
                    const balanceLeft = isSavings
                      ? savingsBalanceLeft(
                          category.goal,
                          category.allocations,
                        )
                      : undefined
                    const paymentAmount =
                      category.amount ??
                      category.recurringAmount ??
                      category.minPayment

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
                              topBorder,
                            )}
                          >
                            <DropLine show={showTopLine} edge="top" />
                            <DropLine
                              show={isDropAfterLast(bucket.id)}
                              edge="bottom"
                            />
                            <button
                              type="button"
                              title={`Edit ${bucket.name}`}
                              onClick={() =>
                                setBucketDialog({
                                  mode: "edit",
                                  bucket: fullBucket,
                                })
                              }
                              className="absolute inset-0 flex items-center justify-center px-2 transition-colors hover:bg-neutral-100 hover:text-foreground"
                            >
                              {bucket.name}
                            </button>
                          </td>
                        ) : null}

                        <td
                          className={cn(
                            "relative border-r border-r-border/60 p-0",
                            paneBg,
                            topBorder,
                            bottomBorder,
                          )}
                        >
                          <DropLine show={showTopLine} edge="top" />
                          <DropLine show={showBottomLine} edge="bottom" />
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
                            "relative border-r border-r-border/60 px-1",
                            paneBg,
                            topBorder,
                            bottomBorder,
                          )}
                        >
                          <DropLine show={showTopLine} edge="top" />
                          <DropLine show={showBottomLine} edge="bottom" />
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
                          ) : isExpense ? (
                            <MoneyField
                              value={
                                paymentAmount === undefined
                                  ? ""
                                  : String(paymentAmount)
                              }
                              onChange={(value) =>
                                onCategoryFieldChange(
                                  category.id,
                                  "amount",
                                  value,
                                )
                              }
                            />
                          ) : null}
                        </td>

                        <td
                          className={cn(
                            "relative px-1 text-right tabular-nums text-muted-foreground",
                            paneBg,
                            balanceEdge,
                            topBorder,
                            bottomBorder,
                          )}
                        >
                          <DropLine show={showTopLine} edge="top" />
                          <DropLine show={showBottomLine} edge="bottom" />
                          {isSavings && balanceLeft !== undefined ? (
                            <div className="flex h-9 items-center justify-end px-2">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                ${balanceLeft}
                              </span>
                            </div>
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
                      return (
                        <PayDateHeader
                          key={p.id}
                          paycheck={p}
                          className={cn(
                            "border-b-2 border-b-neutral-900 px-1 py-3 text-center font-medium",
                            payColumnBorderClass(paychecks, i),
                            isUpcoming
                              ? "bg-[#FDF9FA] text-[#3A121C]"
                              : isPast
                                ? "bg-neutral-100 text-[#969696]"
                                : cn(paneBg, "text-muted-foreground"),
                          )}
                          onDateChange={(date) =>
                            onPaycheckDateChange?.(p.id, date)
                          }
                        />
                      )
                    })}
                  </tr>
                </thead>

                {displayBuckets.map((bucket) => (
                  <tbody
                    key={bucket.id}
                    className={cn(draggingId === bucket.id && "opacity-50")}
                  >
                    {bucket.categories.map((category) => {
                      const row = rows.find((r) => r.key === category.id)!
                      const dropBefore = isDropBeforeBucket(bucket.id)
                      const dropAfterLast =
                        row.isLastInBucket && isDropAfterLast(bucket.id)
                      const topBorder = groupDividerTopClass(
                        row.showBucketDivider,
                      )
                      const bottomBorder = groupDividerBottomClass(
                        row.isLastInBucket,
                      )
                      const showTopLine = dropBefore && row.isFirstInBucket
                      const showBottomLine = dropAfterLast

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
                                  "relative px-1",
                                  cellGray
                                    ? "bg-neutral-100 text-[#969696] dark:bg-neutral-900"
                                    : isUpcoming
                                      ? "bg-[#FDF9FA] text-[#3A121C] dark:bg-rose-950/10 dark:text-rose-100"
                                      : "bg-white dark:bg-background",
                                  payColumnBorderClass(paychecks, i),
                                  topBorder,
                                  bottomBorder,
                                )}
                                style={{ width: W.pay, minWidth: W.pay }}
                              >
                                <DropLine show={showTopLine} edge="top" />
                                <DropLine show={showBottomLine} edge="bottom" />
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

      <div className="mt-4 flex items-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => setBucketDialog({ mode: "create" })}
        >
          Add group
        </Button>
        <div className="ml-6 flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            disabled={!canUndo}
            title={
              typeof navigator !== "undefined" &&
              /Mac|iPhone|iPad/.test(navigator.platform)
                ? "Undo (⌘Z)"
                : "Undo (Ctrl+Z)"
            }
            onClick={() => onUndo?.()}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            disabled={!canRedo}
            title={
              typeof navigator !== "undefined" &&
              /Mac|iPhone|iPad/.test(navigator.platform)
                ? "Redo (⌘Shift+Z)"
                : "Redo (Ctrl+Shift+Z)"
            }
            onClick={() => onRedo?.()}
          >
            <Redo2 className="size-4" />
          </Button>
          {saveStatus === "saving" ? (
            <span className="ml-1 text-xs text-muted-foreground">Saving…</span>
          ) : saveStatus === "saved" ? (
            <span className="ml-1 text-xs text-muted-foreground">Saved</span>
          ) : saveStatus === "error" ? (
            <span className="ml-1 text-xs text-destructive">Save failed</span>
          ) : null}
        </div>
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

function PayDateHeader({
  paycheck,
  className,
  onDateChange,
}: {
  paycheck: Paycheck
  className?: string
  onDateChange: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLTableCellElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const year = paycheck.date.slice(0, 4)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    try {
      input.showPicker?.()
    } catch {
      // Older browsers: visible date field is enough
    }
  }, [open])

  return (
    <th
      ref={wrapRef}
      className={cn("relative", className)}
      style={{ width: W.pay, minWidth: W.pay }}
    >
      <button
        type="button"
        className="w-full rounded-sm px-0.5 py-0.5 transition-colors hover:bg-black/5"
        title="Change paycheck date"
        onClick={() => setOpen((v) => !v)}
      >
        {formatPayDate(paycheck.date)}
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-md border border-neutral-400 bg-white p-2 shadow-md dark:border-neutral-600 dark:bg-neutral-900">
          <input
            ref={inputRef}
            type="date"
            value={paycheck.date}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            className="rounded border border-neutral-300 bg-white px-1.5 py-1 text-sm text-foreground outline-none dark:border-neutral-600 dark:bg-neutral-950"
            onChange={(e) => {
              const next = e.target.value
              if (!next || next === paycheck.date) return
              onDateChange(next)
              setOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false)
            }}
          />
        </div>
      ) : null}
    </th>
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
