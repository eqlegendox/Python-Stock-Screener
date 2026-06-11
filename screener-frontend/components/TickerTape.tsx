'use client'

import Link from 'next/link'
import type { ScreenRow } from '@/lib/data'
import { formatPct } from '@/lib/format'
import { changeColor } from '@/lib/ui'

// Scrolling marquee of the top RS movers (by 1-year return).
export default function TickerTape({ rows }: { rows: ScreenRow[] }) {
  if (!rows.length) return null
  const top = [...rows].sort((a, b) => b.return1y - a.return1y).slice(0, 24)
  const items = [...top, ...top]
  return (
    <div className="marquee-pause relative overflow-hidden border-y border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="animate-marquee flex w-max items-center gap-6 py-2 pl-6">
        {items.map((r, i) => (
          <Link
            key={`${r.ticker}-${i}`}
            href={`/${r.ticker}`}
            className="flex items-center gap-2 whitespace-nowrap font-mono text-xs transition-opacity hover:opacity-80"
          >
            <span className="font-semibold text-[var(--text)]">{r.ticker}</span>
            <span className="tabular-nums" style={{ color: changeColor(r.return1y) }}>
              {formatPct(r.return1y)}
            </span>
            <span style={{ color: changeColor(r.return1y) }}>{r.return1y >= 0 ? '▲' : '▼'}</span>
            <span className="text-[var(--text-faint)]">·</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
