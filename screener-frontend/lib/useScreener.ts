'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScreenRow } from './data'
import type { ScreenParams } from './screen'

const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_URL ?? 'http://localhost:5000'
const AUTO_REFRESH_MS = 60_000
const DEBOUNCE_MS = 400

export interface ScreenMeta {
  generatedAt: string
  count: number
  passing: number
  strongCount: number
}

export interface UseScreenerResult {
  rows: ScreenRow[]
  meta: ScreenMeta | null
  loading: boolean
  error: string | null
  forceRefresh: () => Promise<void>
}

export function useScreener(params: ScreenParams, initialRows: ScreenRow[] = []): UseScreenerResult {
  const [rows, setRows] = useState<ScreenRow[]>(initialRows)
  const [meta, setMeta] = useState<ScreenMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchScreener = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        rsMin: String(params.rsCutoff),
        pctAboveLow: String(params.minPctAboveLow),
        pctBelowHigh: String(params.maxPctBelowHigh),
      })
      const res = await fetch(`${FLASK_URL}/api/screener?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRows(json.stocks ?? [])
      setMeta({
        generatedAt: json.generatedAt,
        count: json.count,
        passing: json.passing,
        strongCount: json.strongCount,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Flask unreachable — showing cached data')
    } finally {
      setLoading(false)
    }
  }, [params.rsCutoff, params.minPctAboveLow, params.maxPctBelowHigh])

  // Debounce param changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchScreener, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchScreener])

  // Auto-refresh every 60s.
  useEffect(() => {
    intervalRef.current = setInterval(fetchScreener, AUTO_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchScreener])

  const forceRefresh = useCallback(async () => {
    setLoading(true)
    try {
      await fetch(`${FLASK_URL}/api/screener/refresh`, { method: 'POST' })
      await fetchScreener()
    } catch {
      await fetchScreener()
    }
  }, [fetchScreener])

  return { rows, meta, loading, error, forceRefresh }
}
