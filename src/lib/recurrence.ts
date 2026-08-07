import type { IncomeRecurrence, PayFrequency, RecurrenceEnds } from "@/types/budget"

const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function resolveMonthDay(year: number, monthIndex: number, day: number) {
  if (day === -1) return daysInMonth(year, monthIndex)
  return Math.min(day, daysInMonth(year, monthIndex))
}

function ordinal(n: number) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}

export function todayIso() {
  return toIsoDate(new Date())
}

export function defaultRecurrence(anchor = todayIso()): IncomeRecurrence {
  return {
    interval: 1,
    unit: "month",
    weekdays: [],
    monthDays: [],
    startDate: anchor,
    ends: { kind: "never" },
  }
}

/** Map legacy weekly / biweekly / monthly into the new recurrence shape. */
export function legacyFrequencyToRecurrence(
  frequency: PayFrequency,
  anchor = todayIso(),
): IncomeRecurrence {
  const d = parseIsoDate(anchor)
  if (frequency === "weekly") {
    return {
      interval: 1,
      unit: "week",
      weekdays: [d.getDay()],
      monthDays: [d.getDate()],
      startDate: anchor,
      ends: { kind: "never" },
    }
  }
  if (frequency === "biweekly") {
    return {
      interval: 2,
      unit: "week",
      weekdays: [d.getDay()],
      monthDays: [d.getDate()],
      startDate: anchor,
      ends: { kind: "never" },
    }
  }
  return {
    interval: 1,
    unit: "month",
    weekdays: [d.getDay()],
    monthDays: [d.getDate()],
    startDate: anchor,
    ends: { kind: "never" },
  }
}

export function isRecurrenceComplete(r: IncomeRecurrence | null | undefined) {
  if (!r || r.interval < 1) return false
  if (r.unit === "week") return r.weekdays.length > 0
  if (r.unit === "month") return r.monthDays.length > 0
  return true
}

export function formatRecurrenceSummary(r: IncomeRecurrence): string {
  const n = r.interval

  if (r.unit === "week") {
    const days = [...r.weekdays]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LONG[d])
    const dayPart =
      days.length === 0
        ? ""
        : days.length === 1
          ? ` on ${days[0]}`
          : ` on ${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`
    return n === 1 ? `Every week${dayPart}` : `Every ${n} weeks${dayPart}`
  }

  if (r.unit === "month") {
    const labels = [...r.monthDays]
      .sort((a, b) => {
        if (a === -1) return 1
        if (b === -1) return -1
        return a - b
      })
      .map((d) => (d === -1 ? "last day" : ordinal(d)))
    const dayPart =
      labels.length === 0
        ? ""
        : labels.length === 1
          ? ` on the ${labels[0]}`
          : ` on the ${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`
    return `Monthly${dayPart}`
  }

  if (r.unit === "day") {
    return n === 1 ? "Every day" : `Every ${n} days`
  }

  const start = parseIsoDate(r.startDate)
  const month = start.toLocaleString("en-US", { month: "short" })
  return n === 1
    ? `Annually on ${month} ${start.getDate()}`
    : `Every ${n} years on ${month} ${start.getDate()}`
}

function withinEnds(iso: string, ends: RecurrenceEnds, countSoFar: number) {
  if (ends.kind === "never") return true
  if (ends.kind === "on") return iso <= ends.date
  return countSoFar < ends.count
}

/**
 * Generate occurrence dates for a recurrence rule.
 * Pass `year` to clamp strictly to Jan 1–Dec 31 of that year.
 */
