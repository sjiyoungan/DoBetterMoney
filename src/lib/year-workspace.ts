import { emptyYearBudget } from "@/data/empty"
import { mergeAllocationsOntoPaychecks, prefillAllocations } from "@/lib/allocations"
import {
  paybackRemaining,
  savingsActualForCategory,
} from "@/lib/budget-summary"
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
  Withdrawal,
  YearBudget,
} from "@/types/budget"

function currentCalendarYear() {
  return new Date().getFullYear()
}

/**
 * One-shot: Oct 22 Travel withdrawal was logged as a plain transfer before
 * Borrow existed — promote it so it shows on the Borrowed card.
 */
export function migrateTravelBorrowWithdrawals(
  workspace: BudgetWorkspace,
): { workspace: BudgetWorkspace; changed: boolean } {
  let changed = false
  const years: Record<string, YearBudget> = { ...workspace.years }

  for (const key of Object.keys(years)) {
    const slice = years[key]
    if (!slice) continue

    const travelIds = new Set<string>()
    for (const bucket of slice.buckets ?? []) {
      for (const category of bucket.categories ?? []) {
        if (category.name.trim().toLowerCase() === "travel") {
          travelIds.add(category.id)
        }
      }
    }
    if (travelIds.size === 0) continue

    let yearChanged = false
    const withdrawals = (slice.withdrawals ?? []).map((w) => {
      if (w.date !== "2026-10-22") return w
      if (!travelIds.has(w.categoryId)) return w
      if (w.kind === "borrow" || w.repaidAt) return w
      yearChanged = true
      return { ...w, kind: "borrow" as const }
    })

    if (yearChanged) {
      changed = true
      years[key] = { ...slice, withdrawals }
    }
  }

  return {
    workspace: changed ? { ...workspace, years } : workspace,
    changed,
  }
}

