import { emptyYearBudget } from "@/data/empty"
import { mergeAllocationsOntoPaychecks, prefillAllocations } from "@/lib/allocations"
import {
  applyIncomeAllocations,
  categoryRecurrence,
  generatePaychecksFromIncomeBucket,
} from "@/lib/income-schedule"
import { generateRecurrenceDates } from "@/lib/recurrence"
import type {
  Bucket,
  BudgetWorkspace,
  Category,
  YearBudget,
} from "@/types/budget"

function currentCalendarYear() {
  return new Date().getFullYear()
}

function isLegacyWorkspace(data: unknown): data is {
  paychecks?: YearBudget["paychecks"]
  buckets?: YearBudget["buckets"]
  holderSplits?: YearBudget["holderSplits"]
  withdrawals?: YearBudget["withdrawals"]
  holderBalances?: YearBudget["holderBalances"]
} {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return !("years" in d) && ("paychecks" in d || "buckets" in d)
}

function inferStartYear(slice: Partial<YearBudget>): number {
  const dates = (slice.paychecks ?? [])
    .map((p) => p.date?.slice(0, 4))
    .filter(Boolean)
    .map(Number)
  if (dates.length > 0) return Math.min(...dates)
  return currentCalendarYear()
}

/** Normalize stored JSON (legacy flat or multi-year) into BudgetWorkspace. */
export function normalizeWorkspace(
  data: unknown,
  doneKeysFromColumn: string[] = [],
): BudgetWorkspace {
  if (data && typeof data === "object" && "years" in (data as object)) {
    const ws = data as BudgetWorkspace
    const years = { ...ws.years }
    for (const key of Object.keys(years)) {
      years[key] = {
        ...emptyYearBudget(),
        ...years[key],
        doneKeys: years[key]?.doneKeys ?? [],
      }
    }
    const yearNums = Object.keys(years)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    const startYear = ws.startYear ?? yearNums[0] ?? currentCalendarYear()
    let activeYear = ws.activeYear ?? startYear
    if (!years[String(activeYear)]) {
      activeYear = yearNums[yearNums.length - 1] ?? startYear
    }
    // Merge column done keys into active year if year slice has none
    const activeKey = String(activeYear)
    if (
      years[activeKey] &&
      (years[activeKey].doneKeys?.length ?? 0) === 0 &&
      doneKeysFromColumn.length > 0
    ) {
      years[activeKey] = {
        ...years[activeKey],
        doneKeys: doneKeysFromColumn,
      }
    }
    return { startYear, activeYear, years }
  }

  if (isLegacyWorkspace(data)) {
    const slice: YearBudget = {
      paychecks: data.paychecks ?? [],
      buckets: data.buckets ?? [],
      holderSplits: data.holderSplits ?? [],
      withdrawals: data.withdrawals ?? [],
      holderBalances: data.holderBalances ?? {},
      doneKeys: doneKeysFromColumn,
    }
    const year = inferStartYear(slice)
    // Structure-only migration — never invent or rewrite cell amounts on load
    return {
      startYear: year,
      activeYear: year,
      years: { [String(year)]: slice },
    }
  }

  const year = currentCalendarYear()
  return {
    startYear: year,
    activeYear: year,
    years: {
      [String(year)]: {
        ...emptyYearBudget(),
        doneKeys: doneKeysFromColumn,
      },
    },
  }
}

export function listYears(workspace: BudgetWorkspace): number[] {
  return Object.keys(workspace.years)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
}

export function getActiveYearBudget(workspace: BudgetWorkspace): YearBudget {
  const key = String(workspace.activeYear)
  const raw = workspace.years[key] ?? emptyYearBudget()
  return clampYearBudget(raw, workspace.activeYear)
}

