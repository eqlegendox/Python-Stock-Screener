'use client'

import { useWatchlist } from '@/lib/useWatchlist'

interface Props {
  ticker: string
  size?: number
}

export default function WatchlistButton({ ticker, size = 16 }: Props) {
  const { has, toggle } = useWatchlist()
  const active = has(ticker)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(ticker)
      }}
      aria-label={active ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      aria-pressed={active}
      className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-[var(--panel-hover)]"
      title={active ? 'In watchlist' : 'Add to watchlist'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? 'var(--amber)' : 'none'}
        stroke={active ? 'var(--amber)' : 'var(--text-faint)'}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={active ? { filter: 'drop-shadow(0 0 4px rgba(240,136,62,0.5))' } : undefined}
      >
        <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 21l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z" />
      </svg>
    </button>
  )
}
