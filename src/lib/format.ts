export function formatMoney(value: number | "" | undefined) {
  if (value === "" || value === undefined || Number.isNaN(Number(value))) {
    return "—"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export function formatPayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function allocationKey(categoryId: string, paycheckId: string) {
  return `${categoryId}::${paycheckId}`
}
