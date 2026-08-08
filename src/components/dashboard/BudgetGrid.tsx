import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Check, CirclePlus, Menu, MessageSquare } from "lucide-react"
import { AddBucketDialog } from "@/components/dashboard/AddBucketDialog"
import { CategoryDrawer } from "@/components/dashboard/CategoryDrawer"
import { OnboardingFlow } from "@/components/dashboard/OnboardingFlow"
import {
  allocationKey,
  formatMoney,
  formatPayDate,
  savingsBalanceLeft,
} from "@/lib/format"
import type { IncomeSourceInput } from "@/lib/income-schedule"
import { isReorderNoOp } from "@/lib/reorder"
import {
  computeBudgetCalcForDate,
  computeTotalForDate,
  hasBudgetCalcInputsForDate,
  hasTotalInputsForDate,
} from "@/lib/totals"
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
  onCommentChange: (categoryId: string, date: string, comment: string) => void
  onCommentCommit?: () => void
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
}

const W = { bucket: 118, category: 168, goal: 110, balance: 96, pay: 130 } as const
const LEFT_WIDTH = W.bucket + W.category + W.goal + W.balance

/** Solid pane fill — header/body/footer must fully cover scrolling rows */
const paneBg = "bg-white dark:bg-neutral-950"
/** Totals footer rows — light grey so they read as summary, not editable cells */
const totalsBg = "bg-neutral-100 dark:bg-neutral-900"
/** Top edge of Totals footer — black so it reads clearly on the grey fill */
const totalsDividerTop = "border-t-2 border-t-black"
/** Upcoming paycheck column tint — opaque so panes never show rows through */
const upcomingFill =
  "bg-[#FDF9FA] text-[#3A121C] dark:bg-rose-950 dark:text-rose-100"
const upcomingStrokeSide = "border-l-2 border-l-[#C9A8AE] border-r-2 border-r-[#C9A8AE]"
/** Soft feather under header / above Totals when body can scroll under them */
const stickyEdgeShadowUp = "0 -10px 24px rgba(0, 0, 0, 0.18)"
const stickyEdgeShadowDown = "0 10px 24px rgba(0, 0, 0, 0.18)"
/** Card outer stroke — owned by header / body / footer panes */
const cardStroke = "border-neutral-500"

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

/** Totals footer section top (body → footer) and between footer groups on grey fill. */
function totalsDividerTopClass(showDivider: boolean) {
  return showDivider ? totalsDividerTop : undefined
}

function groupDividerBottomClass(isLastInBucket: boolean) {
  return !isLastInBucket ? "border-b border-b-border/60" : undefined
}

