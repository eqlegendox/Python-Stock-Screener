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

// Latest daily bar per symbol, for the cron append. Prefers Twelve Data's batch
// /quote (up to 120 symbols/call → the whole universe in a handful of calls,
// well within one function invocation). Falls back to Finnhub per-symbol when
// only that key is set. volume comes through when the provider supplies it.
const TWELVEDATA = 'https://api.twelvedata.com/quote'

export async function getDailyBars(symbols: string[]): Promise<Record<string, Bar>> {
  if (!symbols.length) return {}
  const date = easternDate()
  const tdKey = process.env.TWELVEDATA_API_KEY

  if (tdKey) {
    const map: Record<string, Bar> = {}
    const CHUNK = 100
    for (let i = 0; i < symbols.length; i += CHUNK) {
      const chunk = symbols.slice(i, i + CHUNK)
      try {
        const url = `${TWELVEDATA}?symbol=${chunk.join(',')}&apikey=${tdKey}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) continue
        const json = (await res.json()) as Record<string, TdQuote> | TdQuote
        // One symbol returns a bare object; many return a map keyed by symbol.
        const entries = chunk.length === 1 ? { [chunk[0]]: json as TdQuote } : (json as Record<string, TdQuote>)
        for (const [sym, q] of Object.entries(entries)) {
          const bar = tdToBar(q, date)
          if (bar) map[sym.toUpperCase()] = bar
        }
      } catch {
        /* skip chunk */
      }
    }
    return map
  }

  // Fallback: Finnhub per-symbol (no volume).
  if (!isQuotesConfigured()) return {}
  const results = await pool(symbols, 8, (s) => fetchOne(s, 0))
  const map: Record<string, Bar> = {}
  for (const q of results) {
    if (q) map[q.ticker] = { date, open: q.open, high: q.high, low: q.low, close: q.price, volume: 0 }
  }
  return map
}

interface TdQuote {
  symbol?: string
  open?: string
  high?: string
  low?: string
  close?: string
  volume?: string
  status?: string
}

function tdToBar(q: TdQuote, date: string): Bar | null {
  const close = parseFloat(q.close ?? '')
  const high = parseFloat(q.high ?? '')
  const low = parseFloat(q.low ?? '')
  const open = parseFloat(q.open ?? '')
  if (Number.isNaN(close) || Number.isNaN(high) || Number.isNaN(low)) return null
  return {
    date,
    open: Number.isNaN(open) ? close : open,
    high,
    low,
    close,
    volume: parseFloat(q.volume ?? '0') || 0,
  }
}
