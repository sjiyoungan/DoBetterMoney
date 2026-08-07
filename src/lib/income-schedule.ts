import type { Bucket, PayFrequency, Paycheck } from "@/types/budget"
import { prefillAllocations } from "@/lib/allocations"

export type IncomeSourceInput = {
  name: string
  amount: number
  frequency: PayFrequency
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function advance(d: Date, frequency: PayFrequency) {
  const next = new Date(d)
  if (frequency === "weekly") next.setDate(next.getDate() + 7)
  else if (frequency === "biweekly") next.setDate(next.getDate() + 14)
  else next.setMonth(next.getMonth() + 1)
  return next
}

/** Build an Income group from onboarding sources, prefilling calendar cells. */
export function buildIncomeBucket(
  sources: IncomeSourceInput[],
  paychecks: Paycheck[],
): Bucket {
  return {
    id: crypto.randomUUID(),
    name: "Income",
    kind: "income",
    categories: sources.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      amount: s.amount,
      frequency: s.frequency,
      allocations: prefillAllocations({
        paychecks,
        frequency: s.frequency,
        amount: s.amount,
      }),
    })),
  }
}

/** Upcoming paycheck columns derived from income sources. */
export function generatePaychecksFromIncome(
  sources: IncomeSourceInput[],
  countPerSource = 16,
): Paycheck[] {
  if (sources.length === 0) return []

  const byDate = new Map<string, number>()
  const start = new Date()
  start.setHours(12, 0, 0, 0)

  for (const source of sources) {
    let cursor = new Date(start)
    for (let i = 0; i < countPerSource; i++) {
      const key = toIsoDate(cursor)
      byDate.set(key, (byDate.get(key) ?? 0) + source.amount)
      cursor = advance(cursor, source.frequency)
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, income]) => ({
      id: crypto.randomUUID(),
      date,
      income,
      completed: false,
    }))
}
