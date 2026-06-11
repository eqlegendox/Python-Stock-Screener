'use client'

import type { ScreenParams } from '@/lib/screen'
import { DEFAULT_PARAMS } from '@/lib/screen'

interface Props {
  params: ScreenParams
  onChange: (p: ScreenParams) => void
  passing: number
  total: number
}

// Live screen thresholds. Changing a slider re-evaluates the whole universe in
// the browser (via lib/screen.ts) — no rebuild.
export default function ScreenControls({ params, onChange, passing, total }: Props) {
  const set = (k: keyof ScreenParams, v: number) => onChange({ ...params, [k]: v })
  const isDefault =
    params.rsCutoff === DEFAULT_PARAMS.rsCutoff &&
    params.minPctAboveLow === DEFAULT_PARAMS.minPctAboveLow &&
    params.maxPctBelowHigh === DEFAULT_PARAMS.maxPctBelowHigh

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">Screen thresholds</h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
            <span className="font-bold text-[var(--up)]">{passing}</span> / {total} pass
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_PARAMS })}
            disabled={isDefault}
            className="rounded border border-[var(--border)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            reset to Minervini
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Slider label="RS rating ≥" value={params.rsCutoff} min={0} max={100} step={1} suffix="" onChange={(v) => set('rsCutoff', v)} />
        <Slider label="% above 52w low ≥" value={params.minPctAboveLow} min={0} max={100} step={1} suffix="%" onChange={(v) => set('minPctAboveLow', v)} />
        <Slider label="within % of 52w high" value={params.maxPctBelowHigh} min={1} max={100} step={1} suffix="%" onChange={(v) => set('maxPctBelowHigh', v)} />
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] text-[var(--text-muted)]">{label}</span>
        <span className="font-mono text-sm font-bold tabular-nums text-[var(--accent)]">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )
}
