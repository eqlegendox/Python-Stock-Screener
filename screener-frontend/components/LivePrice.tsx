'use client'

import { useEffect, useRef } from 'react'
import { useLiveQuotes } from '@/lib/useLiveQuotes'
import { formatPrice, formatPct } from '@/lib/format'
import { changeColor } from '@/lib/ui'
import LiveBadge from './LiveBadge'

interface Props {
  ticker: string
  dailyClose: number
  return1y: number
}

// Detail-page header price: live current price + today's change during market
// hours, falling back to the daily close + YTD return when closed.
export default function LivePrice({ ticker, dailyClose, return1y }: Props) {
  const { quotes, asOf, live, marketOpen } = useLiveQuotes([ticker])
  const q = quotes[ticker]
  const price = q?.price ?? dailyClose

  // Flash on price change.
  const prev = useRef(price)
  const flash = price > prev.current ? 'flash-up' : price < prev.current ? 'flash-down' : ''
  useEffect(() => {
    prev.current = price
  }, [price])

  return (
    <div className="flex flex-col items-end gap-1.5">
      <LiveBadge live={live} asOf={asOf} marketOpen={marketOpen} />
      <div className={`rounded px-1 font-mono text-3xl font-bold tabular-nums ${flash}`}>{formatPrice(price)}</div>
      {q ? (
        <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: changeColor(q.changePct) }}>
          {formatPct(q.changePct)} today
        </div>
      ) : (
        <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: changeColor(return1y) }}>
          {formatPct(return1y)} 1Y
        </div>
      )}
    </div>
  )
}
