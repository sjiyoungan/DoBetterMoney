import type { BudgetWorkspace } from "@/types/budget"

/** Blank workspace for new accounts */
export const emptyWorkspace: BudgetWorkspace = {
  paychecks: [],
  buckets: [],
  holderSplits: [],
  withdrawals: [],
  holderBalances: {},
}
