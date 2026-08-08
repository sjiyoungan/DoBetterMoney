import type { Bucket, Category, Paycheck } from "@/types/budget"

export type CompositionPeriod = "month" | "year"

export type CompositionSegmentKey =
  | "income"
  | "fixed"
  | "variable"
  | "savings"

export type CompositionSegment = {
  key: CompositionSegmentKey
  label: string
  amount: number
  color: string
}

/** Segment colors — distinct palette for Income / Fixed / Variable / Savings. */
export const COMPOSITION_COLORS: Record<CompositionSegmentKey, string> = {
  income: "#A02C5B",
  fixed: "#70B8AC",
  variable: "#50468B",
  savings: "#4592D0",
}

function allocationAt(cat: Category, date: string): number {
  const raw = cat.allocations[date]
  if (raw === "" || raw === undefined) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Sum category allocations whose keys are in `dates` (paycheck ISO dates). */
export function sumAllocationsForDates(
  categories: Category[],
  dates: ReadonlySet<string>,
): number {
  let total = 0
  for (const cat of categories) {
    if (cat.hidden) continue
    for (const date of dates) {
      total += allocationAt(cat, date)
    }
  }
  return total
}

/**
 * Total savings for the active year:
 * sum of all visible savings-category allocations across paycheck dates in that year
 * (money put into savings YTD / year-to-date for the viewed year).
 */
export function totalSavingsAllocated(
  buckets: Bucket[],
  paychecks: Paycheck[],
): number {
  const dates = new Set(paychecks.map((p) => p.date))
  let total = 0
  for (const bucket of buckets) {
    if (bucket.kind !== "savings") continue
    total += sumAllocationsForDates(bucket.categories, dates)
  }
  return total
}

/**
 * Month filter for "This month" tab:
 * - If viewing the current calendar year → today's month
 * - Else → latest month in that year that has paycheck data
 */
export function resolveCompositionMonth(
  paychecks: Paycheck[],
  activeYear: number,
  now: Date = new Date(),
): { year: number; month: number } {
  if (activeYear === now.getFullYear()) {
    return { year: activeYear, month: now.getMonth() + 1 }
  }
  let latest = 0
  for (const p of paychecks) {
    const y = Number(p.date.slice(0, 4))
    const m = Number(p.date.slice(5, 7))
    if (y === activeYear && m > latest) latest = m
  }
  return { year: activeYear, month: latest || 12 }
}

export function paycheckDatesForPeriod(
  paychecks: Paycheck[],
  period: CompositionPeriod,
  activeYear: number,
  now: Date = new Date(),
): Set<string> {
  if (period === "year") {
    return new Set(paychecks.map((p) => p.date))
  }
  const { year, month } = resolveCompositionMonth(paychecks, activeYear, now)
  const prefix = `${year}-${String(month).padStart(2, "0")}`
  return new Set(paychecks.filter((p) => p.date.startsWith(prefix)).map((p) => p.date))
}

/**
 * Budget composition for Income / Fixed / Variable / Savings.
 * Spending with missing variability is treated as fixed.
 */
export function computeComposition(
  buckets: Bucket[],
  paychecks: Paycheck[],
  period: CompositionPeriod,
  activeYear: number,
  now: Date = new Date(),
): CompositionSegment[] {
  const dates = paycheckDatesForPeriod(paychecks, period, activeYear, now)
  let income = 0
  let fixed = 0
  let variable = 0
  let savings = 0

  for (const bucket of buckets) {
    if (bucket.kind === "income") {
      income += sumAllocationsForDates(bucket.categories, dates)
    } else if (bucket.kind === "savings") {
      savings += sumAllocationsForDates(bucket.categories, dates)
    } else if (bucket.kind === "spending") {
      for (const cat of bucket.categories) {
        if (cat.hidden) continue
        const amount = sumAllocationsForDates([cat], dates)
        if (cat.variability === "variable") variable += amount
        else fixed += amount
      }
    }
  }

  return [
    {
      key: "income",
      label: "Income",
      amount: income,
      color: COMPOSITION_COLORS.income,
    },
    {
      key: "fixed",
      label: "Fixed expenses",
      amount: fixed,
      color: COMPOSITION_COLORS.fixed,
    },
    {
      key: "variable",
      label: "Variable spending",
      amount: variable,
      color: COMPOSITION_COLORS.variable,
    },
    {
      key: "savings",
      label: "Savings",
      amount: savings,
      color: COMPOSITION_COLORS.savings,
    },
  ]
}
