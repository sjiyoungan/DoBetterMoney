export type UserRole = "liz" | "ji"

export type BucketKind = "spending" | "savings" | "holder" | "income"

export type PayFrequency = "weekly" | "biweekly" | "monthly"
export type CategoryVariability = "fixed" | "variable"

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
  variability?: CategoryVariability
  /** amount planned per paycheck date (ISO date -> amount) */
  allocations: Record<string, number | "">
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

export type BudgetWorkspace = {
  paychecks: Paycheck[]
  buckets: Bucket[]
  holderSplits: HolderSplit[]
  withdrawals: Withdrawal[]
  /** categoryId -> cash still held for Liz */
  holderBalances: Record<string, number>
}
