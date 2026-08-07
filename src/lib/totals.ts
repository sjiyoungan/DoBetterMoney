import type { Bucket, Category, Paycheck, TotalSource } from "@/types/budget"

function allocationAt(cat: Category, date: string): number {
  const raw = cat.allocations[date]
  if (raw === "" || raw === undefined) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Resolve category IDs included by a total source within a bucket. */
export function resolveSourceCategoryIds(
  bucket: Bucket,
  source: TotalSource,
): string[] {
  const visible = bucket.categories.filter((c) => !c.hidden)
  if (source.categoryIds === "all") return visible.map((c) => c.id)
  const allowed = new Set(source.categoryIds)
  return visible.filter((c) => allowed.has(c.id)).map((c) => c.id)
}

/** Sum (with optional subtract) of configured sources for one paycheck date. */
export function computeTotalForDate(
  buckets: Bucket[],
  sources: TotalSource[] | undefined,
  date: string,
): number {
  if (!sources || sources.length === 0) return 0
  const byId = new Map(buckets.map((b) => [b.id, b]))
  let total = 0
  for (const source of sources) {
    const bucket = byId.get(source.bucketId)
    if (!bucket || bucket.kind === "totals") continue
    const ids = new Set(resolveSourceCategoryIds(bucket, source))
    let part = 0
    for (const cat of bucket.categories) {
      if (!ids.has(cat.id)) continue
      part += allocationAt(cat, date)
    }
    total += source.op === "subtract" ? -part : part
  }
  return total
}

export function computeTotalsRow(
  buckets: Bucket[],
  row: Category,
  paychecks: Paycheck[],
): number[] {
  return paychecks.map((p) =>
    computeTotalForDate(buckets, row.totalSources, p.date),
  )
}

export function formatSourcesSummary(
  buckets: Bucket[],
  sources: TotalSource[] | undefined,
): string {
  if (!sources || sources.length === 0) return "Select sources"
  const byId = new Map(buckets.map((b) => [b.id, b]))
  const parts: string[] = []
  for (const s of sources) {
    const bucket = byId.get(s.bucketId)
    if (!bucket) continue
    const sign = s.op === "subtract" ? "−" : ""
    if (s.categoryIds === "all") {
      parts.push(`${sign}${bucket.name}`)
    } else {
      const n = s.categoryIds.length
      parts.push(
        `${sign}${bucket.name} (${n} categor${n === 1 ? "y" : "ies"})`,
      )
    }
  }
  return parts.length > 0 ? parts.join(", ") : "Select sources"
}
