// One-time seed: build the dataset from the cached CSVs and upload it to Vercel
// Blob, so the deployed app and the daily cron have a baseline to read/append.
// Requires BLOB_READ_WRITE_TOKEN (run `vercel env pull` or export it first).
//
//   tsx scripts/seed-blob.ts

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv, buildDataset, type Bar } from '../lib/compute'
import { writeDataset } from '../lib/store'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_DIR = join(__dirname, '..', '..', 'stockScreenerStocks')

function loadBars(): Record<string, Bar[]> {
  const files = readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv'))
  const out: Record<string, Bar[]> = {}
  for (const file of files) {
    out[file.replace(/\.csv$/, '')] = parseCsv(readFileSync(join(CSV_DIR, file), 'utf-8'))
  }
  return out
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set. Run `vercel env pull .env.local` first.')
    process.exit(1)
  }
  console.log('Building dataset from CSVs…')
  const { screen, stocks } = buildDataset(loadBars())
  console.log(`Uploading screen.json + ${Object.keys(stocks).length} per-ticker blobs…`)
  await writeDataset(screen, stocks)
  console.log(`Done. ${screen.count} stocks, ${screen.passing} passing.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