export function generateRecurrenceDates(
  rule: IncomeRecurrence,
  opts?: { maxCount?: number; horizonMonths?: number; year?: number },
): string[] {
  if (!isRecurrenceComplete(rule)) return []

  const year = opts?.year
  const yearStart = year !== undefined ? `${year}-01-01` : null
  const yearEnd = year !== undefined ? `${year}-12-31` : null

  const rangeStartIso =
    yearStart && yearStart > rule.startDate ? yearStart : rule.startDate
  const start = parseIsoDate(rangeStartIso)

  let endIso: string
  let maxCount: number
  if (yearEnd) {
    endIso = yearEnd
    maxCount = opts?.maxCount ?? 400
  } else {
    const horizonMonths = opts?.horizonMonths ?? 14
    maxCount = opts?.maxCount ?? 24
    const endHorizon = new Date(parseIsoDate(rule.startDate))
    endHorizon.setMonth(endHorizon.getMonth() + horizonMonths)
    endIso = toIsoDate(endHorizon)
  }

  const out: string[] = []

  const push = (d: Date) => {
    const iso = toIsoDate(d)
    if (iso < rangeStartIso) return
    if (yearStart && iso < yearStart) return
    if (iso > endIso) return
    if (!withinEnds(iso, rule.ends, out.length)) return
    if (out[out.length - 1] === iso) return
    out.push(iso)
  }

  if (rule.unit === "day") {
    const cursor = new Date(start)
    while (out.length < maxCount && toIsoDate(cursor) <= endIso) {
      if (!withinEnds(toIsoDate(cursor), rule.ends, out.length)) break
      push(cursor)
      cursor.setDate(cursor.getDate() + rule.interval)
    }
    return out.slice(0, maxCount)
  }

  if (rule.unit === "week") {
    const weekdays = [...new Set(rule.weekdays)].sort((a, b) => a - b)
    // Anchor interval grid to the week of the rule's original startDate
    const anchor = parseIsoDate(rule.startDate)
    const startWeekMonday = new Date(anchor)
    const dow = startWeekMonday.getDay()
    startWeekMonday.setDate(startWeekMonday.getDate() - ((dow + 6) % 7))

    const cursor = new Date(start)
    while (out.length < maxCount && toIsoDate(cursor) <= endIso) {
      if (!withinEnds(toIsoDate(cursor), rule.ends, out.length)) break
      if (weekdays.includes(cursor.getDay())) {
        const weekStart = new Date(cursor)
        const cDow = weekStart.getDay()
        weekStart.setDate(weekStart.getDate() - ((cDow + 6) % 7))
        const weeksBetween = Math.round(
          (weekStart.getTime() - startWeekMonday.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        )
        if (weeksBetween >= 0 && weeksBetween % rule.interval === 0) {
          push(new Date(cursor))
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return out.slice(0, maxCount)
  }

  if (rule.unit === "month") {
    const days = [...new Set(rule.monthDays)]
    let y = start.getFullYear()
    let month = start.getMonth()
    let guard = 0
    while (out.length < maxCount && guard < 400) {
      guard += 1
      if (year !== undefined && y > year) break
      const monthOffset =
        (y - parseIsoDate(rule.startDate).getFullYear()) * 12 +
        (month - parseIsoDate(rule.startDate).getMonth())
      if (monthOffset >= 0 && monthOffset % rule.interval === 0) {
        const dates = days
          .map((day) => {
            const dom = resolveMonthDay(y, month, day)
            return new Date(y, month, dom, 12, 0, 0, 0)
          })
          .sort((a, b) => a.getTime() - b.getTime())
        for (const d of dates) {
          if (out.length >= maxCount) break
          if (!withinEnds(toIsoDate(d), rule.ends, out.length)) {
            return out
          }
          push(d)
        }
      }
      month += 1
      if (month > 11) {
        month = 0
        y += 1
      }
      if (toIsoDate(new Date(y, month, 1, 12)) > endIso) break
    }
    return out.slice(0, maxCount)
  }

  // year unit
  const cursor = new Date(start)
  while (out.length < maxCount && toIsoDate(cursor) <= endIso) {
    if (!withinEnds(toIsoDate(cursor), rule.ends, out.length)) break
    push(new Date(cursor))
    cursor.setFullYear(cursor.getFullYear() + rule.interval)
  }
  return out.slice(0, maxCount)
}

export { WEEKDAY_SHORT, WEEKDAY_LONG, toIsoDate, parseIsoDate }
