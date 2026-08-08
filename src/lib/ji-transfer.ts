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
