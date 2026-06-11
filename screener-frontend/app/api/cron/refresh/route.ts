import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { isBlobConfigured, readScreenFresh, readAllDetailsFresh, writeDataset, SCREEN_TAG } from '@/lib/store'
import { getDailyBars } from '@/lib/quotes'
import { buildDataset, appendBar, type Bar } from '@/lib/compute'
import type { SeriesPoint } from '@/lib/data'

// Daily refresh: append today's bar to every series, recompute the whole screen,
// republish to Blob, and revalidate the cache tag. Triggered by Vercel Cron
// (which sends `Authorization: Bearer $CRON_SECRET`) or a manual call with the
// same header. RS rating is universe-wide, so this recomputes globally.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function seriesToBars(series: SeriesPoint[]): Bar[] {
  return series.map((p) => ({
    date: p.date,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    volume: p.volume,
  }))
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  if (!isBlobConfigured()) {
    return NextResponse.json({ error: 'blob not configured' }, { status: 500 })
  }

  const started = Date.now()
  const screen = await readScreenFresh()
  if (!screen) return NextResponse.json({ error: 'no seed dataset in blob' }, { status: 409 })

  const tickers = screen.stocks.map((s) => s.ticker)
  const details = await readAllDetailsFresh(tickers)
  const newBars = await getDailyBars(tickers)

  const barsByTicker: Record<string, Bar[]> = {}
  let appended = 0
  for (const ticker of tickers) {
    const detail = details[ticker]
    if (!detail) continue
    let bars = seriesToBars(detail.series)
    const fresh = newBars[ticker]
    if (fresh) {
      bars = appendBar(bars, fresh)
      appended++
    }
    barsByTicker[ticker] = bars
  }

  const { screen: nextScreen, stocks } = buildDataset(barsByTicker)
  await writeDataset(nextScreen, stocks)
  revalidateTag(SCREEN_TAG, 'max')

  return NextResponse.json({
    ok: true,
    tickers: tickers.length,
    quotesFetched: Object.keys(newBars).length,
    appended,
    passing: nextScreen.passing,
    asOf: nextScreen.generatedAt,
    ms: Date.now() - started,
  })
}
