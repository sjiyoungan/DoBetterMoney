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
  const [period, setPeriod] = useState<CompositionPeriod>("month")

  const totalSavings = useMemo(
    () => totalSavingsAllocated(buckets, paychecks),
    [buckets, paychecks],
  )

  const segments = useMemo(
    () => computeComposition(buckets, paychecks, period, activeYear),
    [buckets, paychecks, period, activeYear],
  )

  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="flex min-w-[10.5rem] flex-col justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 sm:w-[11.5rem]">
        <p className="text-xs text-muted-foreground">Total savings</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatMoney(totalSavings)}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">
        <div className="flex items-center gap-1">
          {(
            [
              ["month", "This month"],
              ["year", "This year"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                period === value
                  ? "bg-neutral-100 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex min-h-0 items-center gap-5">
          <CompositionDonut segments={segments} />
          <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {segments.map((seg) => {
              const total = segments.reduce((s, x) => s + x.amount, 0)
              const pct =
                total > 0 ? Math.round((seg.amount / total) * 100) : 0
              return (
                <li
                  key={seg.key}
                  className="flex min-w-0 items-baseline gap-2 text-xs"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="min-w-0 truncate text-muted-foreground">
                    {seg.label}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums text-foreground">
                    {formatMoney(seg.amount)}
                    <span className="ml-1.5 text-muted-foreground">
                      {pct}%
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
}: {
  segments: CompositionSegment[]
}) {
  const size = 88
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.amount, 0)

  let offset = 0
  const arcs =
    total <= 0
      ? null
      : segments
          .filter((s) => s.amount > 0)
          .map((seg) => {
            const len = (seg.amount / total) * c
            const dash = `${len} ${c - len}`
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
            offset += len
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
