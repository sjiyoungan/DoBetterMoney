import type { BudgetWorkspace, YearBudget } from "@/types/budget"

export function emptyYearBudget(): YearBudget {
  return {
    paychecks: [],
    buckets: [],
    holderSplits: [],
    withdrawals: [],
    holderBalances: {},
    doneKeys: [],
  }
}

/** Blank multi-year workspace for new accounts */
export function createEmptyWorkspace(year = new Date().getFullYear()): BudgetWorkspace {
  return {
    startYear: year,
    activeYear: year,
    years: {
      [String(year)]: emptyYearBudget(),
    },
  }
}

/** @deprecated use createEmptyWorkspace — kept for call sites during migration */
export const emptyWorkspace: BudgetWorkspace = createEmptyWorkspace()