/** Upcoming paycheck column fill + matching L/R (and optional top/bottom) pink stroke. */
function upcomingColumnClass(opts: {
  active: boolean
  top?: boolean
  bottom?: boolean
}) {
  if (!opts.active) return undefined
  return cn(
    upcomingFill,
    upcomingStrokeSide,
    opts.top && "border-t-2 border-t-[#C9A8AE]",
    opts.bottom && "border-b-2 border-b-[#C9A8AE]",
  )
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
 * Vertical scroll lives only in the body pane (header + Totals stay fixed in
 * the card), so rows cannot paint above the Group header. The card fills the
 * remaining viewport under AppHeader. Right header/footer sync via translateX
 * with the paycheck scroller. Left pane owns the H-scroll shadow.
 */
export function BudgetGrid({
  buckets,
  paychecks,
  doneKeys,
  onToggleDone,
  onAmountChange,
  onAmountApplyToFuture,
  onAmountCommit,
  onCommentChange,
  onCommentCommit,
  onCategoryFieldChange,
  onAddBucket,
  onUpdateBucket,
  onReorderBuckets,
  onSetupIncome,
  onPaycheckDateChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const headerScrollSurfaceRef = useRef<HTMLDivElement>(null)
  const footerScrollSurfaceRef = useRef<HTMLDivElement>(null)
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
  const [bodyScrolledPastTop, setBodyScrolledPastTop] = useState(false)
  const [bodyCanScrollUnderFooter, setBodyCanScrollUnderFooter] =
    useState(false)
  const [gripClip, setGripClip] = useState({ top: 0, height: 0 })
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
  const [gripRects, setGripRects] = useState<
    Record<string, { top: number; height: number }>
  >({})
  const dragMovedRef = useRef(false)

  /** Visible body rows — hidden categories stay in data; footer kinds render below. */
  const displayBuckets = useMemo(
    () =>
      buckets
        .filter(
          (bucket) =>
            bucket.kind !== "totals" && bucket.kind !== "budget_calc",
        )
        .map((bucket) => ({
          ...bucket,
          categories: bucket.categories.filter((c) => !c.hidden),
        }))
        .filter((bucket) => bucket.categories.length > 0),
    [buckets],
  )

  /** Fixed footer: Budget calculation first (zero check), then Totals. */
  const totalsBuckets = useMemo(() => {
    const visibleOf = (kind: "budget_calc" | "totals") =>
      buckets
        .filter((bucket) => bucket.kind === kind)
        .map((bucket) => ({
          ...bucket,
          categories: bucket.categories.filter((c) => !c.hidden),
        }))
        .filter((bucket) => bucket.categories.length > 0)
    return [...visibleOf("budget_calc"), ...visibleOf("totals")]
  }, [buckets])

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

  const totalsRows = useMemo(() => {
    const result: GridRow[] = []
    totalsBuckets.forEach((bucket, bucketIndex) => {
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
  }, [totalsBuckets])

  const hasTotalsFooter = totalsRows.length > 0

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

  // Track horizontal scroll + map vertical wheel to horizontal in right panes
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
    const headerSurface = headerScrollSurfaceRef.current
    const footerSurface = footerScrollSurfaceRef.current
    headerSurface?.addEventListener("wheel", onWheel, { passive: false })
    footerSurface?.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("wheel", onWheel)
      headerSurface?.removeEventListener("wheel", onWheel)
      footerSurface?.removeEventListener("wheel", onWheel)
    }
  }, [hasTotalsFooter])

  // Soft edge shadows when body content can scroll under header / Totals
  useEffect(() => {
    const el = bodyScrollRef.current
    if (!el) return
    const update = () => {
      const pastTop = el.scrollTop > 1
      const canScroll = el.scrollHeight > el.clientHeight + 1
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      setBodyScrolledPastTop(pastTop)
      setBodyCanScrollUnderFooter(canScroll && !atBottom)
    }
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [hasTotalsFooter, rows, totalsRows])

  // Keep rearrange grips clipped to the body viewport (outside overflow scroller)
  useEffect(() => {
    const frame = gridFrameRef.current
    const body = bodyScrollRef.current
    if (!frame || !body) return
    const updateClip = () => {
      const frameTop = frame.getBoundingClientRect().top
      const bodyRect = body.getBoundingClientRect()
      setGripClip({
        top: bodyRect.top - frameTop,
        height: body.clientHeight,
      })
    }
    updateClip()
    const ro = new ResizeObserver(updateClip)
    ro.observe(frame)
    ro.observe(body)
    body.addEventListener("scroll", updateClip, { passive: true })
    return () => {
      ro.disconnect()
      body.removeEventListener("scroll", updateClip)
    }
  }, [hasTotalsFooter, rows, totalsRows])

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
        ...totalsRows.map(
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
    const bodyScroll = bodyScrollRef.current
    bodyScroll?.addEventListener("scroll", sync, { passive: true })
    return () => {
      ro.disconnect()
      bodyScroll?.removeEventListener("scroll", sync)
    }
  }, [rows, totalsRows, paychecks, displayBucketIds])

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

  // Always reserve 2px so the Balance column width does not jump on scroll
  const balanceEdge = scrolled
    ? "border-r-2 border-r-transparent"
    : "border-r-2 border-r-neutral-900"

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

  const bodyBuckets = buckets.filter(
    (b) => b.kind !== "totals" && b.kind !== "budget_calc",
  )
  if (
    bodyBuckets.length > 0 &&
    bodyBuckets.every((b) => b.kind === "income")
  ) {
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={gridFrameRef} className="relative flex min-h-0 flex-1 flex-col">
        {/* Rearrange grips: clipped to body viewport so they never cover header */}
        <div
          aria-hidden={false}
          className="pointer-events-none absolute -left-5 z-30 w-5 overflow-hidden"
          style={{ top: gripClip.top, height: gripClip.height }}
        >
          {displayBuckets.map((bucket) => {
            const rect = gripRects[bucket.id]
            if (!rect) return null
            return (
              <button
                key={bucket.id}
                type="button"
                title="Rearrange group"
                aria-label={`Rearrange ${bucket.name}`}
                onPointerDown={(e) => startBucketDrag(bucket.id, e)}
                style={{
                  top: rect.top - gripClip.top,
                  height: rect.height,
                }}
                className={cn(
                  "pointer-events-auto absolute left-0 flex w-full cursor-grab items-center justify-center text-neutral-400 opacity-0 transition-opacity hover:opacity-100 active:cursor-grabbing",
                  draggingId === bucket.id && "opacity-100",
                )}
              >
                <Menu className="size-3.5" strokeWidth={2} />
              </button>
            )
          })}
        </div>

        {/*
          Flex column card: header + Totals stay outside the body scroller so
          rows clip under them. Right panes sync via translateX.
        */}
        <div className="flex min-h-0 flex-1 flex-col rounded-[8px]">
          {/* Fixed header — not inside the vertical scroller */}
          <div
            className={cn(
              "relative z-40 flex shrink-0 overflow-hidden rounded-t-[8px] border border-b-0",
              cardStroke,
              paneBg,
            )}
            style={{
              boxShadow: bodyScrolledPastTop ? stickyEdgeShadowDown : "none",
            }}
          >
            <div
              className={cn("relative z-10 shrink-0", paneBg)}
              style={{
                width: LEFT_WIDTH,
                minWidth: LEFT_WIDTH,
                maxWidth: LEFT_WIDTH,
                boxShadow: scrolled
                  ? "6px 0 10px rgba(0, 0, 0, 0.16)"
                  : "none",
              }}
            >
              <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                <colgroup>
                  <col style={{ width: W.bucket, minWidth: W.bucket }} />
                  <col style={{ width: W.category, minWidth: W.category }} />
                  <col style={{ width: W.goal, minWidth: W.goal }} />
                  <col style={{ width: W.balance, minWidth: W.balance }} />
                </colgroup>
                <thead>
                  <tr ref={leftHeaderRef}>
                    <th
                      className={cn(
                        "border-b-2 border-b-neutral-900 border-r border-r-neutral-900 px-2 py-3 text-center font-medium",
                        paneBg,
                      )}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>Group</span>
                        <button
                          type="button"
                          title="Add group"
                          aria-label="Add group"
                          onClick={() => setBucketDialog({ mode: "create" })}
                          className="-mr-1 inline-flex size-8 shrink-0 items-center justify-start text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <CirclePlus className="size-5" strokeWidth={1.75} />
                        </button>
                      </div>
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
              </table>
            </div>
            <div
              ref={headerScrollSurfaceRef}
              className={cn("min-w-0 flex-1 overflow-hidden", paneBg)}
            >
              <div
                className={cn("w-max min-w-full", paneBg)}
                style={{ transform: `translateX(-${scrollLeft}px)` }}
              >
                <table className="border-separate border-spacing-0 text-sm">
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
                              isUpcoming
                                ? upcomingColumnClass({
                                    active: true,
                                    top: true,
                                  })
                                : cn(
                                    payColumnBorderClass(paychecks, i),
                                    isPast
                                      ? "bg-neutral-100 text-[#969696] dark:bg-neutral-900"
                                      : cn(paneBg, "text-muted-foreground"),
                                  ),
                            )}
                            onDateChange={(date) =>
                              onPaycheckDateChange?.(p.id, date)
                            }
                          />
                        )
                      })}
                    </tr>
                  </thead>
                </table>
              </div>
            </div>
          </div>

          {/* Body-only vertical scroll — content clips under header / Totals */}
          <div
            ref={bodyScrollRef}
            className={cn(
              "relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto border-x",
              cardStroke,
              !hasTotalsFooter && "rounded-b-[8px] border-b",
            )}
          >
          <div className="relative flex">
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
              className="w-full table-fixed border-separate border-spacing-0 text-sm"
            >
              <colgroup>
                <col style={{ width: W.bucket, minWidth: W.bucket }} />
                <col style={{ width: W.category, minWidth: W.category }} />
                <col style={{ width: W.goal, minWidth: W.goal }} />
                <col style={{ width: W.balance, minWidth: W.balance }} />
              </colgroup>

              {displayBuckets.map((bucket) => (
                <tbody
                  key={bucket.id}
                  ref={(el) => setBucketBodyRef(bucket.id, el)}
                  data-bucket-id={bucket.id}
                  className={cn(draggingId === bucket.id && "opacity-50")}
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
                                      ? upcomingColumnClass({ active: true })
                                      : paneBg,
                                  !isUpcoming &&
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
                                  comment={
                                    category.comments?.[p.date]?.trim() ?? ""
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
                                  onCommentChange={(next) =>
                                    onCommentChange(category.id, p.date, next)
                                  }
                                  onCommentCommit={() => onCommentCommit?.()}
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

          {hasTotalsFooter ? (
              /* Fixed Totals footer — outside body scroller; opaque so rows clip under it */
              <div
                className={cn(
                  "relative z-30 shrink-0 rounded-b-[8px] border border-t-0",
                  cardStroke,
                  totalsBg,
                )}
                style={{
                  boxShadow: bodyCanScrollUnderFooter
                    ? stickyEdgeShadowUp
                    : "none",
                }}
              >
                {/* Inner: clip grey fill to rounded bottom corners */}
                <div
                  className={cn(
                    "flex overflow-hidden rounded-b-[8px]",
                    totalsBg,
                  )}
                >
                {/* Left totals labels — same LEFT_WIDTH / col widths as body */}
                <div
                  className={cn(
                    "relative z-10 shrink-0 overflow-hidden rounded-bl-[8px]",
                    totalsBg,
                  )}
                  style={{
                    width: LEFT_WIDTH,
                    minWidth: LEFT_WIDTH,
                    maxWidth: LEFT_WIDTH,
                    boxShadow: scrolled
                      ? "6px 0 10px rgba(0, 0, 0, 0.16)"
                      : "none",
                  }}
                >
                  <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                    <colgroup>
                      <col style={{ width: W.bucket, minWidth: W.bucket }} />
                      <col
                        style={{ width: W.category, minWidth: W.category }}
                      />
                      <col style={{ width: W.goal, minWidth: W.goal }} />
                      <col
                        style={{ width: W.balance, minWidth: W.balance }}
                      />
                    </colgroup>
                    {totalsBuckets.map((bucket, bucketIndex) => {
                      const fullBucket =
                        buckets.find((b) => b.id === bucket.id) ?? bucket
                      return (
                        <tbody key={bucket.id}>
                          {bucket.categories.map((category) => {
                            const row = totalsRows.find(
                              (r) => r.key === category.id,
                            )!
                            const topBorder = totalsDividerTopClass(
                              row.showBucketDivider ||
                                (row.isFirstInBucket && bucketIndex === 0),
                            )
                            // Same thin row stroke as body categories; omit on
                            // last-in-group (next group top / card edge handles it).
                            const bottomBorder = groupDividerBottomClass(
                              row.isLastInBucket,
                            )
                            return (
                              <tr
                                key={category.id}
                                ref={(el) => setLeftRowRef(category.id, el)}
                              >
                                {row.isFirstInBucket ? (
                                  <td
                                    rowSpan={row.rowCount}
                                    className={cn(
                                      "relative overflow-hidden border-r border-r-neutral-900 p-0 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                                      totalsBg,
                                      topBorder,
                                    )}
                                    style={{
                                      width: W.bucket,
                                      maxWidth: W.bucket,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      title={`Edit ${bucket.name}`}
                                      onClick={() =>
                                        setBucketDialog({
                                          mode: "edit",
                                          bucket: fullBucket,
                                        })
                                      }
                                      className="absolute inset-0 flex items-center justify-center px-1 transition-colors hover:bg-neutral-200 hover:text-foreground"
                                    >
                                      <span className="line-clamp-3 break-words">
                                        {bucket.name}
                                      </span>
                                    </button>
                                  </td>
                                ) : null}
                                <td
                                  className={cn(
                                    "relative border-r border-r-border/60 p-0",
                                    totalsBg,
                                    topBorder,
                                    bottomBorder,
                                  )}
                                >
                                  <button
                                    type="button"
                                    title={`Edit ${bucket.name}`}
                                    onClick={() =>
                                      setBucketDialog({
                                        mode: "edit",
                                        bucket: fullBucket,
                                      })
                                    }
                                    className="flex h-9 w-full items-center px-3 text-left text-sm text-foreground transition-colors hover:bg-neutral-200"
                                  >
                                    {category.name}
                                  </button>
                                </td>
                                <td
                                  className={cn(
                                    "relative border-r border-r-border/60",
                                    totalsBg,
                                    topBorder,
                                    bottomBorder,
                                  )}
                                />
                                <td
                                  className={cn(
                                    "relative",
                                    totalsBg,
                                    balanceEdge,
                                    topBorder,
                                    bottomBorder,
                                  )}
                                />
                              </tr>
                            )
                          })}
                        </tbody>
                      )
                    })}
                  </table>
                </div>

                {/* Right totals values — translate to match paycheck scroll */}
                <div
                  ref={footerScrollSurfaceRef}
                  className={cn(
                    "min-w-0 flex-1 overflow-hidden rounded-br-[8px]",
                    totalsBg,
                  )}
                >
                  <div
                    className={cn("w-max min-w-full", totalsBg)}
                    style={{ transform: `translateX(-${scrollLeft}px)` }}
                  >
                    <table className="border-separate border-spacing-0 text-sm">
                      <colgroup>
                        {paychecks.map((p) => (
                          <col key={p.id} style={{ width: W.pay }} />
                        ))}
                      </colgroup>
                      {totalsBuckets.map((bucket, bucketIndex) => (
                        <tbody key={bucket.id}>
                          {bucket.categories.map((category) => {
                            const row = totalsRows.find(
                              (r) => r.key === category.id,
                            )!
                            const topBorder = totalsDividerTopClass(
                              row.showBucketDivider ||
                                (row.isFirstInBucket && bucketIndex === 0),
                            )
                            const bottomBorder = groupDividerBottomClass(
                              row.isLastInBucket,
                            )
                            const isLastFooterRow =
                              bucketIndex === totalsBuckets.length - 1 &&
                              row.isLastInBucket
                            return (
                              <tr
                                key={category.id}
                                ref={(el) => setRightRowRef(category.id, el)}
                              >
                                {paychecks.map((p, i) => {
                                  const isBudgetCalc =
                                    bucket.kind === "budget_calc"
                                  const value = isBudgetCalc
                                    ? computeBudgetCalcForDate(
                                        buckets,
                                        p.date,
                                      )
                                    : computeTotalForDate(
                                        buckets,
                                        category.totalSources,
                                        p.date,
                                      )
                                  const hasInput = isBudgetCalc
                                    ? hasBudgetCalcInputsForDate(
                                        buckets,
                                        p.date,
                                      )
                                    : hasTotalInputsForDate(
                                        buckets,
                                        category.totalSources,
                                        p.date,
                                      )
                                  const isUpcoming =
                                    p.id === currentPaycheckId
                                  const isPast =
                                    p.completed ||
                                    (upcomingIndex >= 0 && i < upcomingIndex)
                                  const upcomingActive =
                                    isUpcoming && !isPast
                                  return (
                                    <td
                                      key={p.id}
                                      className={cn(
                                        "relative px-1",
                                        upcomingActive
                                          ? upcomingColumnClass({
                                              active: true,
                                              bottom: isLastFooterRow,
                                            })
                                          : cn(
                                              totalsBg,
                                              "text-muted-foreground",
                                              payColumnBorderClass(
                                                paychecks,
                                                i,
                                              ),
                                            ),
                                        topBorder,
                                        bottomBorder,
                                      )}
                                      style={{
                                        width: W.pay,
                                        minWidth: W.pay,
                                      }}
                                    >
                                      <div className="flex h-9 items-center justify-end px-2">
                                        <span className="text-sm tabular-nums">
                                          {hasInput
                                            ? formatMoney(value)
                                            : ""}
                                        </span>
                                      </div>
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
        allBuckets={buckets}
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
  comment,
  done,
  accent = false,
  showCheck,
  onChange,
  onApplyToFuture,
  onCommit,
  onToggleDone,
  onCommentChange,
  onCommentCommit,
}: {
  value: string
  comment: string
  done: boolean
  accent?: boolean
  showCheck: boolean
  onChange: (value: string) => void
  onApplyToFuture: (value: string) => void
  onCommit?: () => void
  onToggleDone: () => void
  onCommentChange: (comment: string) => void
  onCommentCommit?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [showFutureHint, setShowFutureHint] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [draftComment, setDraftComment] = useState(comment)
  const startValueRef = useRef(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const commentBtnRef = useRef<HTMLButtonElement>(null)
  const commentBoxRef = useRef<HTMLDivElement>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressApplyUntilRef = useRef(0)
  const hasAmount = value !== "" && Number(value) !== 0
  const canCheck = hasAmount && (showCheck || done)
  const hasComment = comment !== ""

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

  useEffect(() => {
    if (!commentOpen) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (
        commentBoxRef.current?.contains(target) ||
        commentBtnRef.current?.contains(target)
      ) {
        return
      }
      setCommentOpen(false)
      setDraftComment(comment)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        setCommentOpen(false)
        setDraftComment(comment)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [commentOpen, comment])

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

  function openComment(e: ReactMouseEvent) {
    e.stopPropagation()
    setDraftComment(comment)
    setCommentOpen(true)
    setShowFutureHint(false)
    clearHintTimer()
  }

  function cancelComment() {
    setCommentOpen(false)
    setDraftComment(comment)
  }

  function saveComment() {
    const next = draftComment.trim()
    if (next !== comment) {
      onCommentChange(next)
      window.setTimeout(() => onCommentCommit?.(), 0)
    }
    setCommentOpen(false)
  }

  return (
    <div ref={rootRef} className="group/cell relative flex h-9 items-center gap-0.5 pl-1 pr-1.5">
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

      <button
        ref={commentBtnRef}
        type="button"
        onClick={openComment}
        title={hasComment ? "Edit comment" : "Add comment"}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
          commentOpen
            ? "border-neutral-300 bg-neutral-50 text-neutral-600"
            : "border-transparent text-neutral-300 opacity-0 group-hover/cell:opacity-100 group-hover/cell:border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-600",
        )}
      >
        <MessageSquare className="size-3" strokeWidth={2.5} />
      </button>

      {commentOpen ? (
        <div
          ref={commentBoxRef}
          className="absolute left-5 top-full z-40 mt-0.5 w-[168px] rounded-md border border-neutral-400 bg-white p-2 shadow-md dark:border-neutral-500 dark:bg-neutral-900"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            rows={3}
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value)}
            placeholder="Add a note…"
            className="w-full resize-none rounded border border-neutral-200 bg-transparent px-1.5 py-1 text-xs leading-snug outline-none focus:border-neutral-400 dark:border-neutral-700"
          />
          <div className="mt-1.5 flex justify-end gap-1">
            <button
              type="button"
              onClick={cancelComment}
              className="rounded px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveComment}
              className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "relative ml-auto flex h-7 w-[3.75rem] shrink-0 cursor-text items-center justify-end rounded-md border border-transparent px-0.5",
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
        {hasComment ? (
          <span
            aria-hidden
            title="Has comment"
            className="pointer-events-none absolute top-1/2 right-0 flex -translate-y-1/2 translate-x-full pr-0.5"
          >
            <span className="ml-0.5 size-1.5 shrink-0 rounded-full bg-neutral-500 dark:bg-neutral-400" />
          </span>
        ) : null}
      </div>
    </div>
  )
}
