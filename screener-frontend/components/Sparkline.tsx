interface Props {
  values: number[]
  width?: number
  height?: number
  color?: string
}

// Lightweight hand-rolled SVG sparkline for table rows.
export default function Sparkline({ values, width = 96, height = 28, color = 'var(--up)' }: Props) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 2
  const innerH = height - pad * 2
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => pad + (1 - (v - min) / span) * innerH

  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')
  const gradId = `sk-${Math.round(min)}-${Math.round(max)}-${values.length}`

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradId})`} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(values[values.length - 1])} r={1.8} fill={color} />
    </svg>
  )
}
