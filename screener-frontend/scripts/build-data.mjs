// Precompute the Minervini trend-template screen from the cached OHLCV CSVs.
// Reproduces the logic of ../../stock_screener.py in JS so the frontend shows
// genuine numbers (SMAs, 52w range, RS rating, the 7+RS conditions) with zero
// fabrication. Emits data/screen.json (all stocks, summary + raw metrics) and
// data/stocks/<TICKER>.json (full daily series for candlestick charts).
//
//   node scripts/build-data.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSV_DIR = join(ROOT, '..', 'stockScreenerStocks')
const DATA_DIR = join(ROOT, 'data')
const STOCKS_DIR = join(DATA_DIR, 'stocks')

// Default Minervini thresholds (mirror stock_screener.py).
const DEFAULTS = { rsCutoff: 70, minPctAboveLow: 30, maxPctBelowHigh: 25 }

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].split(',')
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',')
    const date = c[idx.Date]
    const close = parseFloat(c[idx.Close])
    const high = parseFloat(c[idx.High])
    const low = parseFloat(c[idx.Low])
    const open = parseFloat(c[idx.Open])
    const volume = parseFloat(c[idx.Volume])
    // Skip malformed / non-numeric rows (yfinance occasionally emits header echoes).
    if (!date || Number.isNaN(close) || Number.isNaN(high) || Number.isNaN(low)) continue
    rows.push({ date, open, high, low, close, volume })
  }
  return rows
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// Trailing simple moving average; null until `window` samples exist.
function sma(values, window) {
  const out = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = round2(sum / window)
  }
  return out
}

// Downsample a numeric series to ~n evenly spaced points.
function downsample(values, n = 64) {
  if (values.length <= n) return values.slice()
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(values[Math.round((i / (n - 1)) * (values.length - 1))])
  }
  return out
}

// The trend template, parameterized. Single source of truth (mirrored in lib/screen.ts).
function evaluate(m, p = DEFAULTS) {
  const c = {
    priceAboveMa150Ma200: m.currentClose > m.sma150 && m.sma150 > m.sma200,
    ma150AboveMa200: m.sma150 > m.sma200,
    ma200TrendingUp: m.sma200 > m.sma200Prev,
    maStacked: m.sma50 > m.sma150 && m.sma150 > m.sma200,
    priceAboveMa50: m.currentClose > m.sma50,
    aboveLow: m.currentClose >= (1 + p.minPctAboveLow / 100) * m.low52,
    nearHigh: m.currentClose >= (1 - p.maxPctBelowHigh / 100) * m.high52,
    rsRating: m.rsRating >= p.rsCutoff,
  }
  const conditions = Object.values(c)
  return { conditions: c, passes: conditions.every(Boolean) }
}

function buildStock(ticker, rows) {
  const closes = rows.map((r) => r.close)
  const sma50 = sma(closes, 50)
  const sma150 = sma(closes, 150)
  const sma200 = sma(closes, 200)
  const n = rows.length
  const last = n - 1

  const currentClose = closes[last]
  const window52 = rows.slice(Math.max(0, n - 260))
  const low52 = round2(Math.min(...window52.map((r) => r.low)))
  const high52 = round2(Math.max(...window52.map((r) => r.high)))
  const sma200Prev = sma200[last - 20] ?? 0

  const metrics = {
    currentClose: round2(currentClose),
    sma50: sma50[last],
    sma150: sma150[last],
    sma200: sma200[last],
    sma200Prev,
    low52,
    high52,
    pctFromHigh: round2(((currentClose - high52) / high52) * 100),
    pctFromLow: round2(((currentClose - low52) / low52) * 100),
    return1y: round2((currentClose / closes[0] - 1) * 100),
    avgVolume: Math.round(window52.slice(-20).reduce((s, r) => s + r.volume, 0) / Math.min(20, window52.length)),
    lastDate: rows[last].date,
  }

  const series = rows.map((r, i) => ({
    date: r.date,
    open: round2(r.open),
    high: round2(r.high),
    low: round2(r.low),
    close: round2(r.close),
    volume: r.volume,
    sma50: sma50[i],
    sma150: sma150[i],
    sma200: sma200[i],
  }))

  return { ticker, metrics, series, sparkline: downsample(closes).map(round2) }
}

function main() {
  const files = readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv'))
  console.log(`Reading ${files.length} CSVs from ${CSV_DIR}`)

  const stocks = []
  for (const file of files) {
    const ticker = file.replace(/\.csv$/, '')
    const rows = parseCsv(readFileSync(join(CSV_DIR, file), 'utf-8'))
    if (rows.length < 200) continue // need enough history for a 200-SMA
    if (rows.some((r) => Number.isNaN(r.close))) continue
    stocks.push(buildStock(ticker, rows))
  }

  // RS rating = percentile rank of 1-year return across the universe (×100).
  const sortedReturns = stocks.map((s) => s.metrics.return1y).sort((a, b) => a - b)
  const rank = (v) => {
    // fraction of stocks with a strictly smaller return
    let lo = 0
    while (lo < sortedReturns.length && sortedReturns[lo] < v) lo++
    return round2((lo / (sortedReturns.length - 1)) * 100)
  }
  for (const s of stocks) s.metrics.rsRating = rank(s.metrics.return1y)

  // Reset output dirs.
  rmSync(STOCKS_DIR, { recursive: true, force: true })
  mkdirSync(STOCKS_DIR, { recursive: true })

  const summary = []
  for (const s of stocks) {
    const { conditions, passes } = evaluate(s.metrics)
    const conditionsMet = Object.values(conditions).filter(Boolean).length

    writeFileSync(
      join(STOCKS_DIR, `${s.ticker}.json`),
      JSON.stringify({ ticker: s.ticker, metrics: s.metrics, conditions, passes, series: s.series }),
    )

    summary.push({
      ticker: s.ticker,
      ...s.metrics,
      passes,
      conditionsMet,
      sparkline: s.sparkline,
    })
  }

  summary.sort((a, b) => b.rsRating - a.rsRating)
  const passing = summary.filter((s) => s.passes).length

  writeFileSync(
    join(DATA_DIR, 'screen.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      defaults: DEFAULTS,
      count: summary.length,
      passing,
      stocks: summary,
    }),
  )

  console.log(`Wrote screen.json (${summary.length} stocks, ${passing} passing) + ${summary.length} per-ticker files`)
}

main()
