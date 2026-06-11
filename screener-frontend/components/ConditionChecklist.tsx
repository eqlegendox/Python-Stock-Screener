import { CONDITIONS, evaluate, DEFAULT_PARAMS } from '@/lib/screen'
import type { ScreenMetrics, ScreenParams } from '@/lib/screen'

interface Props {
  metrics: ScreenMetrics
  params?: ScreenParams
}

// The trend-template conditions rendered pass/fail with the real numbers behind
// each rule. Pure — reflects whatever params are passed in.
export default function ConditionChecklist({ metrics, params = DEFAULT_PARAMS }: Props) {
  const { conditions, met } = evaluate(metrics, params)

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">Trend template</h2>
        <span className="font-mono text-xs tabular-nums" style={{ color: met === CONDITIONS.length ? 'var(--up)' : 'var(--text-muted)' }}>
          {met}/{CONDITIONS.length} met
        </span>
      </div>
      <ul className="space-y-1.5">
        {CONDITIONS.map((c) => {
          const ok = conditions[c.key]
          return (
            <li
              key={c.key}
              className="flex items-start gap-2.5 rounded-lg border px-3 py-2"
              style={{
                borderColor: ok ? 'rgba(54,226,123,0.25)' : 'var(--border)',
                backgroundColor: ok ? 'rgba(54,226,123,0.05)' : 'var(--panel-2)',
              }}
            >
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: ok ? 'var(--up)' : 'transparent',
                  color: ok ? '#06210f' : 'var(--down)',
                  border: ok ? 'none' : '1px solid var(--down)',
                }}
              >
                {ok ? '✓' : '✕'}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-xs font-medium text-[var(--text)]">{c.label}</div>
                <div className="font-mono text-[11px] text-[var(--text-faint)]">{c.detail(metrics, params)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
