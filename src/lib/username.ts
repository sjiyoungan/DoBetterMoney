/** Supabase Auth requires an email; we map username → synthetic address. */
const USERNAME_EMAIL_DOMAIN = "users.dobettermoney.local"

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,32}$/.test(username)
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`
}

export function emailToUsername(email: string | null | undefined): string | null {
  if (!email) return null
  const suffix = `@${USERNAME_EMAIL_DOMAIN}`
  if (email.toLowerCase().endsWith(suffix)) {
    return email.slice(0, -suffix.length)
  }
  return email.split("@")[0] ?? null
}

export function usernameValidationError(raw: string): string | null {
  const username = normalizeUsername(raw)
  if (username.length < 3) return "Username must be at least 3 characters."
  if (username.length > 32) return "Username must be 32 characters or fewer."
  if (!isValidUsername(username)) {
    return "Use letters, numbers, and underscores only."
  }
  return null
}