/** Keep only Jan 1–Dec 31 columns/allocations for the given year. */
export function clampYearBudget(slice: YearBudget, year: number): YearBudget {
  const prefix = String(year)
  const paychecks = slice.paychecks.filter((p) => p.date.startsWith(prefix))
  const keep = new Set(paychecks.map((p) => p.date))
  return {
    ...slice,
    paychecks,
    buckets: slice.buckets.map((bucket) => ({
      ...bucket,
      categories: bucket.categories.map((cat) => {
        const allocations: Record<string, number | ""> = {}
        for (const [date, amount] of Object.entries(cat.allocations)) {
          if (keep.has(date) || date.startsWith(prefix)) {
            allocations[date] = amount
          }
        }
        return { ...cat, allocations }
      }),
    })),
    holderSplits: slice.holderSplits.filter((s) =>
      paychecks.some((p) => p.id === s.paycheckId),
    ),
  }
}

export function setActiveYear(
  workspace: BudgetWorkspace,
  year: number,
): BudgetWorkspace {
  if (!workspace.years[String(year)]) return workspace
  return { ...workspace, activeYear: year }
}

export function updateActiveYearBudget(
  workspace: BudgetWorkspace,
  updater: (year: YearBudget) => YearBudget,
): BudgetWorkspace {
  const key = String(workspace.activeYear)
  const current = workspace.years[key] ?? emptyYearBudget()
  return {
    ...workspace,
    years: {
      ...workspace.years,
      [key]: updater(current),
    },
  }
}

function cloneCategoryForNewYear(cat: Category, year: number): Category {
  return {
    ...cat,
    allocations: {},
    ...(cat.recurrence
      ? {
          recurrence: {
            ...cat.recurrence,
            startDate: `${year}-01-01`,
            ends: { kind: "never" as const },
          },
        }
      : {}),
  }
}

function prefillExpenseCategory(
  cat: Category,
  paychecks: YearBudget["paychecks"],
): Category {
  if (cat.frequency && (cat.amount !== undefined || cat.recurringAmount !== undefined)) {
    const amount = cat.amount ?? cat.recurringAmount ?? 0
    const filled = prefillAllocations({
      paychecks,
      frequency: cat.frequency,
      amount,
      dueDay: cat.dueDay,
    })
    return {
      ...cat,
      allocations: mergeAllocationsOntoPaychecks(
        paychecks,
        cat.allocations,
        filled,
      ),
    }
  }
  return {
    ...cat,
    allocations: mergeAllocationsOntoPaychecks(paychecks, cat.allocations, {}),
  }
}

/**
 * Align category allocations to the current paycheck columns.
 * Preserves existing cell values exactly; new columns stay empty.
 * Does NOT re-run frequency prefills (those only run on add/edit category
 * or Create next year).
 */
function preserveAllocationsOnPaychecks(
  cat: Category,
  paychecks: YearBudget["paychecks"],
): Category {
  const allocations: Record<string, number | ""> = {}
  for (const p of paychecks) {
    const prev = cat.allocations?.[p.date]
    if (prev === undefined || prev === "" || Number(prev) === 0) {
      allocations[p.date] = ""
    } else {
      allocations[p.date] = prev
    }
  }
  return { ...cat, allocations }
}

/**
 * After paycheck columns change (e.g. income schedule update):
 * keep stored cell values on matching dates; leave new columns empty.
 * Income categories still follow their pay-date schedule for amounts.
 */
