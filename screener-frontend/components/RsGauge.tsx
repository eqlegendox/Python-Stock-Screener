interface Props {
  rsRating: number
}

// RS rating 0–100 as a labeled meter. Higher = stronger relative strength.
export default function RsGauge({ rsRating }: Props) {
  const pct = Math.max(0, Math.min(100, rsRating))
  const color = pct >= 80 ? 'var(--up)' : pct >= 50 ? 'var(--accent)' : 'var(--amber)'

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]">RS rating</span>
        <span className="font-mono text-xl font-bold tabular-nums" style={{ color }}>
          {rsRating.toFixed(0)}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--panel-2)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
        {/* Minervini RS≥70 reference */}
        <div className="absolute top-0 h-full w-px" style={{ left: '70%', backgroundColor: 'var(--border-strong)' }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--text-faint)]">
        <span>0</span>
        <span>70 (min)</span>
        <span>100</span>
      </div>
    </div>
  )
}
