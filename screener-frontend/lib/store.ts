// Blob-backed dataset store. The published screen lives in Vercel Blob so the
// daily cron can rewrite it at runtime (the serverless filesystem is read-only).
// Reads go through the Next fetch cache, tagged so the cron can revalidate.

import { put, list } from '@vercel/blob'
import type { Screen, StockDetail } from './data'

export const SCREEN_TAG = 'screen'
const SCREEN_PATH = 'screen.json'
const stockPath = (ticker: string) => `stocks/${ticker.toUpperCase()}.json`

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

// Resolve a blob's public URL. Prefer a configured base URL (fast, no API call);
// otherwise look it up once via list().
let cachedBase: string | null = process.env.BLOB_BASE_URL ?? null

async function blobUrl(pathname: string): Promise<string | null> {
  if (cachedBase) return `${cachedBase.replace(/\/$/, '')}/${pathname}`
  const { blobs } = await list({ prefix: pathname, limit: 1 })
  const match = blobs.find((b) => b.pathname === pathname) ?? blobs[0]
  if (!match) return null
  // Cache the store's base host for subsequent reads.
  const u = new URL(match.url)
  cachedBase = `${u.protocol}//${u.host}`
  return match.url
}

async function readJson<T>(pathname: string, revalidate: number): Promise<T | null> {
  const url = await blobUrl(pathname)
  if (!url) return null
  // revalidate <= 0 → always fresh (used by the cron); otherwise tag-cached.
  const init: RequestInit = revalidate > 0 ? { next: { tags: [SCREEN_TAG], revalidate } } : { cache: 'no-store' }
  const res = await fetch(url, init)
  if (!res.ok) return null
  return (await res.json()) as T
}

async function writeJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  })
}

export function readScreenBlob(): Promise<Screen | null> {
  return readJson<Screen>(SCREEN_PATH, 3600)
}

export function readStockBlob(ticker: string): Promise<StockDetail | null> {
  return readJson<StockDetail>(stockPath(ticker), 3600)
}

// Fresh reads for the cron (no cache), with bounded concurrency.
export function readScreenFresh(): Promise<Screen | null> {
  return readJson<Screen>(SCREEN_PATH, 0)
}

export async function readAllDetailsFresh(tickers: string[]): Promise<Record<string, StockDetail>> {
  const out: Record<string, StockDetail> = {}
  const CONCURRENCY = 20
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const slice = tickers.slice(i, i + CONCURRENCY)
    const results = await Promise.all(slice.map((t) => readJson<StockDetail>(stockPath(t), 0)))
    results.forEach((d, j) => {
      if (d) out[slice[j]] = d
    })
  }
  return out
}

// Write the whole dataset (screen summary + every per-ticker detail).
export async function writeDataset(
  screen: Screen,
  stocks: Record<string, StockDetail>,
): Promise<void> {
  await writeJson(SCREEN_PATH, screen)
  // Bounded concurrency to stay friendly to the Blob API within the function budget.
  const entries = Object.entries(stocks)
  const CONCURRENCY = 12
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    await Promise.all(entries.slice(i, i + CONCURRENCY).map(([t, d]) => writeJson(stockPath(t), d)))
  }
}
