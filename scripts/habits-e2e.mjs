import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/habits-${Date.now()}`)
const env = { ...process.env, DOIT_DATA_DIR: testDir }
delete env.ELECTRON_RUN_AS_NODE
await fs.mkdir(testDir, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
const localDate = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = localDate(),
  yesterday = localDate(-1)
const errors = []
let app, page
const read = () => page.evaluate(() => window.desktop.load())
const saved = () => expect(page.locator('.save-status')).toHaveText('已保存到本机')
async function launch() {
  app = await electron.launch({ args: ['.'], env, timeout: 60000 })
  page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await page.getByRole('button', { name: '打卡', exact: true }).click()
  await page.getByRole('heading', { name: '日常打卡', exact: true }).waitFor()
  await saved()
}
try {
  await launch()
  assert.equal((await read()).habits.length, 6)
  await page.screenshot({ path: 'test-results/habits-preview.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: '新建习惯', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '养成一个新习惯', exact: true })
  await dialog.getByRole('button', { name: '阅读', exact: true }).click()
  await expect(dialog.getByLabel('习惯名称')).toHaveValue('阅读')
  await expect(dialog.getByLabel('每个计划日的基本目标')).toHaveValue('30')
  await page.screenshot({ path: 'test-results/habits-editor.png' })
  await dialog.getByLabel('习惯名称').fill('深度阅读验证')
  await dialog.getByLabel('开始日期').fill(yesterday)
  await dialog.getByLabel('分组', { exact: true }).selectOption('__new')
  await dialog.getByLabel('新分组名称').fill('我的自定义组')
  await dialog.getByRole('button', { name: '创建习惯', exact: true }).click()
  await saved()
  let h = (await read()).habits.find((h) => h.name === '深度阅读验证')
  assert.ok((await read()).habitGroups.some((g) => g.id === h.groupId && g.name === '我的自定义组'))
  for (const [value, level, done] of [
    [15, 1, false],
    [30, 2, true],
    [60, 3, true],
    [90, 4, true],
  ]) {
    await page.getByLabel('深度阅读验证当日总量').fill(String(value))
    await page.getByRole('button', { name: '保存记录', exact: true }).click()
    await saved()
    h = (await read()).habits.find((item) => item.name === '深度阅读验证')
    assert.equal(h.records[today].value, value)
    await expect(page.locator(`.habit-calendar-grid button[aria-label^="${today} "]`)).toHaveClass(
      new RegExp(`intensity-${level}`),
    )
    await expect(page.locator('.habit-record-state')).toHaveText(done ? '已达标' : '进行中')
  }
  await page.locator(`.habit-calendar-grid button[aria-label^="${yesterday} "]`).click()
  await page.getByLabel('深度阅读验证当日总量').fill('45')
  await page.getByRole('button', { name: '保存记录', exact: true }).click()
  await saved()
  assert.equal(
    (await read()).habits.find((h) => h.name === '深度阅读验证').records[yesterday].value,
    45,
  )
  await page.getByRole('button', { name: '今天', exact: true }).click()
  await page.getByRole('button', { name: '下一周的习惯', exact: true }).click()
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '今天', exact: true }).click()
  console.log(
    'PASS: preset, custom group, daily totals, 30/60/90 intensity, historical entry, future lock',
  )

  await page.keyboard.press('Control+n')
  dialog = page.getByRole('dialog', { name: '养成一个新习惯', exact: true })
  await dialog.getByLabel('习惯名称').fill('拉伸打卡验证')
  await dialog.getByLabel('频率', { exact: true }).selectOption('custom')
  // Explicitly choose all seven days so this check also runs on weekends.
  for (const name of ['六', '日']) await dialog.getByRole('button', { name, exact: true }).click()
  await dialog.getByRole('button', { name: '创建习惯', exact: true }).click()
  await page.getByRole('button', { name: '打卡 拉伸打卡验证', exact: true }).click()
  await saved()
  assert.equal((await read()).habits.find((h) => h.name === '拉伸打卡验证').records[today].value, 1)
  await page.getByRole('button', { name: '撤销打卡', exact: true }).click()
  await saved()
  assert.equal(
    (await read()).habits.find((h) => h.name === '拉伸打卡验证').records[today],
    undefined,
  )
  await page.getByRole('button', { name: '编辑习惯 拉伸打卡验证', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '编辑习惯', exact: true })
  await dialog.getByLabel('习惯名称').fill('拉伸习惯已编辑')
  await dialog.getByRole('button', { name: '保存习惯', exact: true }).click()
  await saved()
  await page.getByRole('button', { name: '删除习惯 拉伸习惯已编辑', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '删除习惯', exact: true }).click()
  await saved()
  assert.equal(
    (await read()).habits.some((h) => h.name === '拉伸习惯已编辑'),
    false,
  )
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await saved()
  assert.equal(
    (await read()).habits.some((h) => h.name === '拉伸习惯已编辑'),
    true,
  )
  await page.getByLabel('搜索习惯').fill('深度阅读验证')
  await expect(page.locator('.habit-card')).toHaveCount(1)
  await page.getByLabel('搜索习惯').fill('')
  await page.getByRole('tab', { name: '打卡总览', exact: true }).click()
  await expect(page.locator('.habit-overview-row')).toHaveCount(8)
  await page.screenshot({ path: 'test-results/habits-overview.png' })
  console.log(
    'PASS: custom frequency, boolean completion/undo, edit, deletion/restore, search, overview',
  )

  const tasksBefore = (await read()).tasks
  await app.close()
  await launch()
  h = (await read()).habits.find((h) => h.name === '深度阅读验证')
  assert.equal(h.records[today].value, 90)
  assert.equal(h.records[yesterday].value, 45)
  assert.deepEqual((await read()).tasks, tasksBefore)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 780))
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/habits-compact.png' })
  assert.deepEqual(errors, [])
  console.log('PASS: restart persistence, unchanged tasks, compact window, no renderer errors')
  console.log('ALL HABIT END-TO-END CHECKS PASSED.')
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/habits-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
