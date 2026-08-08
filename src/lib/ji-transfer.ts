import { allocationKey } from "@/lib/format"
import type {
  Bucket,
  Category,
  JiTransferLog,
  JiTransferSource,
  Paycheck,
  TotalSource,
} from "@/types/budget"

export type TransferRow = {
  categoryId: string
  categoryName: string
  amount: number
}

function allocationAmount(cat: Category, date: string): number {
  const raw = cat.allocations[date]
  if (raw === "" || raw === undefined) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Categories included by Totals-style sources (spending + savings only). */
export function resolveTransferCategoryIds(
  buckets: Bucket[],
  sources: JiTransferSource[] | undefined,
): Set<string> | null {
  const eligible = buckets.filter(
    (b) => b.kind === "spending" || b.kind === "savings",
  )
  if (!sources || sources.length === 0) {
    // null = all eligible categories
    return null
  }
  const ids = new Set<string>()
  for (const source of sources) {
    const bucket = eligible.find((b) => b.id === source.bucketId)
    if (!bucket) continue
    if (source.categoryIds === "all") {
      for (const cat of bucket.categories) {
        if (!cat.hidden) ids.add(cat.id)
      }
    } else {
      for (const id of source.categoryIds) ids.add(id)
    }
  }
  return ids
}

export function categoryAllowed(
  cat: Category,
  allowed: Set<string> | null,
): boolean {
  if (cat.hidden) return false
  if (allowed === null) return true
  return allowed.has(cat.id)
}

function activeConfirmations(log: JiTransferLog[] | undefined) {
  return (log ?? []).filter((e) => !e.undoneAt)
}

/** Liz-checked amounts for a paycheck that Ji has not confirmed yet. */
export function transferRowsForPaycheck(
  buckets: Bucket[],
  paycheck: Paycheck,
  doneKeys: ReadonlySet<string>,
  sources: JiTransferSource[] | undefined,
  log: JiTransferLog[] | undefined,
): TransferRow[] {
  const allowed = resolveTransferCategoryIds(buckets, sources)
  const confirmed = new Set(
    activeConfirmations(log)
      .filter((e) => e.paycheckId === paycheck.id)
      .flatMap((e) => e.categoryIds),
  )

  const rows: TransferRow[] = []
  for (const bucket of buckets) {
    if (bucket.kind !== "spending" && bucket.kind !== "savings") continue
    for (const cat of bucket.categories) {
      if (!categoryAllowed(cat, allowed)) continue
      const amount = allocationAmount(cat, paycheck.date)
      if (amount === 0) continue
      const key = allocationKey(cat.id, paycheck.id)
      if (!doneKeys.has(key)) continue
      if (confirmed.has(cat.id)) continue
      rows.push({
        categoryId: cat.id,
        categoryName: cat.name,
        amount,
      })
    }
  }
  return rows
}

/**
 * Paychecks with Liz-checked put-away amounts waiting on Ji.
 * Includes past + upcoming; paychecks after the upcoming column are excluded.
 */
export function pendingTransferPaychecks(
  paychecks: Paycheck[],
  buckets: Bucket[],
  doneKeys: ReadonlySet<string>,
  sources: JiTransferSource[] | undefined,
  log: JiTransferLog[] | undefined,
  today = new Date().toISOString().slice(0, 10),
): Paycheck[] {
  const upcomingIndex = paychecks.findIndex(
    (p) => !p.completed && p.date >= today,
  )
  const fallbackIndex = paychecks.findIndex((p) => !p.completed)
  const cutoff =
    upcomingIndex >= 0
      ? upcomingIndex
      : fallbackIndex >= 0
        ? fallbackIndex
        : paychecks.length - 1

  return paychecks
    .filter((_, i) => i <= cutoff)
    .filter(
      (p) =>
        transferRowsForPaycheck(buckets, p, doneKeys, sources, log).length > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function sourceBucketsForJi(buckets: Bucket[]): Bucket[] {
  return buckets.filter(
    (b) =>
      (b.kind === "spending" || b.kind === "savings") &&
      b.categories.some((c) => !c.hidden),
  )
}

export function normalizeJiSources(
  sources: TotalSource[] | undefined,
): JiTransferSource[] {
  return sources ? sources.map((s) => ({ ...s })) : []
}

function carryOverAt(cat: Category): number {
  const n = cat.balance
  return typeof n === "number" && Number.isFinite(n) ? n : 0
}

/**
 * Money in the account per savings category:
 * carry-over + amounts Ji has confirmed with Done (not Liz checkmarks).
 */
export function accountCategoryBalances(
  buckets: Bucket[],
  log: JiTransferLog[] | undefined,
): { id: string; name: string; amount: number }[] {
  const confirmedByCategory = new Map<string, number>()
  for (const entry of activeConfirmations(log)) {
    for (const categoryId of entry.categoryIds) {
      let cat: Category | undefined
      for (const bucket of buckets) {
        cat = bucket.categories.find((c) => c.id === categoryId)
        if (cat) break
      }
      if (!cat) continue
      const amt = allocationAmount(cat, entry.paycheckDate)
      confirmedByCategory.set(
        categoryId,
        (confirmedByCategory.get(categoryId) ?? 0) + amt,
      )
    }
  }

  const rows: { id: string; name: string; amount: number }[] = []
  for (const bucket of buckets) {
    if (bucket.kind !== "savings") continue
    for (const cat of bucket.categories) {
      if (cat.hidden) continue
      rows.push({
        id: cat.id,
        name: cat.name,
        amount: carryOverAt(cat) + (confirmedByCategory.get(cat.id) ?? 0),
      })
    }
  }
  return rows
}

export function accountTotalBalance(
  buckets: Bucket[],
  log: JiTransferLog[] | undefined,
): number {
  return accountCategoryBalances(buckets, log).reduce(
    (sum, row) => sum + row.amount,
    0,
  )
}
