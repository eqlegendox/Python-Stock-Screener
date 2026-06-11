import fs from 'fs'
import path from 'path'
import type { Conditions, ScreenParams } from './screen'

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

let cache: Screen | null = null

export function getScreen(): Screen {
  if (cache) return cache
  const raw = fs.readFileSync(path.join(DATA_DIR, 'screen.json'), 'utf-8')
  cache = JSON.parse(raw) as Screen
  return cache
}

export function getTickers(): string[] {
  return getScreen().stocks.map((s) => s.ticker)
}

export function getStock(ticker: string): StockDetail | null {
  const file = path.join(DATA_DIR, 'stocks', `${ticker.toUpperCase()}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as StockDetail
}
