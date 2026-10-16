// Runs every scenario in scenarios.json through a running copy of the Worker.
//
//   npx wrangler dev --remote                         # in one terminal (real Clef-flash)
//   node scripts/run-scenarios.mjs                    # results/<id>.json
//   node scripts/run-scenarios.mjs --screenshots      # + screenshots/<id>.png of the try-it page
//
// BASE_URL changes where it points (default http://localhost:8787).
// Screenshots use Playwright; set CHROMIUM_PATH to use a browser that's already installed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8787'
const screenshots = process.argv.includes('--screenshots')
const scenarios = JSON.parse(readFileSync(new URL('../scenarios.json', import.meta.url), 'utf8'))

mkdirSync('results', { recursive: true })
const pct = p => `${Math.round(p * 100)}%`.padStart(4)

for (const s of scenarios) {
  const res = await fetch(`${BASE_URL}/judge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: s.action, context: s.context }),
  })
  const body = await res.json()
  if (!res.ok) { console.error(`✗ ${s.id}: ${res.status} ${body.error}`); process.exitCode = 1; continue }
  writeFileSync(`results/${s.id}.json`, JSON.stringify({ scenario: s, result: body, ranAt: new Date().toISOString() }, null, 2) + '\n')
  console.log(`\n${s.title}: ${body.verdict} (lowest ${pct(body.min)}, highest ${pct(body.max)})`)
  for (const t of body.theories) console.log(`  ${pct(t.probability)}  ${t.name}${t.inVerdict ? '' : ' (not counted)'}`)
}

if (screenshots) {
  const { chromium } = await import('playwright')
  mkdirSync('screenshots', { recursive: true })
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  for (const s of scenarios) {
    await page.goto(BASE_URL)
    await page.fill('#action', s.action)
    await page.fill('#context', s.context ?? '')
    await page.click('#go')
    await page.locator('#out .verdict, #out .error').first().waitFor({ timeout: 30000 })
    await page.locator('main').screenshot({ path: `screenshots/${s.id}.png` })
    console.log(`saved screenshots/${s.id}.png`)
  }
  await browser.close()
  console.log('\nScreenshots are in screenshots/')
}
