'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { ScreenRow } from '@/lib/data'
import { compareColor, changeColor } from '@/lib/ui'
import { formatPct } from '@/lib/format'

interface Props {
  rows: ScreenRow[]
  onClose: () => void
  onRemove: (ticker: string) => void
}

interface MergedRow {
  i: number
  [ticker: string]: number
}

// Modal overlaying normalized % return (rebased to 0 at the start of each
// stock's sparkline) so price action is comparable across tickers.
export default function CompareOverlay({ rows, onClose, onRemove }: Props) {
  const data = useMemo<MergedRow[]>(() => {
    const len = Math.max(...rows.map((r) => r.sparkline.length))
    const out: MergedRow[] = []
    for (let i = 0; i < len; i++) {
      const row: MergedRow = { i }
      for (const r of rows) {
        const base = r.sparkline[0]
        const v = r.sparkline[Math.min(i, r.sparkline.length - 1)]
        row[r.ticker] = base ? ((v - base) / base) * 100 : 0
      }
      out.push(row)
    }
    return out
  }, [rows])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3,5,9,0.8)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="reveal w-full max-w-4xl rounded-2xl border border-[var(--border-strong)] bg-[var(--panel)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight">Compare · normalized return</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 font-mono text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-hover)] hover:text-[var(--text)]"
          >
            ✕ close
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {rows.map((r, i) => (
            <button
              key={r.ticker}
              type="button"
              onClick={() => onRemove(r.ticker)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-2 py-1 font-mono text-xs transition-colors hover:border-[var(--down)]"
              title="Remove"
            >
              <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: compareColor(i) }} />
              {r.ticker}
              <span className="tabular-nums" style={{ color: changeColor(r.return1y) }}>{formatPct(r.return1y)}</span>
              <span className="text-[var(--text-faint)]">✕</span>
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="i"
              tick={false}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v as number).toFixed(0)}%`}
              tick={{ fill: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <ReferenceLine y={0} stroke="var(--grid-strong)" strokeWidth={1} />
            <Tooltip
              cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                return (
                  <div
                    className="rounded-md border px-3 py-2 text-xs font-mono shadow-xl"
                    style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-strong)' }}
                  >
                    <div className="space-y-1">
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                            <span className="inline-block h-0.5 w-2.5 rounded" style={{ backgroundColor: p.color }} />
                            {String(p.dataKey)}
                          </span>
                          <span style={{ color: changeColor(p.value as number) }}>{formatPct(p.value as number)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }}
            />
            {rows.map((r, i) => (
              <Line
                key={r.ticker}
                type="monotone"
                dataKey={r.ticker}
                stroke={compareColor(i)}
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
