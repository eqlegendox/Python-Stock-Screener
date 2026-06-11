import { SIGNAL_STYLES } from '@/lib/ui'
import type { Signal } from '@/lib/metrics'

interface Props {
  signal: Signal
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
}

export default function SignalBadge({ signal, size = 'md' }: Props) {
  const s = SIGNAL_STYLES[signal]
  return (
    <span
      className={`inline-flex items-center rounded font-mono font-semibold uppercase tracking-wider ${SIZES[size]}`}
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: size === 'sm' ? 5 : 6,
          height: size === 'sm' ? 5 : 6,
          backgroundColor: s.color,
          boxShadow: `0 0 6px ${s.color}`,
        }}
      />
      {s.short}
    </span>
  )
}
