// Shared screen math — the single source of truth for SMAs, 52-week range, RS
// rating and the trend-template dataset. Imported by the precompute script, the
// blob seed script, and the daily cron route. No fs / no Node-only APIs so it
// can run in a Vercel Function.

import { evaluate, DEFAULT_PARAMS } from './screen'
import type { Screen, ScreenRow, SeriesPoint, StockDetail } from './data'

export interface Bar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Trailing simple moving average; null until `window` samples exist.
export function sma(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = round2(sum / window)
  }
  return out
}

// Downsample a numeric series to ~n evenly spaced points.
export function downsample(values: number[], n = 64): number[] {
  if (values.length <= n) return values.slice()
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    out.push(values[Math.round((i / (n - 1)) * (values.length - 1))])
  }
  return out
}

// Parse one ticker CSV ("Date,Close,High,Low,Open,Volume") into bars.
export function parseCsv(text: string): Bar[] {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].split(',')
  const idx: Record<string, number> = {}
  header.forEach((h, i) => (idx[h.trim()] = i))
  const rows: Bar[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',')
    const date = c[idx.Date]
    const close = parseFloat(c[idx.Close])
    const high = parseFloat(c[idx.High])
    const low = parseFloat(c[idx.Low])
    const open = parseFloat(c[idx.Open])
    const volume = parseFloat(c[idx.Volume])
    if (!date || Number.isNaN(close) || Number.isNaN(high) || Number.isNaN(low)) continue
    rows.push({ date, open, high, low, close, volume })
  }
  return rows
}

interface Computed {
  ticker: string
  metrics: Omit<ScreenRow, 'passes' | 'conditionsMet' | 'sparkline' | 'rsRating'> & { rsRating: number }
  series: SeriesPoint[]
  sparkline: number[]
  return1y: number
}

function computeOne(ticker: string, bars: Bar[]): Computed {
  const closes = bars.map((b) => b.close)
  const sma50 = sma(closes, 50)
  const sma150 = sma(closes, 150)
  const sma200 = sma(closes, 200)
  const n = bars.length
  const last = n - 1

  const currentClose = closes[last]
  const window52 = bars.slice(Math.max(0, n - 260))
  const low52 = round2(Math.min(...window52.map((b) => b.low)))
  const high52 = round2(Math.max(...window52.map((b) => b.high)))
  const sma200Prev = sma200[last - 20] ?? 0
  const return1y = round2((currentClose / closes[0] - 1) * 100)

  const metrics = {
    ticker,
    currentClose: round2(currentClose),
    sma50: sma50[last],
    sma150: sma150[last],
    sma200: sma200[last],
    sma200Prev,
    low52,
    high52,
    pctFromHigh: round2(((currentClose - high52) / high52) * 100),
    pctFromLow: round2(((currentClose - low52) / low52) * 100),
    return1y,
    avgVolume: Math.round(
      window52.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, window52.length),
    ),
    lastDate: bars[last].date,
    rsRating: 0, // filled in a second pass
  }

  const series: SeriesPoint[] = bars.map((b, i) => ({
    date: b.date,
    open: round2(b.open),
    high: round2(b.high),
    low: round2(b.low),
    close: round2(b.close),
    volume: b.volume,
    sma50: sma50[i],
    sma150: sma150[i],
    sma200: sma200[i],
  }))

  return { ticker, metrics, series, sparkline: downsample(closes).map(round2), return1y }
}

// Build the full published dataset (screen.json + per-ticker details) from raw
// bars keyed by ticker. Skips names without enough history for a 200-SMA.
export function buildDataset(barsByTicker: Record<string, Bar[]>): {
  screen: Screen
  stocks: Record<string, StockDetail>
} {
  const computed: Computed[] = []
  for (const [ticker, bars] of Object.entries(barsByTicker)) {
    if (!bars || bars.length < 200) continue
    if (bars.some((b) => Number.isNaN(b.close))) continue
    computed.push(computeOne(ticker, bars))
  }

  // RS rating = percentile rank of 1-year return across the universe (×100).
  const sortedReturns = computed.map((c) => c.return1y).sort((a, b) => a - b)
  const rank = (v: number) => {
    let lo = 0
    while (lo < sortedReturns.length && sortedReturns[lo] < v) lo++
    return round2((lo / (sortedReturns.length - 1)) * 100)
  }
  for (const c of computed) c.metrics.rsRating = rank(c.return1y)

  const stocks: Record<string, StockDetail> = {}
  const summary: ScreenRow[] = []
  for (const c of computed) {
    const { conditions, passes, met } = evaluate(c.metrics, DEFAULT_PARAMS)
    stocks[c.ticker] = {
      ticker: c.ticker,
      metrics: c.metrics as StockDetail['metrics'],
      conditions,
      passes,
      series: c.series,
    }
    summary.push({ ...c.metrics, passes, conditionsMet: met, sparkline: c.sparkline })
  }

  summary.sort((a, b) => b.rsRating - a.rsRating)

  const screen: Screen = {
    generatedAt: new Date().toISOString(),
    defaults: DEFAULT_PARAMS,
    count: summary.length,
    passing: summary.filter((s) => s.passes).length,
    stocks: summary,
  }
  return { screen, stocks }
}

// Append (or replace) a single daily bar on an existing ascending series.
export function appendBar(bars: Bar[], bar: Bar): Bar[] {
  if (bars.length && bars[bars.length - 1].date === bar.date) {
    return [...bars.slice(0, -1), bar]
  }
  return [...bars, bar]
}