export function syncYearPrefills(slice: YearBudget, year: number): YearBudget {
  let paychecks = slice.paychecks.filter((p) =>
    p.date.startsWith(String(year)),
  )
  const incomeBucket = slice.buckets.find((b) => b.kind === "income")
  if (paychecks.length === 0 && incomeBucket) {
    paychecks = generatePaychecksFromIncomeBucket(incomeBucket, year)
  }
  if (paychecks.length === 0) return { ...slice, paychecks }

  const buckets = slice.buckets.map((bucket) => {
    if (bucket.kind === "income") {
      return {
        ...bucket,
        categories: bucket.categories.map((cat) => {
          const recurrence = categoryRecurrence(cat)
          if (!recurrence || cat.amount === undefined) {
            return preserveAllocationsOnPaychecks(cat, paychecks)
          }
          const ownDates = new Set(generateRecurrenceDates(recurrence, { year }))
          const allocations: Record<string, number | ""> = {}
          for (const p of paychecks) {
            if (Object.prototype.hasOwnProperty.call(cat.allocations ?? {}, p.date)) {
              const prev = cat.allocations[p.date]
              allocations[p.date] =
                prev === undefined || prev === "" || Number(prev) === 0
                  ? ""
                  : prev
            } else {
              allocations[p.date] = ownDates.has(p.date) ? cat.amount : ""
            }
          }
          return { ...cat, allocations }
        }),
      }
    }
    // Totals are computed live from sources — keep empty allocations
    if (bucket.kind === "totals") {
      return {
        ...bucket,
        categories: bucket.categories.map((cat) => ({
          ...cat,
          allocations: {},
          totalSources: cat.totalSources ? [...cat.totalSources] : [],
        })),
      }
    }
    return {
      ...bucket,
      categories: bucket.categories.map((cat) =>
        preserveAllocationsOnPaychecks(cat, paychecks),
      ),
    }
  })

  return { ...slice, paychecks, buckets }
}

/**
 * Create the next year page by carrying over groups/categories and
 * regenerating paycheck columns + prefills for that year.
 */
export function createNextYear(workspace: BudgetWorkspace): BudgetWorkspace {
  const years = listYears(workspace)
  const latest = years[years.length - 1] ?? workspace.startYear
  const nextYear = latest + 1
  if (workspace.years[String(nextYear)]) {
    return setActiveYear(workspace, nextYear)
  }

  const source = workspace.years[String(latest)] ?? emptyYearBudget()

  const carriedBuckets: Bucket[] = source.buckets.map((bucket) => ({
    ...bucket,
    categories: bucket.categories.map((cat) => {
      const base = cloneCategoryForNewYear(cat, nextYear)
      // Ensure income has recurrence anchored to the new year
      if (bucket.kind !== "income") return base
      const recurrence = categoryRecurrence(base)
      if (!recurrence) return base
      return {
        ...base,
        recurrence: {
          ...recurrence,
          startDate: `${nextYear}-01-01`,
          ends: { kind: "never" as const },
        },
      }
    }),
  }))

  const incomeBucket = carriedBuckets.find((b) => b.kind === "income")
  const paychecks = incomeBucket
    ? generatePaychecksFromIncomeBucket(incomeBucket, nextYear)
    : []

  let buckets = carriedBuckets
  if (incomeBucket) {
    const filledIncome = applyIncomeAllocations(incomeBucket, paychecks, {
      year: nextYear,
    })
    buckets = buckets.map((b) =>
      b.id === filledIncome.id ? filledIncome : b,
    )
  }

  buckets = buckets.map((bucket) => {
    if (bucket.kind === "income" || bucket.kind === "totals") return bucket
    return {
      ...bucket,
      categories: bucket.categories.map((cat) =>
        prefillExpenseCategory(cat, paychecks),
      ),
    }
  })

  // Carry savings balances forward
  buckets = buckets.map((bucket) => {
    if (bucket.kind !== "savings") return bucket
    const prev = source.buckets.find((b) => b.id === bucket.id)
    return {
      ...bucket,
      categories: bucket.categories.map((cat) => {
        const prevCat = prev?.categories.find((c) => c.id === cat.id)
        return {
          ...cat,
          balance: prevCat?.balance ?? cat.balance,
          goal: prevCat?.goal ?? cat.goal,
        }
      }),
    }
  })

  const nextSlice: YearBudget = {
    paychecks,
    buckets,
    holderSplits: [],
    withdrawals: [],
    holderBalances: { ...source.holderBalances },
    doneKeys: [],
  }

  return {
    ...workspace,
    activeYear: nextYear,
    years: {
      ...workspace.years,
      [String(nextYear)]: nextSlice,
    },
  }
}

export function nextYearToCreate(workspace: BudgetWorkspace): number {
  const years = listYears(workspace)
  const latest = years[years.length - 1] ?? workspace.startYear
  return latest + 1
}
