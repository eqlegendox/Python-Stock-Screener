import type { ScreenRow } from './data'

export type Signal = 'STRONG' | 'SETUP' | 'WEAK'

// Momentum signal from screen pass + how many conditions are met + RS strength.
export function signalFor(row: Pick<ScreenRow, 'passes' | 'conditionsMet' | 'rsRating'>): Signal {
  if (row.passes) return 'STRONG'
  if (row.conditionsMet >= 6 && row.rsRating >= 60) return 'SETUP'
  return 'WEAK'
}

export type Alignment = 'stacked' | 'mixed' | 'inverted'

// Moving-average stack: 50 > 150 > 200 (bullish) … inverted (bearish).
export function maAlignment(row: Pick<ScreenRow, 'sma50' | 'sma150' | 'sma200'>): Alignment {
  const { sma50, sma150, sma200 } = row
  if (sma50 == null || sma150 == null || sma200 == null) return 'mixed'
  if (sma50 > sma150 && sma150 > sma200) return 'stacked'
  if (sma50 < sma150 && sma150 < sma200) return 'inverted'
  return 'mixed'
}

export const ALIGNMENT_LABEL: Record<Alignment, string> = {
  stacked: '50>150>200',
  mixed: 'mixed',
  inverted: 'inverted',
}
