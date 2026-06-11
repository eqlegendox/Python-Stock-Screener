import fs from 'fs'
import path from 'path'
import type { Conditions, ScreenParams } from './screen'
import { isBlobConfigured, readScreenBlob, readStockBlob } from './store'

export interface ScreenRow {
  ticker: string
  currentClose: number
  sma50: number | null
  sma150: number | null
  sma200: number | null
  sma200Prev: number
  low52: number
  high52: number
  pctFromHigh: number
  pctFromLow: number
  return1y: number
  avgVolume: number
  lastDate: string
  rsRating: number
  passes: boolean
  conditionsMet: number
  sparkline: number[]
}

export interface Screen {
  generatedAt: string
  defaults: ScreenParams
  count: number
  passing: number
  stocks: ScreenRow[]
}

export interface SeriesPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  sma50: number | null
  sma150: number | null
  sma200: number | null
}

export interface StockDetail {
  ticker: string
  metrics: ScreenRow & Record<string, number | string | null>
  conditions: Conditions
  passes: boolean
  series: SeriesPoint[]
}

const DATA_DIR = path.join(process.cwd(), 'data')

// Read order: Vercel Blob (production / live data) when configured, else the
// committed JSON snapshot so `npm run dev` works offline.
export async function getScreen(): Promise<Screen> {
  if (isBlobConfigured()) {
    const blob = await readScreenBlob()
    if (blob) return blob
  }
  const raw = fs.readFileSync(path.join(DATA_DIR, 'screen.json'), 'utf-8')
  return JSON.parse(raw) as Screen
}

export async function getStock(ticker: string): Promise<StockDetail | null> {
  if (isBlobConfigured()) {
    const blob = await readStockBlob(ticker)
    if (blob) return blob
  }
  const file = path.join(DATA_DIR, 'stocks', `${ticker.toUpperCase()}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as StockDetail
}
