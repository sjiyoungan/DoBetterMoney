import type { Bucket, Category, Paycheck } from "@/types/budget"
import { allocationKey } from "@/lib/format"

export type CompositionPeriod = "month" | "year"

export type CompositionSegmentKey = "fixed" | "variable" | "savings"

export type CompositionSegment = {
  key: CompositionSegmentKey
  label: string
  amount: number
  color: string
}

export type CompositionResult = {
  /** Sum of fixed + variable + savings (donut denominator). */
  total: number
  segments: CompositionSegment[]
}

/**
 * Segment colors — Fixed / Variable / Savings as share of expenses+savings.
 * Savings is the brightest maroon so the smallest slice stays visible.
 */
export const COMPOSITION_COLORS: Record<CompositionSegmentKey, string> = {
  fixed: "#70B8AC",
  variable: "#50468B",
  savings: "#C43B6E",
}

function allocationAt(cat: Category, date: string): number {
  const raw = cat.allocations[date]
  if (raw === "" || raw === undefined) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function carryOverAt(cat: Category): number {
  const n = cat.balance
  return typeof n === "number" && Number.isFinite(n) ? n : 0
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
 * Money actually in this savings category:
 * carry-over (`Category.balance`) + allocations marked moved (`doneKeys`).
 * Unchecked planned cells do not count — they are not in the bank yet.
 */
export function savingsActualForCategory(
  cat: Category,
  paychecks: Paycheck[],
  doneKeys: ReadonlySet<string>,
): number {
  let checked = 0
  for (const p of paychecks) {
    if (!doneKeys.has(allocationKey(cat.id, p.id))) continue
    checked += allocationAt(cat, p.date)
  }
  return carryOverAt(cat) + checked
}

export type SavingsCategoryTotal = {
  categoryId: string
  categoryName: string
  amount: number
  goal: number | undefined
}

export type SavingsBucketTotal = {
  bucketId: string
  bucketName: string
  amount: number
  categories: SavingsCategoryTotal[]
}

/**
 * Per-bucket savings actuals (carry-over + checked allocations).
 * Only `kind === "savings"` buckets; hidden categories excluded.
 */
export function savingsAllocatedByBucket(
  buckets: Bucket[],
  paychecks: Paycheck[],
  doneKeys: ReadonlySet<string>,
): SavingsBucketTotal[] {
  return buckets
    .filter((bucket) => bucket.kind === "savings")
    .map((bucket) => {
      const categories = bucket.categories
        .filter((cat) => !cat.hidden)
        .map((cat) => ({
          categoryId: cat.id,
          categoryName: cat.name,
          amount: savingsActualForCategory(cat, paychecks, doneKeys),
          goal: cat.goal,
        }))
      const amount = categories.reduce((sum, cat) => sum + cat.amount, 0)
      return {
        bucketId: bucket.id,
        bucketName: bucket.name,
        amount,
        categories,
      }
    })
}

/**
 * Total money actually in savings accounts for the active year:
 * Σ (carry-over + checked-off allocations) across visible savings categories.
 */
export function totalSavingsAllocated(
  buckets: Bucket[],
  paychecks: Paycheck[],
  doneKeys: ReadonlySet<string>,
): number {
  return savingsAllocatedByBucket(buckets, paychecks, doneKeys).reduce(
    (sum, row) => sum + row.amount,
    0,
  )
}

/**
 * Month filter for "This month":
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
  return new Set(
    paychecks.filter((p) => p.date.startsWith(prefix)).map((p) => p.date),
  )
}

/**
 * Sum of allocations marked moved whose paycheck date is in `dates`.
 */
export function sumCheckedAllocationsForDates(
  categories: Category[],
  paychecks: Paycheck[],
  dates: ReadonlySet<string>,
  doneKeys: ReadonlySet<string>,
): number {
  let total = 0
  for (const cat of categories) {
    if (cat.hidden) continue
    for (const p of paychecks) {
      if (!dates.has(p.date)) continue
      if (!doneKeys.has(allocationKey(cat.id, p.id))) continue
      total += allocationAt(cat, p.date)
    }
  }
  return total
}

/**
 * Budget composition for Fixed / Variable / Savings (no income).
 * Uses actuals: checked-off allocations in the period, plus savings carry-over.
 * Spending with missing variability is treated as fixed.
 */
export function computeComposition(
  buckets: Bucket[],
  paychecks: Paycheck[],
  period: CompositionPeriod,
  activeYear: number,
  doneKeys: ReadonlySet<string>,
  now: Date = new Date(),
): CompositionResult {
  const dates = paycheckDatesForPeriod(paychecks, period, activeYear, now)
  let fixed = 0
  let variable = 0
  let savings = 0

  for (const bucket of buckets) {
    if (bucket.kind === "savings") {
      for (const cat of bucket.categories) {
        if (cat.hidden) continue
        savings += carryOverAt(cat)
        savings += sumCheckedAllocationsForDates(
          [cat],
          paychecks,
          dates,
          doneKeys,
        )
      }
    } else if (bucket.kind === "spending") {
      for (const cat of bucket.categories) {
        if (cat.hidden) continue
        const amount = sumCheckedAllocationsForDates(
          [cat],
          paychecks,
          dates,
          doneKeys,
        )
        if (cat.variability === "variable") variable += amount
        else fixed += amount
      }
    }
  }

  const total = fixed + variable + savings

  return {
    total,
    segments: [
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
    ],
  }
}
