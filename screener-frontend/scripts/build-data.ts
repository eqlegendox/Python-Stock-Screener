// Local precompute: build the committed JSON snapshot from the cached CSVs.
// Thin wrapper over lib/compute.ts (the shared screen math). Runs before
// dev/build so `npm run dev` works offline from data/.
//
//   tsx scripts/build-data.ts

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv, buildDataset, type Bar } from '../lib/compute'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSV_DIR = join(ROOT, '..', 'stockScreenerStocks')
const DATA_DIR = join(ROOT, 'data')
const STOCKS_DIR = join(DATA_DIR, 'stocks')

function loadBars(): Record<string, Bar[]> {
  const files = readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv'))
  console.log(`Reading ${files.length} CSVs from ${CSV_DIR}`)
  const out: Record<string, Bar[]> = {}
  for (const file of files) {
    out[file.replace(/\.csv$/, '')] = parseCsv(readFileSync(join(CSV_DIR, file), 'utf-8'))
  }
  return out
}

function main() {
  const { screen, stocks } = buildDataset(loadBars())

  rmSync(STOCKS_DIR, { recursive: true, force: true })
  mkdirSync(STOCKS_DIR, { recursive: true })
  for (const [ticker, detail] of Object.entries(stocks)) {
    writeFileSync(join(STOCKS_DIR, `${ticker}.json`), JSON.stringify(detail))
  }
  writeFileSync(join(DATA_DIR, 'screen.json'), JSON.stringify(screen))

  console.log(`Wrote screen.json (${screen.count} stocks, ${screen.passing} passing) + ${screen.count} per-ticker files`)
}

main()
