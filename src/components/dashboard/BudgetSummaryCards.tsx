import { useMemo } from "react"
import {
  computeComposition,
  totalSavingsAllocated,
  type CompositionSegment,
} from "@/lib/budget-summary"
import { formatMoney } from "@/lib/format"
import type { Bucket, Paycheck } from "@/types/budget"

type Props = {
  buckets: Bucket[]
  paychecks: Paycheck[]
  activeYear: number
}

export function BudgetSummaryCards({ buckets, paychecks }: Props) {
  const totalSavings = useMemo(
    () => totalSavingsAllocated(buckets, paychecks),
    [buckets, paychecks],
  )

  const { income, segments } = useMemo(
    () => computeComposition(buckets, paychecks),
    [buckets, paychecks],
  )

  return (
    <div className="flex shrink-0 flex-wrap items-stretch gap-3">
      <div className="flex h-auto min-h-full w-fit shrink-0 flex-col justify-center rounded-[8px] border border-neutral-500 bg-white px-[26px] py-2.5">
        <p className="text-[11px] text-muted-foreground">Total savings</p>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatMoney(totalSavings)}
        </p>
      </div>

      <div className="flex h-auto min-h-full w-fit shrink-0 flex-col rounded-[8px] border border-neutral-500 bg-white px-3.5 py-2.5">
        <p className="text-[11px] text-muted-foreground">Income allocation</p>

        <div className="mt-2.5 flex items-center gap-3">
          <CompositionDonut segments={segments} income={income} />
          <ul className="flex min-w-[9.5rem] flex-col gap-1">
            {segments.map((seg) => {
              const pct =
                income > 0 ? Math.round((seg.amount / income) * 100) : 0
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
  income,
}: {
  segments: CompositionSegment[]
  income: number
}) {
  const size = 72
  const stroke = 10
  const gap = 3.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const visible = segments.filter((s) => s.amount > 0)
  const gapTotal = visible.length > 1 ? visible.length * gap : 0
  const usable = Math.max(c - gapTotal, 0)

  let offset = 0
  const arcs =
    income <= 0
      ? null
      : visible.map((seg) => {
          // Arc length as fraction of income (full circle), not renormalized to segment sum
          const len = (seg.amount / income) * usable
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
