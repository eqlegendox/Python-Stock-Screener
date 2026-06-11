'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { SeriesPoint } from '@/lib/data'
import { MA_COLORS, UP, DOWN } from '@/lib/ui'
import { formatPrice, formatPriceCompact, formatDate, formatDateLong, formatVolume } from '@/lib/format'

interface Props {
  series: SeriesPoint[]
  low52: number
  high52: number
  height?: number
  syncId?: string
}

interface Row extends SeriesPoint {
  hl: [number, number]
}

const MA_TOGGLES = [
  { key: 'sma50' as const, label: 'MA 50', color: MA_COLORS.sma50 },
  { key: 'sma150' as const, label: 'MA 150', color: MA_COLORS.sma150 },
  { key: 'sma200' as const, label: 'MA 200', color: MA_COLORS.sma200 },
]

export default function CandleChart({ series, low52, high52, height = 420, syncId }: Props) {
  const [showMa, setShowMa] = useState({ sma50: true, sma150: true, sma200: true })

  const data = useMemo<Row[]>(
    () => series.map((p) => ({ ...p, hl: [p.low, p.high] })),
    [series],
  )

  const [domainMin, domainMax] = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const p of series) {
      if (p.low < lo) lo = p.low
      if (p.high > hi) hi = p.high
    }
    const pad = (hi - lo) * 0.04
    return [Math.max(0, lo - pad), hi + pad]
  }, [series])

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {MA_TOGGLES.map((ma) => {
          const on = showMa[ma.key]
          return (
            <button
              key={ma.key}
              type="button"
              onClick={() => setShowMa((s) => ({ ...s, [ma.key]: !s[ma.key] }))}
              className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-mono transition-colors"
              style={{
                borderColor: on ? ma.color : 'var(--border)',
                color: on ? 'var(--text)' : 'var(--text-faint)',
              }}
              aria-pressed={on}
            >
              <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: on ? ma.color : 'var(--text-faint)' }} />
              {ma.label}
            </button>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} syncId={syncId} margin={{ top: 8, right: 56, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            minTickGap={48}
            interval="preserveStartEnd"
          />
          <YAxis
            orientation="right"
            domain={[domainMin, domainMax]}
            tickFormatter={(v) => formatPriceCompact(v as number)}
            tick={{ fill: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />

          <ReferenceLine y={high52} stroke="var(--up)" strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: '52w high', position: 'insideTopRight', fill: 'var(--up)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
          <ReferenceLine y={low52} stroke="var(--down)" strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: '52w low', position: 'insideBottomRight', fill: 'var(--down)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />

          <Tooltip
            cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<CandleTooltip />}
          />

          <Bar dataKey="hl" shape={<Candle />} isAnimationActive={false} legendType="none" />

          {MA_TOGGLES.map((ma) =>
            showMa[ma.key] ? (
              <Line
                key={ma.key}
                type="monotone"
                dataKey={ma.key}
                stroke={ma.color}
                strokeWidth={1.3}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ) : null,
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Custom candlestick: the Bar provides the pixel box for the [low, high] range,
// so we linearly map open/close into that box and draw wick + body.
function Candle(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: SeriesPoint
}) {
  const { x, y, width, height, payload } = props
  if (x == null || y == null || width == null || height == null || !payload) return null
  const { open, close, high, low } = payload
  const range = high - low
  if (range <= 0) return null

  const scaleY = (v: number) => y + ((high - v) / range) * height
  const up = close >= open
  const color = up ? UP : DOWN
  const cx = x + width / 2
  const bodyTop = scaleY(Math.max(open, close))
  const bodyBottom = scaleY(Math.min(open, close))
  const bodyH = Math.max(1, bodyBottom - bodyTop)
  const bodyW = Math.max(1, width * 0.66)
  const bodyX = cx - bodyW / 2

  return (
    <g>
      <line x1={cx} y1={scaleY(high)} x2={cx} y2={scaleY(low)} stroke={color} strokeWidth={Math.min(1.2, Math.max(0.5, width * 0.18))} />
      <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
    </g>
  )
}

function CandleTooltip({ active, payload }: { active?: boolean; payload?: { payload: SeriesPoint }[] }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  const up = p.close >= p.open
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs font-mono shadow-xl"
      style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-strong)', minWidth: 168 }}
    >
      <div className="mb-1.5 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>
        {formatDateLong(p.date)}
      </div>
      <Row label="O" value={formatPrice(p.open)} />
      <Row label="H" value={formatPrice(p.high)} color="var(--up)" />
      <Row label="L" value={formatPrice(p.low)} color="var(--down)" />
      <Row label="C" value={formatPrice(p.close)} color={up ? 'var(--up)' : 'var(--down)'} />
      <Row label="Vol" value={formatVolume(p.volume)} muted />
      <div className="mt-1.5 space-y-1 border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
        {p.sma50 != null && <Row label="MA50" value={formatPrice(p.sma50)} color={MA_COLORS.sma50} />}
        {p.sma150 != null && <Row label="MA150" value={formatPrice(p.sma150)} color={MA_COLORS.sma150} />}
        {p.sma200 != null && <Row label="MA200" value={formatPrice(p.sma200)} color={MA_COLORS.sma200} />}
      </div>
    </div>
  )
}

function Row({ label, value, color, muted }: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span style={{ color: muted ? 'var(--text-faint)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}
