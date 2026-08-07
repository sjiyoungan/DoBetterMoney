import type { Category, Paycheck } from "@/types/budget"

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function parseParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return { y, m, d }
}

function isLastDayOfMonth(iso: string) {
  const { y, m, d } = parseParts(iso)
  return d === daysInMonth(y, m - 1)
}

/** Same paycheck slot: matching day-of-month, or both last day of their month. */
export function samePaySlot(a: string, b: string) {
  if (isLastDayOfMonth(a) || isLastDayOfMonth(b)) {
    return isLastDayOfMonth(a) && isLastDayOfMonth(b)
  }
  return parseParts(a).d === parseParts(b).d
}

function monthsBetween(fromIso: string, toIso: string) {
  const a = parseParts(fromIso)
  const b = parseParts(toIso)
  return (b.y - a.y) * 12 + (b.m - a.m)
}

function medianGapDays(sortedDates: string[]) {
  if (sortedDates.length < 2) return 14
  const gaps: number[] = []
  for (let i = 1; i < sortedDates.length; i++) {
    const t0 = new Date(sortedDates[i - 1] + "T12:00:00").getTime()
    const t1 = new Date(sortedDates[i] + "T12:00:00").getTime()
    gaps.push(Math.round((t1 - t0) / (1000 * 60 * 60 * 24)))
  }
  gaps.sort((x, y) => x - y)
  return gaps[Math.floor(gaps.length / 2)] ?? 14
}

/**
 * Month cadence for apply-to-future.
 * monthly → 1; every N months/years via recurrence → N; weekly/biweekly → null.
 */
export function expenseMonthInterval(cat: Category): number | null {
  if (cat.frequency === "weekly" || cat.frequency === "biweekly") return null
  if (cat.recurrence?.unit === "week" || cat.recurrence?.unit === "day") {
    return null
  }

  if (cat.recurrence?.unit === "year" && cat.recurrence.interval >= 1) {
    return Math.max(1, cat.recurrence.interval * 12)
  }
  if (cat.recurrence?.unit === "month" && cat.recurrence.interval >= 1) {
    return Math.max(1, cat.recurrence.interval)
  }
  if (cat.frequency === "monthly" || !cat.frequency) return 1
  return null
}

function paycheckStep(cat: Category, paychecks: Paycheck[]): number {
  if (cat.frequency === "weekly") return 1
  if (cat.frequency === "biweekly") {
    const gap = medianGapDays(
      [...paychecks].map((p) => p.date).sort((a, b) => a.localeCompare(b)),
    )
    return gap >= 12 ? 1 : 2
  }
  if (cat.recurrence?.unit === "week") {
    return Math.max(1, cat.recurrence.interval)
  }
  return 1
}

/**
 * Future paycheck dates that share this edit's cadence/slot.
 *
 * Monthly / every N months: same day-of-month (or last-day) slot, every N months.
 * Weekly / biweekly: every Nth paycheck from the edited column.
 */
export function futureDatesMatchingCadence(
  cat: Category,
  paychecks: Paycheck[],
  fromDate: string,
): string[] {
  const sorted = [...paychecks].sort((a, b) => a.date.localeCompare(b.date))
  const monthInterval = expenseMonthInterval(cat)

  if (monthInterval != null) {
    return sorted
      .map((p) => p.date)
      .filter((d) => {
        if (d <= fromDate) return false
        if (!samePaySlot(fromDate, d)) return false
        const diff = monthsBetween(fromDate, d)
        return diff > 0 && diff % monthInterval === 0
      })
  }

  const fromIdx = sorted.findIndex((p) => p.date === fromDate)
  if (fromIdx < 0) {
    return sorted.map((p) => p.date).filter((d) => d > fromDate)
  }
  const step = paycheckStep(cat, sorted)
  const out: string[] = []
  for (let i = fromIdx + step; i < sorted.length; i += step) {
    out.push(sorted[i].date)
  }
  return out
}

export function applyAmountToFuture(
  cat: Category,
  paychecks: Paycheck[],
  fromDate: string,
  value: number | "",
): Record<string, number | ""> {
  const allocations = { ...cat.allocations }
  for (const date of futureDatesMatchingCadence(cat, paychecks, fromDate)) {
    allocations[date] = value
  }
  return allocations
}
