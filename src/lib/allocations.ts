import type { PayFrequency, Paycheck } from "@/types/budget"

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function medianGapDays(sortedDates: string[]) {
  if (sortedDates.length < 2) return 14
  const gaps: number[] = []
  for (let i = 1; i < sortedDates.length; i++) {
    const a = parseIsoDate(sortedDates[i - 1]).getTime()
    const b = parseIsoDate(sortedDates[i]).getTime()
    gaps.push(Math.round((b - a) / (1000 * 60 * 60 * 24)))
  }
  gaps.sort((x, y) => x - y)
  return gaps[Math.floor(gaps.length / 2)] ?? 14
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

/**
 * Prefill paycheck allocation cells from category frequency + amount.
 * Monthly: slot into the latest paycheck at least 3 days before due day.
 */
export function prefillAllocations(opts: {
  paychecks: Paycheck[]
  frequency: PayFrequency
  amount: number
  dueDay?: number
}): Record<string, number | ""> {
  const { paychecks, frequency, amount, dueDay } = opts
  const sorted = [...paychecks].sort((a, b) => a.date.localeCompare(b.date))
  const result: Record<string, number | ""> = {}
  for (const p of sorted) result[p.date] = ""

  if (sorted.length === 0 || !Number.isFinite(amount)) return result

  if (frequency === "weekly") {
    for (const p of sorted) result[p.date] = amount
    return result
  }

  if (frequency === "biweekly") {
    const gap = medianGapDays(sorted.map((p) => p.date))
    // Pay columns already ~biweekly → every column; weekly columns → every other
    if (gap >= 12) {
      for (const p of sorted) result[p.date] = amount
    } else {
      sorted.forEach((p, i) => {
        if (i % 2 === 0) result[p.date] = amount
      })
    }
    return result
  }

  // monthly
  const months = new Set(sorted.map((p) => monthKey(p.date)))
  // Include next month after last paycheck so late-month dues still resolve
  if (sorted.length > 0) {
    const last = parseIsoDate(sorted[sorted.length - 1].date)
    last.setMonth(last.getMonth() + 1)
    months.add(monthKey(toIsoDate(last)))
  }

  for (const ym of [...months].sort()) {
    const [ys, ms] = ym.split("-").map(Number)
    const year = ys
    const monthIndex = ms - 1
    const dim = daysInMonth(year, monthIndex)
    const day =
      dueDay !== undefined && dueDay >= 1 && dueDay <= 31
        ? Math.min(Math.round(dueDay), dim)
        : dim
    const due = new Date(year, monthIndex, day, 12, 0, 0, 0)
    const deadline = new Date(due)
    deadline.setDate(deadline.getDate() - 3)
    const deadlineIso = toIsoDate(deadline)

    let pick: string | null = null
    for (const p of sorted) {
      if (p.date <= deadlineIso) pick = p.date
    }
    if (pick) result[pick] = amount
  }

  return result
}

function isFilledAmount(v: number | "" | undefined): v is number {
  return v !== undefined && v !== "" && Number(v) !== 0
}

function hasOwnAllocation(
  existing: Record<string, number | ""> | undefined,
  date: string,
) {
  return !!existing && Object.prototype.hasOwnProperty.call(existing, date)
}

function hasScheduledSlots(prefill: Record<string, number | "">) {
  return Object.values(prefill).some((v) => v !== undefined && v !== "")
}

/**
 * Map allocations onto the current paycheck columns using a frequency schedule.
 *
 * When `prefill` has scheduled amounts (from frequency rules):
 * - scheduled columns keep an existing amount if present
 * - explicit empty/0 stays empty (do not re-prefill cleared cells)
 * - missing keys get the schedule prefill
 * - unscheduled columns are cleared
 *
 * When `prefill` is empty (no frequency schedule), keep exact-date existing values only.
 */
export function mergeAllocationsOntoPaychecks(
  paychecks: Paycheck[],
  existing: Record<string, number | ""> | undefined,
  prefill: Record<string, number | "">,
): Record<string, number | ""> {
  const out: Record<string, number | ""> = {}

  if (!hasScheduledSlots(prefill)) {
    for (const p of paychecks) {
      const prev = existing?.[p.date]
      out[p.date] = isFilledAmount(prev) ? prev : ""
    }
    return out
  }

  for (const p of paychecks) {
    const scheduled = prefill[p.date]
    if (scheduled !== undefined && scheduled !== "") {
      if (hasOwnAllocation(existing, p.date)) {
        const prev = existing![p.date]
        out[p.date] = isFilledAmount(prev) ? prev : ""
      } else {
        out[p.date] = scheduled
      }
    } else {
      out[p.date] = ""
    }
  }
  return out
}