function isLegacyWorkspace(data: unknown): data is {
  paychecks?: YearBudget["paychecks"]
  buckets?: YearBudget["buckets"]
  holderSplits?: YearBudget["holderSplits"]
  withdrawals?: YearBudget["withdrawals"]
  deposits?: YearBudget["deposits"]
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
        jiTransferLog: years[key]?.jiTransferLog ?? [],
        jiTransferSources: years[key]?.jiTransferSources ?? [],
        jiAccountSources: years[key]?.jiAccountSources ?? [],
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
      deposits: data.deposits ?? [],
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
    // Carry cell notes forward with the category (keyed by paycheck ISO date)
    ...(cat.comments ? { comments: { ...cat.comments } } : {}),
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

function doneKeySet(slice: YearBudget): Set<string> {
  return new Set(slice.doneKeys ?? [])
}

/** Ending savings cash in a prior year → opening carry for the next page. */
function endingSavingsBalance(slice: YearBudget, cat: Category): number {
  return savingsActualForCategory(
    cat,
    slice.paychecks,
    doneKeySet(slice),
    slice.withdrawals ?? [],
    slice.deposits ?? [],
  )
}

/** Remaining payback after checked payments in the prior year. */
function endingPaybackGoal(slice: YearBudget, cat: Category): number {
  return paybackRemaining(cat, slice.paychecks, doneKeySet(slice))
}

function openBorrowsFrom(slice: YearBudget): Withdrawal[] {
  return (slice.withdrawals ?? [])
    .filter((w) => w.kind === "borrow" && !w.repaidAt)
    .map((w) => ({ ...w }))
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
    // Totals / budget calc are computed live — keep empty allocations
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
    if (bucket.kind === "budget_calc") {
      return {
        ...bucket,
        categories: bucket.categories.map((cat) => ({
          ...cat,
          allocations: {},
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
    if (
      bucket.kind === "income" ||
      bucket.kind === "totals" ||
      bucket.kind === "budget_calc"
    ) {
      return bucket
    }
    const prevBucket = source.buckets.find((b) => b.id === bucket.id)
    return {
      ...bucket,
      categories: bucket.categories.map((cat) => {
        const filled = prefillExpenseCategory(cat, paychecks)
        const prevCat = prevBucket?.categories.find((c) => c.id === cat.id)
        if (bucket.kind === "savings" && prevCat) {
          return {
            ...filled,
            balance: endingSavingsBalance(source, prevCat),
            goal: prevCat.goal ?? cat.goal,
            allocations: {},
          }
        }
        if (bucket.kind === "payback" && prevCat) {
          return {
            ...filled,
            goal: endingPaybackGoal(source, prevCat),
          }
        }
        return filled
      }),
    }
  })

  const nextSlice: YearBudget = {
    paychecks,
    buckets,
    holderSplits: [],
    withdrawals: openBorrowsFrom(source),
    deposits: [],
    holderBalances: { ...source.holderBalances },
    doneKeys: [],
    jiTransferSources: source.jiTransferSources
      ? source.jiTransferSources.map((s) => ({ ...s }))
      : [],
    jiAccountSources: source.jiAccountSources
      ? source.jiAccountSources.map((s) => ({ ...s }))
      : [],
    jiTransferLog: [],
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

/**
 * Years are continuous pages: push groups, schedules, opening balances, and
 * open borrows from `fromYear` into every later year. Later-year paycheck
 * cells / notes / local history are kept when the category still exists.
 * Never writes backward into earlier years.
 */
export function propagateStructureForward(
  workspace: BudgetWorkspace,
  fromYear: number = workspace.activeYear,
): BudgetWorkspace {
  const source = workspace.years[String(fromYear)]
  if (!source) return workspace
  const later = listYears(workspace).filter((y) => y > fromYear)
  if (later.length === 0) return workspace

  const years: Record<string, YearBudget> = { ...workspace.years }
  // Chain forward so each page’s opening balance reflects the prior page.
  let prior = source
  for (const y of later) {
    const target = years[String(y)]
    if (!target) continue
    const merged = mergeStructureIntoYear(prior, target, y)
    years[String(y)] = merged
    prior = merged
  }
  return { ...workspace, years }
}

function mergeStructureIntoYear(
  source: YearBudget,
  target: YearBudget,
  year: number,
): YearBudget {
  const prevByBucket = new Map(target.buckets.map((b) => [b.id, b]))
  const nextCategoryIds = new Set<string>()

  let buckets: Bucket[] = source.buckets.map((srcBucket) => {
    const prevBucket = prevByBucket.get(srcBucket.id)
    const prevCatById = new Map(
      (prevBucket?.categories ?? []).map((c) => [c.id, c]),
    )

    if (srcBucket.kind === "income") {
      const categories = srcBucket.categories.map((srcCat) => {
        nextCategoryIds.add(srcCat.id)
        const prevCat = prevCatById.get(srcCat.id)
        const recurrence = categoryRecurrence(srcCat)
        return {
          ...srcCat,
          allocations: {},
          ...(prevCat?.note !== undefined ? { note: prevCat.note } : {}),
          ...(recurrence
            ? {
                recurrence: {
                  ...recurrence,
                  startDate: `${year}-01-01`,
                  ends: { kind: "never" as const },
                },
              }
            : {}),
        }
      })
      return { ...srcBucket, categories }
    }

    if (srcBucket.kind === "totals") {
      const categories = srcBucket.categories.map((srcCat) => {
        nextCategoryIds.add(srcCat.id)
        return {
          ...srcCat,
          allocations: {},
          totalSources: srcCat.totalSources
            ? srcCat.totalSources.map((s) => ({ ...s }))
            : [],
        }
      })
      return { ...srcBucket, categories }
    }

    if (srcBucket.kind === "budget_calc") {
      const categories = srcBucket.categories.map((srcCat) => {
        nextCategoryIds.add(srcCat.id)
        return { ...srcCat, allocations: {} }
      })
      return { ...srcBucket, categories }
    }

    const categories = srcBucket.categories.map((srcCat) => {
      nextCategoryIds.add(srcCat.id)
      const prevCat = prevCatById.get(srcCat.id)
      const base: Category = {
        ...srcCat,
        allocations: {},
        ...(prevCat?.note !== undefined ? { note: prevCat.note } : {}),
      }
      delete base.comments

      if (srcBucket.kind === "savings") {
        return {
          ...base,
          // Continuous: this page’s carry-over is prior page’s ending cash.
          balance: endingSavingsBalance(source, srcCat),
          goal: srcCat.goal ?? prevCat?.goal ?? 0,
          allocations: prevCat
            ? preserveAllocationsOnPaychecks(prevCat, target.paychecks)
                .allocations
            : {},
        }
      }

      if (srcBucket.kind === "payback") {
        const withGoal: Category = {
          ...base,
          goal: endingPaybackGoal(source, srcCat),
        }
        if (prevCat) {
          const kept = preserveAllocationsOnPaychecks(prevCat, target.paychecks)
          return {
            ...withGoal,
            allocations: kept.allocations,
            ...(prevCat.comments ? { comments: { ...prevCat.comments } } : {}),
          }
        }
        return prefillExpenseCategory(withGoal, target.paychecks)
      }

      // spending / other: keep existing cells when present, else prefill
      if (prevCat) {
        const kept = preserveAllocationsOnPaychecks(prevCat, target.paychecks)
        return {
          ...base,
          allocations: kept.allocations,
          ...(prevCat.comments ? { comments: { ...prevCat.comments } } : {}),
        }
      }
      return prefillExpenseCategory(base, target.paychecks)
    })

    return { ...srcBucket, categories }
  })

  const incomeBucket = buckets.find((b) => b.kind === "income")
  let paychecks = target.paychecks.filter((p) =>
    p.date.startsWith(String(year)),
  )
  if (incomeBucket) {
    const generated = generatePaychecksFromIncomeBucket(incomeBucket, year)
    if (generated.length > 0) {
      const prevByDate = new Map(paychecks.map((p) => [p.date, p]))
      paychecks = generated.map((p) => {
        const old = prevByDate.get(p.date)
        return old
          ? { ...p, id: old.id, completed: old.completed }
          : p
      })
      const filledIncome = applyIncomeAllocations(incomeBucket, paychecks, {
        year,
      })
      buckets = buckets.map((b) =>
        b.id === filledIncome.id ? filledIncome : b,
      )
    }
  }

  const doneKeys = (target.doneKeys ?? []).filter((key) => {
    const categoryId = key.split("::")[0]
    return categoryId ? nextCategoryIds.has(categoryId) : true
  })
  const deposits = (target.deposits ?? []).filter((d) =>
    nextCategoryIds.has(d.categoryId),
  )
  const withdrawals = mergeWithdrawalsForward(
    source,
    target,
    nextCategoryIds,
  )

  return {
    ...target,
    paychecks,
    buckets,
    doneKeys,
    withdrawals,
    deposits,
    holderBalances: { ...source.holderBalances },
    jiTransferSources: source.jiTransferSources
      ? source.jiTransferSources.map((s) => ({ ...s }))
      : target.jiTransferSources,
    jiAccountSources: source.jiAccountSources
      ? source.jiAccountSources.map((s) => ({ ...s }))
      : target.jiAccountSources,
  }
}

/** Keep later-year history; carry open borrows forward from the prior page. */
function mergeWithdrawalsForward(
  source: YearBudget,
  target: YearBudget,
  nextCategoryIds: Set<string>,
): Withdrawal[] {
  const sourceById = new Map(
    (source.withdrawals ?? []).map((w) => [w.id, w] as const),
  )
  const out: Withdrawal[] = []
  const seen = new Set<string>()

  for (const w of target.withdrawals ?? []) {
    if (!nextCategoryIds.has(w.categoryId)) continue
    const src = sourceById.get(w.id)
    if (w.kind === "borrow" && !w.repaidAt && src?.repaidAt) {
      out.push({
        ...w,
        repaidAt: src.repaidAt,
        repaidDepositId: src.repaidDepositId,
      })
      seen.add(w.id)
      continue
    }
    out.push(w)
    seen.add(w.id)
  }

  for (const w of openBorrowsFrom(source)) {
    if (!nextCategoryIds.has(w.categoryId) || seen.has(w.id)) continue
    out.push(w)
    seen.add(w.id)
  }

  return out
}

/** Apply an amount to matching future paycheck slots in the active year and every later year. */
export function applyAmountForwardAcrossYears(
  workspace: BudgetWorkspace,
  categoryId: string,
  fromDate: string,
  value: number | "",
  applyInYear: (
    cat: Category,
    paychecks: YearBudget["paychecks"],
    fromDate: string,
    value: number | "",
  ) => Record<string, number | "">,
): BudgetWorkspace {
  const years = listYears(workspace).filter((y) => y >= workspace.activeYear)
  let next = workspace
  for (const y of years) {
    const key = String(y)
    const slice = next.years[key]
    if (!slice) continue
    next = {
      ...next,
      years: {
        ...next.years,
        [key]: {
          ...slice,
          buckets: slice.buckets.map((bucket) => ({
            ...bucket,
            categories: bucket.categories.map((cat) => {
              if (cat.id !== categoryId) return cat
              return {
                ...cat,
                allocations: applyInYear(
                  cat,
                  slice.paychecks,
                  fromDate,
                  value,
                ),
              }
            }),
          })),
        },
      },
    }
  }
  return next
}

export function nextYearToCreate(workspace: BudgetWorkspace): number {
  const years = listYears(workspace)
  const latest = years[years.length - 1] ?? workspace.startYear
  return latest + 1
}
