import { _electron as electron } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs/promises'
const env = { ...process.env, DOIT_DATA_DIR: path.resolve('.test-data/smoke') }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['.'], env, timeout: 60000 })
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('pageerror', (e) => console.error('PAGE ERROR', e))
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('CONSOLE', m.text())
  })
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await fs.mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/smoke.png' })
  console.log(
    'App launched:',
    await page.title(),
    await page.locator('.task-row').count(),
    'task rows',
  )
  console.log(
    'Layout:',
    await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      app: !!window.desktop,
    })),
  )
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  await app.close()
}
