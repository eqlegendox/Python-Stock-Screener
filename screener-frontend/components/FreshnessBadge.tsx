'use client'

import { formatDateLong } from '@/lib/format'

interface Props {
  generatedAt: string
  lastDate?: string
}

// Shows when the screen was computed. Data comes from the cached CSVs (last
// yfinance pull) — there is no live feed.
export default function FreshnessBadge({ generatedAt, lastDate }: Props) {
  const when = relativeFrom(generatedAt)
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 font-mono text-[11px]"
      title={lastDate ? `Latest bar: ${formatDateLong(lastDate)}` : undefined}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: 'var(--up)', boxShadow: '0 0 6px var(--up)' }}
      />
      <span className="text-[var(--text-muted)]">SCREENED · {when}</span>
    </div>
  )
}

function relativeFrom(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return formatDateLong(iso.slice(0, 10))
}
