import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getStock } from '@/lib/data'
import { signalFor, maAlignment, ALIGNMENT_LABEL } from '@/lib/metrics'
import { changeColor } from '@/lib/ui'
import { formatPrice, formatPct, formatVolume, formatDateLong } from '@/lib/format'
import type { ScreenMetrics } from '@/lib/screen'
import CandleChart from '@/components/CandleChart'
import VolumeChart from '@/components/VolumeChart'
import RsGauge from '@/components/RsGauge'
import ConditionChecklist from '@/components/ConditionChecklist'
import SignalBadge from '@/components/SignalBadge'
import WatchlistButton from '@/components/WatchlistButton'

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const stock = await getStock(ticker)
  if (!stock) notFound()

  const m = stock.metrics
  const met = Object.values(stock.conditions).filter(Boolean).length
  const signal = signalFor({ passes: stock.passes, conditionsMet: met, rsRating: m.rsRating })
  const align = maAlignment(m)

  const screenMetrics: ScreenMetrics = {
    currentClose: m.currentClose,
    sma50: m.sma50,
    sma150: m.sma150,
    sma200: m.sma200,
    sma200Prev: m.sma200Prev as number,
    low52: m.low52,
    high52: m.high52,
    rsRating: m.rsRating,
  }

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="font-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">← screen</Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">S&amp;P 500 · trend template</span>
      </div>

      {/* Header */}
      <header className="reveal mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-5xl font-extrabold tracking-tight">{stock.ticker}</h1>
          <SignalBadge signal={signal} size="lg" />
          <WatchlistButton ticker={stock.ticker} size={22} />
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold tabular-nums">{formatPrice(m.currentClose)}</div>
          <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: changeColor(m.return1y) }}>
            {formatPct(m.return1y)} 1Y
          </div>
        </div>
      </header>

      {/* Key stats */}
      <section className="reveal mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="RS rating" value={m.rsRating.toFixed(0)} color={m.rsRating >= 80 ? 'var(--up)' : 'var(--accent)'} />
        <Stat label="% from 52w high" value={formatPct(m.pctFromHigh)} color={changeColor(m.pctFromHigh)} />
        <Stat label="% above 52w low" value={formatPct(m.pctFromLow)} color={changeColor(m.pctFromLow)} />
        <Stat label="MA alignment" value={ALIGNMENT_LABEL[align]} color={align === 'stacked' ? 'var(--up)' : align === 'inverted' ? 'var(--down)' : 'var(--text-muted)'} />
        <Stat label="Avg volume (20d)" value={formatVolume(m.avgVolume as number)} />
      </section>

      {/* Charts */}
      <section className="reveal mb-5 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">Price · candlesticks + moving averages</h2>
          <span className="font-mono text-[10px] text-[var(--text-faint)]">{stock.series.length} sessions</span>
        </div>
        <CandleChart series={stock.series} low52={m.low52} high52={m.high52} syncId={stock.ticker} />
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">Volume</h3>
          <VolumeChart series={stock.series} syncId={stock.ticker} />
        </div>
      </section>

      {/* RS + condition checklist */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <RsGauge rsRating={m.rsRating} />
          <div className="mt-5 space-y-2">
            <StatRow label="50-day MA" value={formatPrice(m.sma50)} />
            <StatRow label="150-day MA" value={formatPrice(m.sma150)} />
            <StatRow label="200-day MA" value={formatPrice(m.sma200)} />
            <StatRow label="52-week high" value={formatPrice(m.high52)} color="var(--up)" />
            <StatRow label="52-week low" value={formatPrice(m.low52)} color="var(--down)" />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 lg:col-span-2">
          <ConditionChecklist metrics={screenMetrics} />
        </section>
      </div>

      <footer className="mt-8 font-mono text-[10px] text-[var(--text-faint)]">
        {stock.series.length > 0 && (
          <span>
            {formatDateLong(stock.series[0].date)} → {formatDateLong(stock.series[stock.series.length - 1].date)} · {stock.series.length} sessions
          </span>
        )}
      </footer>
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums" style={color ? { color } : undefined}>{value}</div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 font-mono text-xs last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="tabular-nums" style={{ color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}
