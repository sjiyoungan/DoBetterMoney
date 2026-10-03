import { useMemo, useState } from "react"
import { BanknoteArrowDown } from "lucide-react"
import {
  computeComposition,
  savingsAllocatedByBucket,
  totalSavingsAllocated,
  type CompositionPeriod,
  type CompositionSegment,
} from "@/lib/budget-summary"
import { formatMoney } from "@/lib/format"
import { blushHoverClass, cn } from "@/lib/utils"
import type { Bucket, Paycheck, Withdrawal } from "@/types/budget"
import { CaretDownIcon } from "@/components/ui/caret-down"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SavingsDetailDrawer } from "./SavingsDetailDrawer"
import { WithdrawDialog } from "./WithdrawDialog"

const PERIOD_OPTIONS: { value: CompositionPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
]

type Props = {
  buckets: Bucket[]
  paychecks: Paycheck[]
  activeYear: number
  doneKeys: Set<string>
  withdrawals?: Withdrawal[]
  onWithdraw: (input: { categoryId: string; amount: number }) => void
}

export function BudgetSummaryCards({
  buckets,
  paychecks,
  activeYear,
  doneKeys,
  withdrawals = [],
  onWithdraw,
}: Props) {
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [period, setPeriod] = useState<CompositionPeriod>("year")

  const totalSavings = useMemo(
    () => totalSavingsAllocated(buckets, paychecks, doneKeys, withdrawals),
    [buckets, paychecks, doneKeys, withdrawals],
  )

  const savingsByBucket = useMemo(
    () => savingsAllocatedByBucket(buckets, paychecks, doneKeys, withdrawals),
    [buckets, paychecks, doneKeys, withdrawals],
  )

  const withdrawOptions = useMemo(
    () =>
      savingsByBucket.flatMap((bucket) =>
        bucket.categories
          .filter((cat) => cat.amount > 0)
          .map((cat) => ({
            id: cat.categoryId,
            name: cat.categoryName,
            amount: cat.amount,
          })),
      ),
    [savingsByBucket],
  )

  const { total, segments } = useMemo(
    () =>
      computeComposition(buckets, paychecks, period, activeYear, doneKeys),
    [buckets, paychecks, period, activeYear, doneKeys],
  )

  const periodLabel =
    PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "This year"

  return (
    <div className="flex shrink-0 flex-wrap items-stretch gap-4">
      <div className="relative flex h-auto min-h-full w-[calc(11.5rem+48px)] min-w-[calc(11.5rem+48px)] shrink-0 flex-col justify-between rounded-[8px] border border-neutral-500 bg-white p-4 text-left">
        <div className="mb-6 flex items-start justify-between gap-2">
          <button
            type="button"
            aria-label="View total savings by group"
            onClick={() => setSavingsOpen(true)}
            className={cn(
              "-m-1 rounded-md p-1 text-left transition-[background] duration-150",
              blushHoverClass,
            )}
          >
            <p className="text-sm text-neutral-600">Total savings</p>
          </button>
          <button
            type="button"
            title="Withdraw"
            aria-label="Withdraw from savings"
            disabled={withdrawOptions.length === 0}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => setWithdrawOpen(true)}
          >
            <BanknoteArrowDown className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <button
          type="button"
          aria-label="View total savings by group"
          onClick={() => setSavingsOpen(true)}
          className={cn(
            "-m-1 mt-auto rounded-md p-1 text-left transition-[background] duration-150",
            blushHoverClass,
          )}
        >
          <p className="text-4xl font-light tracking-tight tabular-nums text-foreground">
            {formatMoney(totalSavings)}
          </p>
        </button>
      </div>

      <SavingsDetailDrawer
        open={savingsOpen}
        onOpenChange={setSavingsOpen}
        rows={savingsByBucket}
        total={totalSavings}
      />

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        options={withdrawOptions}
        onWithdraw={onWithdraw}
      />

      <div className="relative flex h-auto min-h-full w-fit shrink-0 flex-col rounded-[8px] border border-neutral-500 bg-white p-4">
        <div className="mb-6 flex items-start justify-between gap-4">
          <p className="text-sm text-neutral-600">Expenses & savings</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-800"
              >
                {periodLabel}
                <CaretDownIcon className="size-2 text-current" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              {PERIOD_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => setPeriod(opt.value)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex w-fit items-center gap-3">
          <CompositionDonut segments={segments} total={total} />
          <ul className="flex min-w-[9.5rem] flex-col gap-3">
            {segments.map((seg) => {
              const pct =
                total > 0 ? Math.round((seg.amount / total) * 100) : 0
              return (
                <li
                  key={seg.key}
                  className="flex items-center gap-2 text-[11px] leading-tight"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="min-w-0 truncate text-neutral-600">
                      {seg.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="min-w-[4.5rem] text-right tabular-nums text-foreground">
                        {formatMoney(seg.amount)}
                      </span>
                      <span className="w-8 text-right tabular-nums text-foreground">
                        {pct}%
                      </span>
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

function CompositionDonut({
  segments,
  total,
}: {
  segments: CompositionSegment[]
  total: number
}) {
  const size = 72
  const stroke = 7
  const gap = 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const visible = segments.filter((s) => s.amount > 0)
  const gapTotal = visible.length > 1 ? visible.length * gap : 0
  const usable = Math.max(c - gapTotal, 0)

  let offset = 0
  const arcs =
    total <= 0
      ? null
      : visible.map((seg) => {
          const len = (seg.amount / total) * usable
          const dash = `${Math.max(len, 0)} ${c - Math.max(len, 0)}`
          const el = (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          )
          offset += len + (visible.length > 1 ? gap : 0)
          return el
        })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#E8E8E8"
        strokeWidth={stroke}
      />
      {arcs}
    </svg>
  )
}
