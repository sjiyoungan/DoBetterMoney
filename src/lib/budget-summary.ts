import type { Bucket, Category, Paycheck } from "@/types/budget"

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

export type SavingsCategoryTotal = {
  categoryId: string
  categoryName: string
  amount: number
}

export type SavingsBucketTotal = {
  bucketId: string
  bucketName: string
  amount: number
  categories: SavingsCategoryTotal[]
}

/**
 * Per-bucket savings totals for the active year (same allocation basis as
 * {@link totalSavingsAllocated}). Only `kind === "savings"` buckets.
 * Each bucket includes a per-category breakdown of visible categories.
 */
export function savingsAllocatedByBucket(
  buckets: Bucket[],
  paychecks: Paycheck[],
): SavingsBucketTotal[] {
  const dates = new Set(paychecks.map((p) => p.date))
  return buckets
    .filter((bucket) => bucket.kind === "savings")
    .map((bucket) => {
      const categories = bucket.categories
        .filter((cat) => !cat.hidden)
        .map((cat) => ({
          categoryId: cat.id,
          categoryName: cat.name,
          amount: sumAllocationsForDates([cat], dates),
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
 * Total savings for the active year:
 * sum of all visible savings-category allocations across paycheck dates in that year
 * (money put into savings YTD / year-to-date for the viewed year).
 */
export function totalSavingsAllocated(
  buckets: Bucket[],
  paychecks: Paycheck[],
): number {
  return savingsAllocatedByBucket(buckets, paychecks).reduce(
    (sum, row) => sum + row.amount,
    0,
  )
}

/**
 * Budget composition for the active year (all paychecks).
 * Segments are Fixed / Variable / Savings only (no income).
 * Percentages renormalize to the sum of those three segments.
 * Spending with missing variability is treated as fixed.
 */
export function computeComposition(
  buckets: Bucket[],
  paychecks: Paycheck[],
): CompositionResult {
  const dates = new Set(paychecks.map((p) => p.date))
  let fixed = 0
  let variable = 0
  let savings = 0

  for (const bucket of buckets) {
    if (bucket.kind === "savings") {
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
