# Momentum Terminal — Minervini Trend-Template Screener

An interactive trading terminal for the **S&P 500 momentum screen** that
previously ran in the terminal and exported a spreadsheet (`ScreenOutput.xlsx`).
It reproduces Mark Minervini's **trend template** live from the cached price data
and turns it into candlestick charts, a live condition checklist, and adjustable
screen thresholds — all from **real numbers**, no fabrication.

## What it does

- **Screen + universe** — reproduces the screen for all ~500 S&P 500 names: RS
  rating (1-year-return percentile), SMA 50/150/200, 52-week range, and the
  8 trend-template conditions. Searchable / sortable / filterable table.
- **Live thresholds** — sliders for RS cutoff, % above 52-week low, and % below
  52-week high re-screen the whole universe in the browser (no rebuild).
- **Stock detail** — candlestick chart with SMA 50/150/200 overlays, 52-week
  high/low bands, a synced volume subchart, an RS gauge, and the 8 conditions
  shown pass/fail with the **real values** behind each rule.
- **Compare, watchlist, ticker tape** — overlay normalized returns of several
  stocks, star a localStorage watchlist, and scan top RS movers.

## Data pipeline

```
stock_screener.py        →  stockScreenerStocks/*.csv  →  build-data.mjs  →  data/  →  app
   (yfinance download)        (502 daily OHLCV CSVs)       (reproduces screen)
```

1. **Acquire data** (optional refresh) — from the project root:
   ```bash
   python stock_screener.py
   ```
   Downloads ~1 year of daily OHLCV per S&P 500 ticker into `stockScreenerStocks/`
   and writes `ScreenOutput.xlsx`.

2. **Run the app** (the precompute runs automatically before dev/build):
   ```bash
   cd screener-frontend
   npm install
   npm run dev          # http://localhost:3000
   ```
   `scripts/build-data.mjs` reads the CSVs and emits `data/screen.json` (all
   stocks + raw metrics) and `data/stocks/<TICKER>.json` (full series for charts).
   Re-run it any time with `npm run screen`.

The screen logic lives in one place — `lib/screen.ts` (mirrored by the precompute)
— so the defaults match `stock_screener.py` and the sliders re-use the exact same
evaluator.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Recharts 3
(custom candlesticks) · TypeScript.
