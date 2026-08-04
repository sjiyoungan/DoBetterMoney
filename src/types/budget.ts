export type UserRole = "liz" | "ji"

export type BucketKind = "spending" | "savings" | "holder"

export type Category = {
  id: string
  name: string
  dueDate?: string
  balance?: number
  minPayment?: number
  /** For savings / payback goals */
  goal?: number
  totalSaved?: number
  /** Recurring default amount per paycheck (auto-fills, editable per week) */
  recurringAmount?: number
  isRecurring?: boolean
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
