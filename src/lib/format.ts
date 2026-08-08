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

/** Sum of paycheck allocation cells for a category.
 * When `dates` is provided, only those ISO keys count (matches the grid columns).
 */
export function sumAllocations(
  allocations: Record<string, number | ""> | undefined,
  dates?: ReadonlySet<string> | readonly string[],
): number {
  if (!allocations) return 0
  let total = 0
  const keys = dates
    ? dates
    : (Object.keys(allocations) as readonly string[])
  for (const date of keys) {
    const value = allocations[date]
    if (value === "" || value === undefined) continue
    const n = Number(value)
    if (Number.isFinite(n)) total += n
  }
  return total
}

/** Savings balance left = goal − planned amounts on the active paycheck columns. */
export function savingsBalanceLeft(
  goal: number | undefined,
  allocations: Record<string, number | ""> | undefined,
  dates?: ReadonlySet<string> | readonly string[],
): number | undefined {
  if (goal === undefined) return undefined
  return goal - sumAllocations(allocations, dates)
}

export function formatPayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

/** History log date — includes year (e.g. "Aug 15, 2026"). */
export function formatHistoryDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function allocationKey(categoryId: string, paycheckId: string) {
  return `${categoryId}::${paycheckId}`
}
