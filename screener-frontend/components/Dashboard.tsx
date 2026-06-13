'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { ScreenRow } from '@/lib/data'
import { evaluate, DEFAULT_PARAMS, type ScreenParams } from '@/lib/screen'
import { signalFor, maAlignment, ALIGNMENT_LABEL, type Signal } from '@/lib/metrics'
import { useWatchlist } from '@/lib/useWatchlist'
import { changeColor } from '@/lib/ui'
import { formatPrice, formatPct } from '@/lib/format'
import { useScreener } from '@/lib/useScreener'
import Sparkline from './Sparkline'
import SignalBadge from './SignalBadge'
import TickerTape from './TickerTape'
import FreshnessBadge from './FreshnessBadge'
import ScreenControls from './ScreenControls'
import CompareOverlay from './CompareOverlay'
import LiveBadge from './LiveBadge'
import DetailDrawer from './DetailDrawer'
import { useLiveQuotes } from '@/lib/useLiveQuotes'

const SIGNAL_COLOR: Record<Signal, string> = {
  STRONG: '#00FF87',
  SETUP:  '#38BDF8',
  WEAK:   '#F59E0B',
  AVOID:  '#F43F5E',
}

function rsColor(rs: number): string {
  if (rs >= 90) return '#00FF87'
  if (rs >= 70) return '#a3e635'
  if (rs >= 50) return '#F59E0B'
  return '#F43F5E'
}

function highColor(pctFromHigh: number): string {
  if (pctFromHigh > -5) return '#00FF87'
  if (pctFromHigh > -15) return '#F59E0B'
  return 'var(--text-muted)'
}

type SortKey = 'ticker' | 'rsRating' | 'currentClose' | 'pctFromHigh' | 'return1y' | 'met'
type SortDir = 'asc' | 'desc'

interface Props {
  rows: ScreenRow[]
  generatedAt: string
}

