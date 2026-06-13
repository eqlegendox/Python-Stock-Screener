'use client'

import type { ScreenRow } from '@/lib/data'
import type { Signal } from '@/lib/metrics'
import { maAlignment, ALIGNMENT_LABEL } from '@/lib/metrics'
import { formatPrice, formatPct } from '@/lib/format'
import Sparkline from './Sparkline'
import SignalBadge from './SignalBadge'
import Link from 'next/link'

const SIGNAL_COLOR: Record<Signal, string> = {
  STRONG: '#00FF87',
  SETUP:  '#38BDF8',
  WEAK:   '#F59E0B',
  AVOID:  '#F43F5E',
}

interface Props {
  row: ScreenRow
  signal: Signal
  livePrice?: number
  onClose: () => void
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: color ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

export default function DetailDrawer({ row, signal, livePrice, onClose }: Props) {
  const accentColor = SIGNAL_COLOR[signal]
  const price = livePrice ?? row.currentClose
  const align = maAlignment(row)

  const highPct = row.pctFromHigh
  const highColor = highPct > -5 ? '#00FF87' : highPct > -15 ? '#F59E0B' : 'var(--text-muted)'

  // 52-week range bar: how far current price sits between low52 and high52.
  const rangePct = row.high52 > row.low52
    ? Math.min(100, Math.max(0, ((price - row.low52) / (row.high52 - row.low52)) * 100))
    : 50

  return (
    <div
      className="drawer-enter fixed inset-x-0 bottom-0 z-50"
      style={{ borderTop: `2px solid ${accentColor}` }}
    >
      <div className="bg-[var(--bg-elevated)] px-5 pb-6 pt-4 sm:px-8" style={{ boxShadow: `0 -12px 40px rgba(0,0,0,0.7)` }}>
        <div className="mx-auto max-w-[1500px]">

          {/* Header row */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/${row.ticker}`}
                className="font-display text-2xl font-bold tracking-tight transition-colors hover:text-[var(--accent)]"
                style={{ color: accentColor }}
              >
                {row.ticker}
              </Link>
              <SignalBadge signal={signal} size="md" />
              <span className="font-mono text-xl font-semibold tabular-nums text-[var(--text)]">
                {formatPrice(price)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/${row.ticker}`}
                className="rounded border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                full chart →
              </Link>
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="rounded p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content grid */}
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <MetricCard label="RS Rating" value={row.rsRating.toFixed(0)} color={
                row.rsRating >= 90 ? '#00FF87' : row.rsRating >= 70 ? '#a3e635' : row.rsRating >= 50 ? '#F59E0B' : '#F43F5E'
              } />
              <MetricCard label="1Y Return" value={formatPct(row.return1y)} color={row.return1y >= 0 ? '#00FF87' : '#F43F5E'} />
              <MetricCard label="% from High" value={formatPct(row.pctFromHigh)} color={highColor} />
              <MetricCard label="% above Low" value={formatPct(row.pctFromLow)} />
              <MetricCard label="MA Align" value={ALIGNMENT_LABEL[align]} color={
                align === 'stacked' ? '#00FF87' : align === 'inverted' ? '#F43F5E' : 'var(--text-faint)'
              } />
              <MetricCard label="Conditions" value={`${row.conditionsMet}/8`} color={row.passes ? '#00FF87' : 'var(--text-muted)'} />
            </div>

            {/* Sparkline */}
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
              <Sparkline values={row.sparkline} width={196} height={52} color={accentColor} />
            </div>
          </div>

          {/* 52-week range bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-[var(--text-faint)]">
              <span>52W Low {formatPrice(row.low52)}</span>
              <span>Current {formatPrice(price)}</span>
              <span>52W High {formatPrice(row.high52)}</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-strong)]">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all"
                style={{ width: `${rangePct}%`, backgroundColor: accentColor, opacity: 0.75 }}
              />
              <div
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full"
                style={{ left: `${rangePct}%`, backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
