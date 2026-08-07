/** Move the item with `fromId` so it sits before `beforeId` (or at the end if null). */
export function reorderById<T extends { id: string }>(
  items: T[],
  fromId: string,
  beforeId: string | null,
): T[] {
  const from = items.findIndex((item) => item.id === fromId)
  if (from < 0) return items

  const next = [...items]
  const [item] = next.splice(from, 1)
  let to = beforeId ? next.findIndex((i) => i.id === beforeId) : next.length
  if (to < 0) to = next.length
  next.splice(to, 0, item)
  return next
}

/** True when inserting `fromId` before `beforeId` would not change order. */
export function isReorderNoOp(
  ids: string[],
  fromId: string,
  beforeId: string | null,
): boolean {
  const from = ids.indexOf(fromId)
  if (from < 0) return true
  const to = beforeId ? ids.indexOf(beforeId) : ids.length
  if (beforeId && to < 0) return true
  return to === from || to === from + 1
}
