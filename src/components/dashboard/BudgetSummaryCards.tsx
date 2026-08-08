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

  const { total, segments } = useMemo(
    () => computeComposition(buckets, paychecks),
    [buckets, paychecks],
  )

  return (
    <div className="flex shrink-0 flex-wrap items-stretch gap-6">
      <div className="flex h-auto min-h-full w-[calc(11.5rem+48px)] min-w-[calc(11.5rem+48px)] shrink-0 flex-col justify-between rounded-[8px] border border-neutral-500 bg-white p-4">
        <p className="mb-4 text-sm text-neutral-600">Total savings</p>
        <p className="mt-auto text-4xl font-light tracking-tight tabular-nums text-foreground">
          {formatMoney(totalSavings)}
        </p>
      </div>

      <div className="flex h-auto min-h-full w-fit shrink-0 flex-col rounded-[8px] border border-neutral-500 bg-white p-4">
        <p className="mb-4 text-sm text-neutral-600">Expenses & savings</p>

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
