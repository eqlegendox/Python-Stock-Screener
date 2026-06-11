// Market-data provider abstraction. Concrete provider: Finnhub (/quote endpoint,
// real-time US equities, 60 req/min on the free tier). Swappable — only this
// module knows the provider. The API key never leaves the server (route handlers
// and the cron call these functions).

import { easternDate } from './market'
import type { Bar } from './compute'

export interface Quote {
  ticker: string
  price: number
  open: number
  high: number
  low: number
  prevClose: number
  changePct: number
  t: number // epoch seconds of the quote
}

const FINNHUB = 'https://finnhub.io/api/v1/quote'

export function isQuotesConfigured(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY)
}

// Run async tasks with bounded concurrency (respect the per-minute rate limit).
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

interface FinnhubQuote {
  c: number // current
  d: number | null // change
  dp: number | null // percent change
  h: number // high
  l: number // low
  o: number // open
  pc: number // previous close
  t: number // timestamp (s)
}

async function fetchOne(symbol: string, cacheSeconds: number): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  const url = `${FINNHUB}?symbol=${encodeURIComponent(symbol)}&token=${key}`
  try {
    const res = await fetch(url, cacheSeconds > 0 ? { next: { revalidate: cacheSeconds } } : { cache: 'no-store' })
    if (!res.ok) return null
    const q = (await res.json()) as FinnhubQuote
    if (!q || !q.c) return null // c === 0 means no data / invalid symbol
    return {
      ticker: symbol.toUpperCase(),
      price: q.c,
      open: q.o,
      high: q.h,
      low: q.l,
      prevClose: q.pc,
      changePct: q.dp ?? (q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0),
      t: q.t,
    }
  } catch {
    return null
  }
}

// Live quotes for the visible subset. Cached server-side (shared across viewers)
// for `cacheSeconds` so one upstream poll serves everyone.
export async function getQuotes(symbols: string[], cacheSeconds = 20): Promise<Record<string, Quote>> {
  if (!isQuotesConfigured() || !symbols.length) return {}
  const results = await pool(symbols, 8, (s) => fetchOne(s, cacheSeconds))
  const map: Record<string, Quote> = {}
  for (const q of results) if (q) map[q.ticker] = q
  return map
}

// Latest daily bar per symbol, for the cron append. Always fresh (no cache).
// Finnhub /quote lacks volume, so the appended bar carries volume 0 (a display-
// only stat; conditions don't use it).
export async function getDailyBars(symbols: string[]): Promise<Record<string, Bar>> {
  if (!isQuotesConfigured() || !symbols.length) return {}
  const date = easternDate()
  const results = await pool(symbols, 8, (s) => fetchOne(s, 0))
  const map: Record<string, Bar> = {}
  for (const q of results) {
    if (!q) continue
    map[q.ticker] = { date, open: q.open, high: q.high, low: q.low, close: q.price, volume: 0 }
  }
  return map
}
