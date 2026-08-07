import { supabase } from "@/lib/supabase"

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/** Clock skew / stale JWT — usually clears after refreshing the session. */
export function isAuthClockSkewError(error: unknown): boolean {
  const msg = errorMessage(error)
  return /JWT issued at future|issued at future|token is not yet valid|invalid JWT/i.test(
    msg,
  )
}

/**
 * Run a Supabase data call; on JWT clock-skew errors, refresh the session once and retry.
 */
export async function withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isAuthClockSkewError(error)) throw error

    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw error

    // Brief pause so refreshed iat isn't still ahead of server time
    await new Promise((r) => setTimeout(r, 400))
    return await operation()
  }
}
