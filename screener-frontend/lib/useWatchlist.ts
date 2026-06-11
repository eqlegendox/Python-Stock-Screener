'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'momentum:watchlist'

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

const listeners = new Set<() => void>()
let current: string[] | null = null

function snapshot(): string[] {
  if (current === null) current = read()
  return current
}

function emit() {
  for (const l of listeners) l()
}

function persist(next: string[]) {
  current = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  emit()
}

export function useWatchlist() {
  const [list, setList] = useState<string[]>(snapshot)

  useEffect(() => {
    const update = () => setList(snapshot())
    listeners.add(update)
    update()
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        current = read()
        emit()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(update)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = useCallback((ticker: string) => {
    const t = ticker.toUpperCase()
    const next = snapshot().includes(t) ? snapshot().filter((x) => x !== t) : [...snapshot(), t]
    persist(next)
  }, [])

  const has = useCallback((ticker: string) => list.includes(ticker.toUpperCase()), [list])

  return { list, toggle, has }
}
