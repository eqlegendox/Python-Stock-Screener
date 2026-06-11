import { NextResponse } from 'next/server'
import { getQuotes } from '@/lib/quotes'

// GET /api/quotes?symbols=AAPL,NVDA,MSFT
// Returns a compact { ticker: {price, changePct, ...} } map. Upstream calls are
// cached ~20s server-side (see lib/quotes) so all viewers share one poll.
export const dynamic = 'force-dynamic'

const MAX_SYMBOLS = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = (searchParams.get('symbols') ?? '').trim()
  if (!raw) return NextResponse.json({ quotes: {}, asOf: Date.now() })

  const symbols = Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, MAX_SYMBOLS)

  const quotes = await getQuotes(symbols)
  return NextResponse.json(
    { quotes, asOf: Date.now() },
    { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' } },
  )
}
