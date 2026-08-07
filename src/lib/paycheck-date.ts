import type { YearBudget } from "@/types/budget"

/**
 * Change one paycheck column's date and remap allocation keys to match.
 * No-ops if the date is unchanged or another column already uses that date.
 */
export function renamePaycheckDate(
  year: YearBudget,
  paycheckId: string,
  newDate: string,
): YearBudget {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return year

  const target = year.paychecks.find((p) => p.id === paycheckId)
  if (!target || target.date === newDate) return year
  if (year.paychecks.some((p) => p.id !== paycheckId && p.date === newDate)) {
    return year
  }

  const oldDate = target.date
  const paychecks = year.paychecks
    .map((p) => (p.id === paycheckId ? { ...p, date: newDate } : p))
    .sort((a, b) => a.date.localeCompare(b.date))

  const buckets = year.buckets.map((bucket) => ({
    ...bucket,
    categories: bucket.categories.map((cat) => {
      const allocations = { ...cat.allocations }
      if (Object.prototype.hasOwnProperty.call(allocations, oldDate)) {
        const value = allocations[oldDate]
        delete allocations[oldDate]
        allocations[newDate] = value
      }
      return { ...cat, allocations }
    }),
  }))

  return { ...year, paychecks, buckets }
}
