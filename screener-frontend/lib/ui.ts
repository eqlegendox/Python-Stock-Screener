import type { Signal } from './metrics'

// Series colors for the moving averages (distinct, readable on near-black).
export const MA_COLORS = {
  sma50: '#5b8cff', // electric blue — fast
  sma150: '#c084fc', // violet — medium
  sma200: '#f0883e', // amber — slow
}

// Up/down for price action.
export const UP = '#36e27b'
export const DOWN = '#ff5470'

// Distinct compare palette.
export const COMPARE_COLORS = [
  '#36e27b',
  '#5b8cff',
  '#f0883e',
  '#c084fc',
  '#22d3ee',
  '#facc15',
]

export function compareColor(i: number): string {
  return COMPARE_COLORS[i % COMPARE_COLORS.length]
}

export interface SignalStyle {
  label: string
  short: string
  color: string
  bg: string
  border: string
}

export const SIGNAL_STYLES: Record<Signal, SignalStyle> = {
  STRONG: {
    label: 'Strong uptrend',
    short: 'STRONG',
    color: 'var(--up)',
    bg: 'rgba(54, 226, 123, 0.12)',
    border: 'rgba(54, 226, 123, 0.4)',
  },
  SETUP: {
    label: 'Setup forming',
    short: 'SETUP',
    color: 'var(--accent)',
    bg: 'rgba(91, 140, 255, 0.12)',
    border: 'rgba(91, 140, 255, 0.4)',
  },
  WEAK: {
    label: 'No trend',
    short: 'WEAK',
    color: 'var(--muted)',
    bg: 'rgba(140, 150, 165, 0.08)',
    border: 'rgba(140, 150, 165, 0.28)',
  },
}

export function changeColor(value: number): string {
  if (value > 0) return 'var(--up)'
  if (value < 0) return 'var(--down)'
  return 'var(--muted)'
}
