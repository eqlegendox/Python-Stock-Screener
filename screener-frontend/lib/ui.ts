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
    bg: 'rgba(0, 255, 135, 0.10)',
    border: 'rgba(0, 255, 135, 0.35)',
  },
  SETUP: {
    label: 'Setup forming',
    short: 'SETUP',
    color: 'var(--accent)',
    bg: 'rgba(56, 189, 248, 0.10)',
    border: 'rgba(56, 189, 248, 0.35)',
  },
  WEAK: {
    label: 'No trend',
    short: 'WEAK',
    color: 'var(--amber)',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.28)',
  },
  AVOID: {
    label: 'Avoid',
    short: 'AVOID',
    color: 'var(--down)',
    bg: 'rgba(244, 63, 94, 0.08)',
    border: 'rgba(244, 63, 94, 0.28)',
  },
}

export function changeColor(value: number): string {
  if (value > 0) return 'var(--up)'
  if (value < 0) return 'var(--down)'
  return 'var(--muted)'
}
