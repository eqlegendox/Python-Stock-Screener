'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import type { SeriesPoint } from '@/lib/data'
import { UP, DOWN } from '@/lib/ui'
import { formatVolume, formatDate, formatDateLong } from '@/lib/format'

interface Props {
  series: SeriesPoint[]
  height?: number
  syncId?: string
}

// Volume subchart, bars colored up/down by close vs open. Synced to the price
// chart via syncId so the crosshair lines up.
export default function VolumeChart({ series, height = 120, syncId }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={series} syncId={syncId} margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
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
          tickFormatter={(v) => formatVolume(v as number)}
          tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: 'rgba(91,140,255,0.08)' }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null
            const p = payload[0].payload as SeriesPoint
            return (
              <div
                className="rounded-md border px-3 py-2 text-xs font-mono shadow-xl"
                style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-strong)' }}
              >
                <div className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>
                  {formatDateLong(p.date)}
                </div>
                <div className="flex items-center justify-between gap-5">
                  <span style={{ color: 'var(--text-muted)' }}>Volume</span>
                  <span style={{ color: 'var(--text)' }}>{formatVolume(p.volume)}</span>
                </div>
              </div>
            )
          }}
        />
        <Bar dataKey="volume" isAnimationActive={false}>
          {series.map((p, i) => (
            <Cell key={i} fill={p.close >= p.open ? UP : DOWN} fillOpacity={0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
