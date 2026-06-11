// The Minervini trend template, parameterized. This is the single source of
// truth for the conditions; scripts/build-data.mjs mirrors it for the defaults.

export interface ScreenParams {
  rsCutoff: number // RS rating percentile floor (default 70)
  minPctAboveLow: number // min % above 52-week low (default 30)
  maxPctBelowHigh: number // max % below 52-week high (default 25)
}

export const DEFAULT_PARAMS: ScreenParams = {
  rsCutoff: 70,
  minPctAboveLow: 30,
  maxPctBelowHigh: 25,
}

// Raw inputs needed to evaluate the template (subset of a stock's metrics).
export interface ScreenMetrics {
  currentClose: number
  sma50: number | null
  sma150: number | null
  sma200: number | null
  sma200Prev: number
  low52: number
  high52: number
  rsRating: number
}

export type ConditionKey =
  | 'priceAboveMa150Ma200'
  | 'ma150AboveMa200'
  | 'ma200TrendingUp'
  | 'maStacked'
  | 'priceAboveMa50'
  | 'aboveLow'
  | 'nearHigh'
  | 'rsRating'

export type Conditions = Record<ConditionKey, boolean>

export interface ConditionDef {
  key: ConditionKey
  label: string
  detail: (m: ScreenMetrics, p: ScreenParams) => string
}

const f = (n: number | null) => (n == null ? '—' : n.toFixed(2))

// Ordered definitions, used by the checklist UI.
export const CONDITIONS: ConditionDef[] = [
  {
    key: 'priceAboveMa150Ma200',
    label: 'Price > 150-day MA > 200-day MA',
    detail: (m) => `Price ${f(m.currentClose)} > 150-MA ${f(m.sma150)} > 200-MA ${f(m.sma200)}`,
  },
  {
    key: 'ma150AboveMa200',
    label: '150-day MA > 200-day MA',
    detail: (m) => `150-MA ${f(m.sma150)} > 200-MA ${f(m.sma200)}`,
  },
  {
    key: 'ma200TrendingUp',
    label: '200-day MA trending up (≥1 month)',
    detail: (m) => `200-MA now ${f(m.sma200)} vs 20d ago ${f(m.sma200Prev)}`,
  },
  {
    key: 'maStacked',
    label: '50-day MA > 150-day MA > 200-day MA',
    detail: (m) => `50-MA ${f(m.sma50)} > 150-MA ${f(m.sma150)} > 200-MA ${f(m.sma200)}`,
  },
  {
    key: 'priceAboveMa50',
    label: 'Price > 50-day MA',
    detail: (m) => `Price ${f(m.currentClose)} > 50-MA ${f(m.sma50)}`,
  },
  {
    key: 'aboveLow',
    label: 'Price ≥ X% above 52-week low',
    detail: (m, p) =>
      `Price ${f(m.currentClose)} ≥ ${f(m.low52 * (1 + p.minPctAboveLow / 100))} (${p.minPctAboveLow}% above low ${f(m.low52)})`,
  },
  {
    key: 'nearHigh',
    label: 'Price within X% of 52-week high',
    detail: (m, p) =>
      `Price ${f(m.currentClose)} ≥ ${f(m.high52 * (1 - p.maxPctBelowHigh / 100))} (within ${p.maxPctBelowHigh}% of high ${f(m.high52)})`,
  },
  {
    key: 'rsRating',
    label: 'RS rating ≥ cutoff',
    detail: (m, p) => `RS ${m.rsRating.toFixed(1)} ≥ ${p.rsCutoff}`,
  },
]

export function evaluate(m: ScreenMetrics, p: ScreenParams = DEFAULT_PARAMS): {
  conditions: Conditions
  passes: boolean
  met: number
} {
  const conditions: Conditions = {
    priceAboveMa150Ma200: m.currentClose > num(m.sma150) && num(m.sma150) > num(m.sma200),
    ma150AboveMa200: num(m.sma150) > num(m.sma200),
    ma200TrendingUp: num(m.sma200) > m.sma200Prev,
    maStacked: num(m.sma50) > num(m.sma150) && num(m.sma150) > num(m.sma200),
    priceAboveMa50: m.currentClose > num(m.sma50),
    aboveLow: m.currentClose >= (1 + p.minPctAboveLow / 100) * m.low52,
    nearHigh: m.currentClose >= (1 - p.maxPctBelowHigh / 100) * m.high52,
    rsRating: m.rsRating >= p.rsCutoff,
  }
  const vals = Object.values(conditions)
  return { conditions, passes: vals.every(Boolean), met: vals.filter(Boolean).length }
}

// Null SMA (insufficient history) fails any comparison.
function num(n: number | null): number {
  return n == null ? Number.NEGATIVE_INFINITY : n
}
