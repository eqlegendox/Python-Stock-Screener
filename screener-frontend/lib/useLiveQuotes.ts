'use client'

import { useEffect, useMemo, useState } from 'react'
import { isMarketOpen } from './market'
import type { Quote } from './quotes'

export interface LiveState {
  quotes: Record<string, Quote>
  asOf: number | null
  live: boolean // got fresh quotes this cycle
  marketOpen: boolean
}

// Polls /api/quotes for the given tickers. Only fetches during US market hours
// and when the tab is visible, so we respect the provider's free-tier limits.
export function useLiveQuotes(symbols: string[], intervalMs = 45_000): LiveState {
  const key = useMemo(
    () => Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort().join(','),
    [symbols],
  )
  const [state, setState] = useState<LiveState>({ quotes: {}, asOf: null, live: false, marketOpen: false })

  useEffect(() => {
    if (!key) {
      setState({ quotes: {}, asOf: null, live: false, marketOpen: isMarketOpen() })
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      timer = setTimeout(tick, intervalMs)
    }

    const tick = async () => {
      const open = isMarketOpen()
      if ((typeof document !== 'undefined' && document.hidden) || !open) {
        if (!cancelled) setState((s) => ({ ...s, live: false, marketOpen: open }))
        schedule()
        return
      }
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`)
        if (res.ok) {
          const data = (await res.json()) as { quotes: Record<string, Quote>; asOf: number }
          if (!cancelled) {
            setState({
              quotes: data.quotes ?? {},
              asOf: data.asOf ?? Date.now(),
              live: Object.keys(data.quotes ?? {}).length > 0,
              marketOpen: true,
            })
          }
        }
      } catch {
        /* keep last known quotes */
      }
      schedule()
    }

    tick()
    const onVis = () => {
      if (!document.hidden) {
        clearTimeout(timer)
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [key, intervalMs])

  return state
}
