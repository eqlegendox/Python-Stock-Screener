'use client'

interface Props {
  live: boolean
  asOf: number | null
  marketOpen: boolean
}

// Live-data status pill: pulsing green "LIVE · as of HH:MM:SS" during market
// hours, or a muted "market closed".
export default function LiveBadge({ live, asOf, marketOpen }: Props) {
  const time =
    asOf != null
      ? new Date(asOf).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : null

  const color = marketOpen ? (live ? 'var(--up)' : 'var(--amber)') : 'var(--text-faint)'
  const label = marketOpen ? (live ? `LIVE · ${time}` : 'connecting…') : 'market closed'

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 font-mono text-[11px]">
      <span
        className={`inline-block h-2 w-2 rounded-full ${marketOpen && live ? 'live-pulse' : ''}`}
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
