export type UserRole = "liz" | "ji"

export type BucketKind =
  | "spending"
  | "savings"
  | "holder"
  | "income"
  | "totals"
  | "budget_calc"

export type PayFrequency = "weekly" | "biweekly" | "monthly"
export type CategoryVariability = "fixed" | "variable"

export type RecurrenceUnit = "day" | "week" | "month" | "year"

export type RecurrenceEnds =
  | { kind: "never" }
  | { kind: "on"; date: string }
  | { kind: "after"; count: number }

/** Google-style custom recurrence for income pay schedules. */
export type IncomeRecurrence = {
  interval: number
  unit: RecurrenceUnit
  /** Sunday=0 … Saturday=6; used when unit is week */
  weekdays: number[]
  /** 1–31, or -1 for last day of month; used when unit is month */
  monthDays: number[]
  /** ISO date — series starts on/after this day */
  startDate: string
  ends: RecurrenceEnds
}

/**
 * One group included in a Totals row.
 * `categoryIds: "all"` sums every visible category in the group;
 * otherwise only the listed category IDs.
 */
export type TotalSource = {
  bucketId: string
  categoryIds: "all" | string[]
}

export type Category = {
  id: string
  name: string
  /** Day of month (1–31) for expense due dates */
  dueDay?: number
  /** @deprecated prefer dueDay */
  dueDate?: string
  balance?: number
  minPayment?: number
  /** Payment (expenses) or income amount */
  amount?: number
  /** For savings / payback goals */
  goal?: number
  totalSaved?: number
  /** Recurring default amount per paycheck (auto-fills, editable per week) */
  recurringAmount?: number
  isRecurring?: boolean
  frequency?: PayFrequency
  /** Income pay schedule (drives calendar columns) */
  recurrence?: IncomeRecurrence
  variability?: CategoryVariability
  /** When true, category stays in data but is hidden from the main grid */
  hidden?: boolean
  /** amount planned per paycheck date (ISO date -> amount) */
  allocations: Record<string, number | "">
  /** Totals rows: which groups/categories to include in the per-paycheck sum */
  totalSources?: TotalSource[]
}

export type Bucket = {
  id: string
  name: string
  note?: string
  kind: BucketKind
  categories: Category[]
}

export type Paycheck = {
  id: string
  date: string
  income: number
  /** past paychecks that were completed / "greened" */
  completed: boolean
}

export type HolderSplit = {
  paycheckId: string
  totalToJi: number
  keepInBoa: number
  transferToSofi: number
  boaMoved: boolean
  sofiMoved: boolean
  received: boolean
}

export type Withdrawal = {
  id: string
  date: string
  amount: number
  categoryId: string
  note?: string
}

/** One calendar year's budget grid data */
export type YearBudget = {
  paychecks: Paycheck[]
  buckets: Bucket[]
  holderSplits: HolderSplit[]
  withdrawals: Withdrawal[]
  /** categoryId -> cash still held for Liz */
  holderBalances: Record<string, number>
  doneKeys: string[]
}

/**
 * Multi-year workspace. Each year is its own page/slice.
 * Legacy flat workspaces are normalized on load.
 */
export type BudgetWorkspace = {
  /** Year the account/workspace started */
  startYear: number
  /** Year currently shown */
  activeYear: number
  years: Record<string, YearBudget>
}
