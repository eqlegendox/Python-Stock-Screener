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

## Real-time updates

Two tiers of freshness (both optional — without keys the app serves the committed
snapshot and the daily close):

- **Daily screen refresh** — a Vercel Cron (`vercel.json`, weekday 21:30 UTC) hits
  `/api/cron/refresh`, which appends today's bar for every name, recomputes the
  whole screen, republishes to Vercel Blob, and revalidates the cache. Uses Twelve
  Data's batch `/quote` for the daily bars.
- **Live intraday price** — during market hours the dashboard polls `/api/quotes`
  for the visible tickers (and the detail page for its symbol) every ~45s and
  re-checks the price-based conditions live. Uses Finnhub. Provider code is
  isolated in `lib/quotes.ts`.

The dataset lives in **Vercel Blob** in production (`lib/store.ts`) because the
serverless filesystem is read-only; `lib/data.ts` falls back to the committed
`data/*.json` locally.

### Environment

See `.env.example`. Get free keys from [finnhub.io](https://finnhub.io) and
[twelvedata.com](https://twelvedata.com). Free tiers are rate-limited, so live
quotes are capped to the visible subset, shared via a ~20s server cache, and only
polled during US market hours with the tab visible. Free feeds may be ~15 min
delayed.

### Deploy

```bash
npm i -g vercel
vercel link                       # in screener-frontend/
# create a Blob store in the Vercel dashboard (Storage → Blob) → BLOB_READ_WRITE_TOKEN
vercel env add FINNHUB_API_KEY
vercel env add TWELVEDATA_API_KEY
vercel env add CRON_SECRET
vercel env pull .env.local        # for local dev
npm run seed                      # one-time: upload the dataset to Blob
vercel deploy                     # preview → verify → `vercel deploy --prod`
```

Manually trigger a refresh:
`curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/refresh`

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Recharts 3
(custom candlesticks) · TypeScript · Vercel Blob + Cron.
