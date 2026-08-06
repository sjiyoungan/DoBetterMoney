export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidUsername(raw: string): boolean {
  const u = normalizeUsername(raw)
  return /^[a-z0-9_]{3,24}$/.test(u)
}