export default function Dashboard({ rows: initialRows, generatedAt: initialGeneratedAt }: Props) {
  const { list: watchlist, has, toggle } = useWatchlist()
  const [params, setParams] = useState<ScreenParams>(DEFAULT_PARAMS)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rsRating')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [passingOnly, setPassingOnly] = useState(false)
  const [watchOnly, setWatchOnly] = useState(false)
  const [compare, setCompare] = useState<string[]>([])
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const refreshBtnRef = useRef<HTMLButtonElement>(null)

  const { rows: flaskRows, meta, loading, error, forceRefresh } = useScreener(params, initialRows)
  const rows = flaskRows.length > 0 ? flaskRows : initialRows
  const generatedAt = meta?.generatedAt ?? initialGeneratedAt

  const handleRefresh = useCallback(async () => {
    const btn = refreshBtnRef.current
    if (btn) {
      btn.classList.remove('spin-once')
      void btn.offsetWidth // reflow to restart animation
      btn.classList.add('spin-once')
    }
    await forceRefresh()
  }, [forceRefresh])

  const evaluated = useMemo(() => {
    return rows.map((r) => {
      const { passes, met } = evaluate(r, params)
      return { row: r, passes, met, signal: signalFor({ passes, conditionsMet: met, rsRating: r.rsRating }) }
    })
  }, [rows, params])

  const passingCount = useMemo(() => evaluated.filter((e) => e.passes).length, [evaluated])
  const strongCount = useMemo(() => evaluated.filter((e) => e.signal === 'STRONG').length, [evaluated])
  const passRate = rows.length > 0 ? ((passingCount / rows.length) * 100).toFixed(1) : '0.0'

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    let out = evaluated.filter((e) => (q ? e.row.ticker.includes(q) : true))
    if (passingOnly) out = out.filter((e) => e.passes)
    if (watchOnly) out = out.filter((e) => watchlist.includes(e.row.ticker.toUpperCase()))
    const dir = sortDir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'ticker':      return a.row.ticker.localeCompare(b.row.ticker) * dir
        case 'met':         return (a.met - b.met) * dir
        case 'currentClose': return (a.row.currentClose - b.row.currentClose) * dir
        case 'pctFromHigh': return (a.row.pctFromHigh - b.row.pctFromHigh) * dir
        case 'return1y':    return (a.row.return1y - b.row.return1y) * dir
        case 'rsRating':
        default:            return (a.row.rsRating - b.row.rsRating) * dir
      }
    })
    return out
  }, [evaluated, query, passingOnly, watchOnly, watchlist, sortKey, sortDir])

  const pollSymbols = useMemo(() => filtered.slice(0, 40).map((e) => e.row.ticker), [filtered])
  const live = useLiveQuotes(pollSymbols)

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'ticker' ? 'asc' : 'desc') }
  }

  const toggleCompare = (ticker: string) =>
    setCompare((c) => (c.includes(ticker) ? c.filter((t) => t !== ticker) : c.length >= 6 ? c : [...c, ticker]))

  const compareRows = rows.filter((r) => compare.includes(r.ticker))

  const selectedEntry = selectedTicker
    ? filtered.find((e) => e.row.ticker === selectedTicker) ?? null
    : null

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/60 px-5 pt-5 pb-3 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              MOMENTUM<span style={{ color: 'var(--accent)' }}>·</span>TERMINAL
            </h1>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
              S&amp;P 500 · Minervini trend template · RS rating &amp; moving-average screen
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="font-mono text-[10px] text-[var(--amber)]" title={error}>
                ⚠ Flask offline
              </span>
            )}
            <button
              ref={refreshBtnRef}
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh data"
              title="Force refresh from yfinance"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </button>
            <LiveBadge live={live.live} asOf={live.asOf} marketOpen={live.marketOpen} />
            <FreshnessBadge generatedAt={generatedAt} lastDate={rows[0]?.lastDate} />
          </div>
        </div>
      </header>

      <TickerTape rows={rows} />

      <div className="mx-auto max-w-[1500px] px-5 py-5 sm:px-8">
        {/* Stats bar */}
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
          <Stat label="Passing" value={String(passingCount)} color="var(--up)" />
          <Stat label="Universe" value={String(rows.length)} />
          <Stat label="Pass rate" value={`${passRate}%`} color={Number(passRate) >= 10 ? 'var(--up)' : 'var(--text-muted)'} />
          <Stat label="STRONG" value={String(strongCount)} color="#00FF87" />
          {loading && (
            <span className="ml-auto font-mono text-[10px] text-[var(--text-faint)] animate-pulse">
              loading…
            </span>
          )}
        </div>

        {/* Screen controls */}
        <div className="mb-4">
          <ScreenControls params={params} onChange={setParams} passing={passingCount} total={rows.length} />
        </div>

        {/* Filter row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search ticker…"
            className="w-44 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 font-mono text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
          />
          <Chip active={passingOnly} onClick={() => setPassingOnly((v) => !v)} color="var(--up)">
            ✓ passing only
          </Chip>
          <Chip active={watchOnly} onClick={() => setWatchOnly((v) => !v)} color="var(--amber)">
            ★ watchlist {watchlist.length ? `(${watchlist.length})` : ''}
          </Chip>
          <span className="ml-auto font-mono text-[11px] text-[var(--text-faint)]">
            {filtered.length} / {rows.length} shown
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                <Th className="w-2 p-0"> </Th>
                <Th className="w-10 pl-3"> </Th>
                <Th onClick={() => setSort('ticker')} active={sortKey === 'ticker'} dir={sortDir}>Ticker</Th>
                <Th className="hidden md:table-cell">Trend</Th>
                <Th onClick={() => setSort('rsRating')} active={sortKey === 'rsRating'} dir={sortDir} align="right">RS</Th>
                <Th onClick={() => setSort('currentClose')} active={sortKey === 'currentClose'} dir={sortDir} align="right">Price</Th>
                <Th onClick={() => setSort('return1y')} active={sortKey === 'return1y'} dir={sortDir} align="right" className="hidden sm:table-cell">1Y</Th>
                <Th onClick={() => setSort('pctFromHigh')} active={sortKey === 'pctFromHigh'} dir={sortDir} align="right" className="hidden lg:table-cell">% from high</Th>
                <Th align="center" className="hidden lg:table-cell">MA align</Th>
                <Th onClick={() => setSort('met')} active={sortKey === 'met'} dir={sortDir} align="center">Met</Th>
                <Th>Signal</Th>
                <Th align="center" className="pr-4">Cmp</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ row: r, met, signal, passes }) => {
                const align = maAlignment(r)
                const q = live.quotes[r.ticker]
                const price = q?.price ?? r.currentClose
                const le = q ? evaluate({ ...r, currentClose: price }, params) : null
                const dMet = le ? le.met : met
                const dPasses = le ? le.passes : passes
                const dSignal = le ? signalFor({ passes: dPasses, conditionsMet: dMet, rsRating: r.rsRating }) : signal
                const accentColor = SIGNAL_COLOR[dSignal]
                const isSelected = selectedTicker === r.ticker

                return (
                  <tr
                    key={r.ticker}
                    onClick={() => setSelectedTicker((t) => (t === r.ticker ? null : r.ticker))}
                    className="group border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--panel-hover)] cursor-pointer"
                    style={{ borderLeft: `3px solid ${accentColor}`, background: isSelected ? `${accentColor}08` : undefined }}
                  >
                    {/* Signal accent strip (handled via borderLeft on the tr) */}
                    <td className="p-0 w-0" />

                    <td className="pl-3">
                      <StarButton
                        active={has(r.ticker)}
                        onClick={(e) => { e.stopPropagation(); toggle(r.ticker) }}
                      />
                    </td>

                    <td className="py-2.5">
                      <Link
                        href={`/${r.ticker}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-sm font-bold text-[var(--text)] transition-colors group-hover:text-[var(--accent)]"
                      >
                        {r.ticker}
                      </Link>
                    </td>

                    <td className="hidden md:table-cell">
                      <Sparkline values={r.sparkline} color={accentColor} width={84} />
                    </td>

                    {/* RS: number + mini progress bar */}
                    <td className="text-right px-3 py-2">
                      <div className="inline-flex flex-col items-end">
                        <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: rsColor(r.rsRating) }}>
                          {r.rsRating.toFixed(0)}
                        </span>
                        <div className="mt-1 h-[3px] w-10 overflow-hidden rounded-full bg-[var(--border-strong)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${r.rsRating}%`, backgroundColor: rsColor(r.rsRating) }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="text-right font-mono text-xs tabular-nums px-3">
                      <span className="text-[var(--text)]">{formatPrice(price)}</span>
                      {q && (
                        <span className="ml-1" style={{ color: changeColor(q.changePct) }}>
                          {q.changePct >= 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </td>

                    <td className="hidden text-right font-mono text-xs tabular-nums sm:table-cell px-3" style={{ color: changeColor(r.return1y) }}>
                      {formatPct(r.return1y)}
                    </td>

                    {/* % from high: color-coded */}
                    <td className="hidden text-right font-mono text-xs tabular-nums lg:table-cell px-3" style={{ color: highColor(r.pctFromHigh) }}>
                      {formatPct(r.pctFromHigh)}
                    </td>

                    <td className="hidden text-center font-mono text-[11px] lg:table-cell px-3" style={{ color: align === 'stacked' ? 'var(--up)' : align === 'inverted' ? 'var(--down)' : 'var(--text-faint)' }}>
                      {ALIGNMENT_LABEL[align]}
                    </td>

                    <td className="text-center font-mono text-xs tabular-nums px-3" style={{ color: dPasses ? 'var(--up)' : 'var(--text-muted)' }}>
                      {dMet}/8
                    </td>

                    <td className="py-2.5 px-3">
                      <SignalBadge signal={dSignal} size="sm" />
                    </td>

                    <td className="pr-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={compare.includes(r.ticker)}
                        onChange={() => toggleCompare(r.ticker)}
                        aria-label={`Compare ${r.ticker}`}
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
                      />
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={12} className="py-12 text-center font-mono text-sm text-[var(--text-faint)]">
                    {loading ? 'Loading from yfinance…' : 'No stocks match.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compare tray */}
      {compare.length > 0 && !selectedTicker && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 px-5 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <span className="font-mono text-xs text-[var(--text-muted)]">Compare:</span>
            <div className="flex flex-wrap gap-1.5">
              {compare.map((t) => (
                <button key={t} onClick={() => toggleCompare(t)} className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-0.5 font-mono text-xs hover:border-[var(--down)]">
                  {t} <span className="text-[var(--text-faint)]">✕</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setCompare([])} className="rounded px-2 py-1 font-mono text-xs text-[var(--text-faint)] hover:text-[var(--text)]">clear</button>
              <button
                onClick={() => setOverlayOpen(true)}
                disabled={compare.length < 2}
                className="rounded-md border border-[var(--accent)] px-3 py-1 font-mono text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                overlay ({compare.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedEntry && (
        <DetailDrawer
          row={selectedEntry.row}
          signal={selectedEntry.signal}
          livePrice={live.quotes[selectedEntry.row.ticker]?.price}
          onClose={() => setSelectedTicker(null)}
        />
      )}

      {overlayOpen && compareRows.length >= 2 && (
        <CompareOverlay rows={compareRows} onClose={() => setOverlayOpen(false)} onRemove={(t) => toggleCompare(t)} />
      )}
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function Th({
  children, onClick, active, dir, align = 'left', className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  dir?: SortDir
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`px-3 py-2.5 font-medium ${alignCls} ${className}`}>
      {onClick ? (
        <button onClick={onClick} className={`inline-flex items-center gap-1 transition-colors hover:text-[var(--text)] ${active ? 'text-[var(--accent)]' : ''}`}>
          {children}
          {active && <span>{dir === 'asc' ? '▲' : '▼'}</span>}
        </button>
      ) : children}
    </th>
  )
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 font-mono text-xs transition-colors"
      style={{
        borderColor: active ? color : 'var(--border)',
        color: active ? color : 'var(--text-muted)',
        backgroundColor: active ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function StarButton({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Toggle watchlist" aria-pressed={active} className="p-1">
      <svg width={15} height={15} viewBox="0 0 24 24" fill={active ? 'var(--amber)' : 'none'} stroke={active ? 'var(--amber)' : 'var(--text-faint)'} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 21l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z" />
      </svg>
    </button>
  )
}
