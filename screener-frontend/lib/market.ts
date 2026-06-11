// US equity regular-trading-hours check (Mon–Fri, 9:30–16:00 America/New_York).
// Holidays are not accounted for — close enough to gate live polling, and a
// no-data quote simply falls back to the last daily close.

export function isMarketOpen(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const weekday = get('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return false

  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0 // some runtimes emit "24" for midnight
  const minute = parseInt(get('minute'), 10)
  const mins = hour * 60 + minute
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}

// ET calendar date (YYYY-MM-DD) for a timestamp — used to date appended bars.
export function easternDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
