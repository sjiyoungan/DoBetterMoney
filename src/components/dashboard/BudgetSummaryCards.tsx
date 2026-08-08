import { useMemo, useState } from "react"
import {
  computeComposition,
  totalSavingsAllocated,
  type CompositionPeriod,
  type CompositionSegment,
} from "@/lib/budget-summary"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Bucket, Paycheck } from "@/types/budget"

type Props = {
  buckets: Bucket[]
  paychecks: Paycheck[]
  activeYear: number
}

export function BudgetSummaryCards({
  buckets,
  paychecks,
  activeYear,
}: Props) {
  const [period, setPeriod] = useState<CompositionPeriod>("year")

  const totalSavings = useMemo(
    () => totalSavingsAllocated(buckets, paychecks),
    [buckets, paychecks],
  )

  const segments = useMemo(
    () => computeComposition(buckets, paychecks, period, activeYear),
    [buckets, paychecks, period, activeYear],
  )

  const total = segments.reduce((s, x) => s + x.amount, 0)

  return (
    <div className="flex shrink-0 flex-wrap items-start gap-3">
      <div className="w-fit shrink-0 rounded-[8px] border border-neutral-500 bg-white px-3.5 py-2.5">
        <p className="text-[11px] text-muted-foreground">Total savings</p>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatMoney(totalSavings)}
        </p>
      </div>

      <div className="w-fit shrink-0 rounded-[8px] border border-neutral-500 bg-white px-3.5 py-2.5">
        <div className="inline-flex rounded-[9px] border border-neutral-200 bg-white p-0.5">
          {(
            [
              ["year", "This year"],
              ["month", "This month"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] transition-colors",
                period === value
                  ? "border border-neutral-200 bg-white font-medium text-foreground shadow-sm"
                  : "border border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-4">
          <CompositionDonut segments={segments} />
          <ul className="flex min-w-[9.5rem] flex-col gap-1">
            {segments.map((seg) => {
              const pct =
                total > 0 ? ((seg.amount / total) * 100).toFixed(1) : "0.0"
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
                  <span className="min-w-0 truncate text-muted-foreground">
                    {seg.label}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums text-foreground">
                    {pct}%
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
}: {
  segments: CompositionSegment[]
}) {
  const size = 72
  const stroke = 10
  const gap = 3.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.amount, 0)
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
      {total <= 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E8E8E8"
          strokeWidth={stroke}
        />
      ) : null}
      {arcs}
    </svg>
  )
}
