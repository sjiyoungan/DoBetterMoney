export function formatMoney(value: number | "" | undefined) {
  if (value === "" || value === undefined || Number.isNaN(Number(value))) {
    return "—"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

/** Sum of paycheck allocation cells for a category. */
export function sumAllocations(
  allocations: Record<string, number | ""> | undefined,
): number {
  if (!allocations) return 0
  let total = 0
  for (const value of Object.values(allocations)) {
    if (value === "" || value === undefined) continue
    const n = Number(value)
    if (Number.isFinite(n)) total += n
  }
  return total
}

/** Savings balance left = goal − sum of allocation cells. */
export function savingsBalanceLeft(
  goal: number | undefined,
  allocations: Record<string, number | ""> | undefined,
): number | undefined {
  if (goal === undefined) return undefined
  return goal - sumAllocations(allocations)
}

export function formatPayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function allocationKey(categoryId: string, paycheckId: string) {
  return `${categoryId}::${paycheckId}`
}
