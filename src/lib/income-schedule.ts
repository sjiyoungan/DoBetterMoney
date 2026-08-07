import type { Bucket, Category, IncomeRecurrence, Paycheck } from "@/types/budget"
import {
  generateRecurrenceDates,
  isRecurrenceComplete,
  legacyFrequencyToRecurrence,
} from "@/lib/recurrence"

export type IncomeSourceInput = {
  name: string
  amount: number
  recurrence: IncomeRecurrence
}

function emptyAllocations(dates: string[]): Record<string, number | ""> {
  const out: Record<string, number | ""> = {}
  for (const d of dates) out[d] = ""
  return out
}

function prefillOnDates(
  dates: string[],
  amount: number,
): Record<string, number | ""> {
  const out = emptyAllocations(dates)
  for (const d of dates) out[d] = amount
  return out
}

/** Normalize a category's schedule into IncomeRecurrence when possible. */
export function categoryRecurrence(
  cat: Pick<Category, "recurrence" | "frequency">,
): IncomeRecurrence | null {
  if (cat.recurrence && isRecurrenceComplete(cat.recurrence)) {
    return cat.recurrence
  }
  if (cat.frequency) return legacyFrequencyToRecurrence(cat.frequency)
  return null
}

/** Build paycheck columns from one or more income recurrences. */
export function generatePaychecksFromIncome(
  sources: IncomeSourceInput[],
): Paycheck[] {
  if (sources.length === 0) return []

  const byDate = new Map<string, number>()

  for (const source of sources) {
    const dates = generateRecurrenceDates(source.recurrence)
    for (const date of dates) {
      byDate.set(date, (byDate.get(date) ?? 0) + source.amount)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, income]) => ({
      id: crypto.randomUUID(),
      date,
      income,
      completed: date < today,
    }))
}

export function generatePaychecksFromIncomeBucket(bucket: Bucket): Paycheck[] {
  const sources: IncomeSourceInput[] = bucket.categories
    .map((cat) => {
      const recurrence = categoryRecurrence(cat)
      if (!recurrence || cat.amount === undefined) return null
      return {
        name: cat.name,
        amount: cat.amount,
        recurrence,
      }
    })
    .filter((s): s is IncomeSourceInput => !!s)

  return generatePaychecksFromIncome(sources)
}

/** Prefill each income category onto the shared paycheck dates. */
export function applyIncomeAllocations(
  bucket: Bucket,
  paychecks: Paycheck[],
): Bucket {
  const allDates = paychecks.map((p) => p.date)
  return {
    ...bucket,
    categories: bucket.categories.map((cat) => {
      const recurrence = categoryRecurrence(cat)
      if (!recurrence || cat.amount === undefined) {
        return {
          ...cat,
          allocations: emptyAllocations(allDates),
        }
      }
      const ownDates = new Set(generateRecurrenceDates(recurrence))
      const allocations = emptyAllocations(allDates)
      for (const d of allDates) {
        if (ownDates.has(d)) allocations[d] = cat.amount
      }
      return { ...cat, allocations }
    }),
  }
}

/** Build an Income group from onboarding sources, prefilling calendar cells. */
export function buildIncomeBucket(
  sources: IncomeSourceInput[],
  paychecks: Paycheck[],
): Bucket {
  const dates = paychecks.map((p) => p.date)
  return {
    id: crypto.randomUUID(),
    name: "Income",
    kind: "income",
    categories: sources.map((s) => {
      const ownDates = new Set(generateRecurrenceDates(s.recurrence))
      const allocations = emptyAllocations(dates)
      for (const d of dates) {
        if (ownDates.has(d)) allocations[d] = s.amount
      }
      return {
        id: crypto.randomUUID(),
        name: s.name,
        amount: s.amount,
        recurrence: s.recurrence,
        // Keep a coarse frequency for older expense-prefill paths
        frequency:
          s.recurrence.unit === "week" && s.recurrence.interval === 1
            ? "weekly"
            : s.recurrence.unit === "week" && s.recurrence.interval === 2
              ? "biweekly"
              : s.recurrence.unit === "month"
                ? "monthly"
                : "biweekly",
        allocations,
      }
    }),
  }
}

export { prefillOnDates }
