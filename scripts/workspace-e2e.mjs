import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { legacyFixture } from './test-fixtures.mjs'

const testDir = path.resolve(`.test-data/workspace-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
const dataFile = path.join(testDir, 'data.json')
const fixture = await legacyFixture()
const localDay = (offset = 0) => {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  return day.toLocaleDateString('sv-SE')
}
const today = localDay()
const stamp = new Date().toISOString()
const longList = '验证拖动时仍能完整显示的很长很长的清单名称'
const longCheck = '这是一条用来确认检查事项可以完整显示而且还能继续直接编辑的长文字。'.repeat(4)
const normal = {
  ...fixture.tasks[1],
  id: 'date-normal',
  title: '普通事项日期测试',
  listId: 'reading',
  startDate: today,
  dueDate: today,
  repeat: 'none',
  timeMode: 'allday',
  occurrences: {},
  repeatUntil: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  notes: '',
  checklist: [{ id: 'long', title: longCheck }],
}
const repeating = {
  ...normal,
  id: 'date-repeat',
  title: '重复事项日期测试',
  repeat: 'daily',
  timeMode: 'range',
  repeatUntil: localDay(2),
  createdAt: '2026-01-02T00:00:00.000Z',
  occurrences: { [today]: { checks: ['long'], completed: true } },
}
const progress = {
  ...fixture.tasks[0],
  id: 'date-progress',
  title: '进度事项日期测试',
  listId: 'reading',
  startDate: today,
  dueDate: localDay(8),
  createdAt: '2026-01-03T00:00:00.000Z',
  entries: [{ id: 'work', date: today, amount: 2 }],
}
fixture.tasks = [normal, repeating, progress]
fixture.lists.find((list) => list.id === 'reading').name = longList
fixture.finance.accounts[0].openingBalance = 2500
fixture.finance.entries = [
  {
    id: 'expense',
    type: 'expense',
    title: '隔离账目',
    date: today,
    accountId: 'alipay',
    categoryId: 'food',
    note: '',
    amount: 180,
    createdAt: stamp,
  },
]
fixture.assets.products = [
  {
    id: 'investment',
    name: '隔离投资',
    code: '',
    category: 'fund',
    platform: '测试账户',
    mode: 'amount',
    note: '',
    createdAt: stamp,
  },
]
await fs.writeFile(dataFile, JSON.stringify(fixture))

let app, page
const errors = []
const read = () => fs.readFile(dataFile, 'utf8').then(JSON.parse)
const detail = () => page.getByRole('complementary', { name: '事项详情', exact: true })
const dateDialog = () => page.getByRole('dialog', { name: '设置事项日期', exact: true })
const settings = () => page.getByRole('dialog', { name: '设置与数据', exact: true })
const clearDialog = () => page.getByRole('dialog', { name: '确认清空模块数据', exact: true })
const list = () =>
  page.locator('.task-sidebar').getByRole('button', { name: new RegExp(`^${longList}`) })
const taskRow = (id) => page.locator(`.task-row[data-task-id="${id}"]`)
const rowTitles = () => page.locator('.task-row-title')
const sidebarItem = (key) => page.locator(`[data-sidebar-key="${key}"]`)
const sortBy = async (name) => {
  await page.getByRole('button', { name: '显示与排序', exact: true }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
const width = (side) =>
  page.getByRole('separator', {
    name: side === 'left' ? '调整左侧清单栏宽度' : '调整右侧详情栏宽度',
  })

async function launch() {
  const env = { ...process.env, DOIT_DATA_DIR: testDir }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({
    ...(process.env.DOIT_TEST_EXE
      ? { executablePath: process.env.DOIT_TEST_EXE, args: [] }
      : { args: ['.'] }),
    env,
    timeout: 60000,
  })
  page = await app.firstWindow()
  page.on('pageerror', (err) => errors.push(err.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await expect(page.locator('.save-status')).toHaveText('已保存到本机')
}

async function drag(side, delta) {
  const box = await width(side).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
}

async function requestClear(...labels) {
  for (const label of labels) await settings().getByLabel(`清空${label}数据`).check()
  await settings().getByRole('button', { name: '清空所选模块', exact: true }).click()
  await expect(clearDialog()).toBeVisible()
}

try {
  await launch()
  await expect(detail()).toHaveClass(/detail-empty/)
  const mainWidth = () => page.locator('.main-panel').evaluate((el) => el.clientWidth)
  const initialMain = await mainWidth()
  await page
    .getByRole('button', { name: '排序文件夹 工作与生活' })
    .dragTo(sidebarItem('folder:personal'), {
      targetPosition: { x: 25, y: 4 },
    })
  await expect(
    page.locator('.list-tree > .folder-group > .folder-heading').first(),
  ).toHaveAttribute('data-sidebar-key', 'folder:work')
  const health = page.getByRole('button', { name: '排序清单 健康生活' })
  await health.dragTo(sidebarItem('folder:work'), { targetPosition: { x: 28, y: 16 } })
  const workLists = sidebarItem('folder:work').locator('..').locator('.folder-lists')
  await expect(workLists.locator('[data-sidebar-key="list:health"]')).toBeVisible()
  await health.dragTo(sidebarItem('list:projects'), { targetPosition: { x: 25, y: 5 } })
  await expect(workLists.locator('[data-sidebar-key]').first()).toHaveAttribute(
    'data-sidebar-key',
    'list:health',
  )
  await health.dragTo(sidebarItem('folder:personal'), { targetPosition: { x: 25, y: 4 } })
  await expect(page.locator('.list-tree > [data-sidebar-key="list:health"]')).toBeVisible()
  await expect(
    page.getByRole('region', { name: longList, exact: true }).locator('.task-row'),
  ).toHaveCount(3)
  await list().click()
  await expect(page.getByRole('tablist', { name: '事项视图' })).toHaveCount(0)
  await expect(page.locator('.task-group')).toHaveCount(0)
  await sortBy('标题拼音')
  await expect(rowTitles()).toHaveText([progress.title, normal.title, repeating.title])
  await sortBy('创建时间（最新优先）')
  await expect(rowTitles()).toHaveText([progress.title, repeating.title, normal.title])
  await sortBy('事项时间')
  await expect(rowTitles()).toHaveText([normal.title, progress.title, repeating.title])
  await sortBy('自定义')
  await page
    .getByRole('button', { name: `排序事项 ${repeating.title}` })
    .dragTo(taskRow(normal.id), {
      targetPosition: { x: 45, y: 5 },
    })
  await expect(rowTitles()).toHaveText([repeating.title, normal.title, progress.title])
  await page.getByRole('button', { name: /^我的一天/ }).click()
  await expect(rowTitles()).toHaveText([normal.title, progress.title, repeating.title])
  await list().click()
  await expect(rowTitles()).toHaveText([repeating.title, normal.title, progress.title])
  await expect(taskRow(progress.id).locator('.task-row-count')).toHaveText(/2\//)
  assert.match(
    await taskRow(progress.id).evaluate((el) => getComputedStyle(el).backgroundImage),
    /linear-gradient/,
  )
  await page.getByRole('textbox', { name: '搜索事项', exact: true }).fill(normal.title)
  await expect(
    page.getByRole('region', { name: longList, exact: true }).locator('.task-row'),
  ).toHaveCount(1)
  await page.getByRole('textbox', { name: '搜索事项', exact: true }).fill('')
  const renamed = '列表内修改的事项'
  await taskRow(normal.id)
    .getByRole('button', { name: `改名 ${normal.title}` })
    .click()
  const rowTitle = taskRow(normal.id).getByRole('textbox', { name: '修改事项名称' })
  await expect(detail().locator('h2')).toHaveText(normal.title)
  assert.equal(await mainWidth(), initialMain)
  await rowTitle.fill(renamed)
  await rowTitle.press('Enter')
  await page.getByRole('button', { name: '收起事项详情栏' }).click()
  await expect(detail()).toHaveCount(0)
  assert.ok((await mainWidth()) > initialMain)
  await taskRow(normal.id).locator('.task-row-schedule').click()
  await detail()
    .getByRole('button', { name: `改名 ${renamed}` })
    .click()
  const detailTitle = detail().getByRole('textbox', { name: '修改事项名称' })
  await detailTitle.fill('这次改名会取消')
  await detailTitle.press('Escape')
  await detail()
    .getByRole('button', { name: `改名 ${renamed}` })
    .click()
  await detailTitle.fill(normal.title)
  await detail().locator('.detail-type').click()
  await expect(taskRow(normal.id).locator('.task-row-title')).toHaveText(normal.title)
  const check = detail().getByRole('textbox', { name: '检查事项 1', exact: true })
  assert.ok(
    await check.evaluate((el) => el.clientHeight > 36 && el.scrollHeight <= el.clientHeight + 1),
  )
  const initialLeft = Number(await width('left').getAttribute('aria-valuenow'))
  const initialRight = Number(await width('right').getAttribute('aria-valuenow'))
  await drag('left', 70)
  await drag('right', -74)
  await expect(width('left')).toHaveAttribute('aria-valuenow', String(initialLeft + 70))
  await expect(width('right')).toHaveAttribute('aria-valuenow', String(initialRight + 74))
  await width('left').press('ArrowRight')
  await expect(width('left')).toHaveAttribute('aria-valuenow', String(initialLeft + 86))
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1080, 720)
  })
  await expect
    .poll(() => page.locator('.main-panel').evaluate((el) => el.clientWidth))
    .toBeGreaterThanOrEqual(460)
  assert.ok(
    await taskRow(progress.id).evaluate(
      (el) => el.clientHeight < 42 && el.scrollWidth <= el.clientWidth,
    ),
  )
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1460, 940))
  await expect(width('right')).toHaveAttribute('aria-valuenow', String(initialRight + 74))
  console.log(
    'PASS: dragged widths, keyboard adjustment, long text wrapping and list label context',
  )

  await detail().getByRole('button', { name: '设置事项日期', exact: true }).click()
  await dateDialog().getByLabel('安排类型').selectOption('range')
  await dateDialog().getByLabel('结束日期').fill(localDay(2))
  await dateDialog().getByLabel('设置时间', { exact: true }).check()
  await dateDialog().getByLabel('开始时间').fill('22:00')
  await dateDialog().getByLabel('结束时间').fill('06:00')
  await dateDialog().getByRole('button', { name: '保存日期', exact: true }).click()
  await expect(taskRow(normal.id).locator('.task-row-schedule')).toContainText(/22:00.*06:00/)
  await page.getByRole('button', { name: '最近七天', exact: true }).click()
  await expect(taskRow(normal.id)).toHaveCount(1)
  await page.getByRole('button', { name: /^全部事项/ }).click()
  for (const offset of [0, 1, 2]) {
    await expect(
      page.locator(`[data-date="${localDay(offset)}"] [data-task-id="${normal.id}"]`),
    ).toBeVisible()
  }
  await list().click()
  await taskRow(normal.id).locator('.task-row-more').click()
  await detail().getByRole('button', { name: '设置事项日期', exact: true }).click()
  await dateDialog().getByLabel('安排类型').selectOption('single')
  await dateDialog().getByLabel('时间', { exact: true }).fill('')
  await dateDialog().getByLabel('设置时间', { exact: true }).uncheck()
  await dateDialog().getByLabel('日期', { exact: true }).fill(localDay(3))
  await dateDialog().getByRole('button', { name: '保存日期', exact: true }).click()
  await expect
    .poll(async () => (await read()).tasks.find((t) => t.id === normal.id).dueDate)
    .toBe(localDay(3))
  await detail().getByRole('button', { name: '设置事项日期', exact: true }).click()
  await dateDialog().getByRole('button', { name: '取消安排', exact: true }).click()
  await expect
    .poll(async () => (await read()).tasks.find((t) => t.id === normal.id).dueDate)
    .toBe('')
  await expect(detail().getByRole('button', { name: '设置事项日期', exact: true })).toContainText(
    '未安排',
  )

  await taskRow(repeating.id).locator('.task-row-more').click()
  await detail().getByRole('button', { name: '设置事项日期', exact: true }).click()
  await dateDialog().getByLabel('重复开始日期', { exact: true }).fill(localDay(4))
  await dateDialog().getByRole('button', { name: '保存日期', exact: true }).click()
  await expect(dateDialog().getByRole('alert')).toContainText('重复截止日期不能早于开始日期')
  await dateDialog().getByLabel('重复截止日期（可选）', { exact: true }).fill(localDay(9))
  await dateDialog().getByRole('button', { name: '保存日期', exact: true }).click()
  await expect
    .poll(async () => (await read()).tasks.find((t) => t.id === repeating.id).startDate)
    .toBe(localDay(4))
  assert.deepEqual(
    (await read()).tasks.find((t) => t.id === repeating.id).occurrences,
    repeating.occurrences,
  )

  await taskRow(progress.id).locator('.task-row-more').click()
  await detail().getByRole('button', { name: '设置事项日期', exact: true }).click()
  await dateDialog().getByLabel('结束日期', { exact: true }).fill(localDay(-1))
  await dateDialog().getByRole('button', { name: '保存日期', exact: true }).click()
  await expect(dateDialog().getByRole('alert')).toContainText('结束日期不能早于开始日期')
  await dateDialog().getByLabel('结束日期', { exact: true }).fill(localDay(12))
  await dateDialog().getByRole('button', { name: '保存日期', exact: true }).click()
  await expect
    .poll(async () => (await read()).tasks.find((t) => t.id === progress.id).dueDate)
    .toBe(localDay(12))
  assert.deepEqual((await read()).tasks.find((t) => t.id === progress.id).entries, progress.entries)
  console.log(
    'PASS: normal and unscheduled dates, recurring schedule and progress dates with history',
  )

  await page.getByRole('button', { name: '新建事项', exact: false }).click()
  const editor = page.getByRole('dialog', { name: '新建事项', exact: true })
  await editor.getByLabel('事项名称').fill('全天时间段测试')
  await editor.getByLabel('所属清单').selectOption('inbox')
  await editor.getByLabel('安排类型').selectOption('range')
  await expect(editor.getByLabel('设置时间', { exact: true })).not.toBeChecked()
  await editor.getByLabel('结束日期').fill(localDay(1))
  await editor.getByRole('button', { name: '保存事项', exact: true }).click()
  await page.getByRole('button', { name: '最近七天', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '收集箱', exact: true }).locator('.task-row'),
  ).toHaveCount(1)
  await expect(
    page.getByRole('region', { name: longList, exact: true }).locator('.task-row'),
  ).not.toHaveCount(0)
  console.log('PASS: all-day range creation and aggregation by source list')

  await app.close()
  app = null
  await launch()
  await list().click()
  await expect(rowTitles()).toHaveText([repeating.title, normal.title, progress.title])
  await expect(page.locator('.list-tree > [data-sidebar-key="list:health"]')).toBeVisible()
  await taskRow(normal.id).locator('.task-row-more').click()
  await expect(width('left')).toHaveAttribute('aria-valuenow', String(initialLeft + 86))
  await expect(width('right')).toHaveAttribute('aria-valuenow', String(initialRight + 74))
  const before = await read()
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await settings().getByRole('tab', { name: '数据管理', exact: true }).click()
  await requestClear('待办', '打卡', '记账')
  await clearDialog().getByLabel('清空确认词').fill('错误确认词')
  await expect(clearDialog().getByRole('button', { name: '确认清空', exact: true })).toBeDisabled()
  await clearDialog().getByRole('button', { name: '取消', exact: true }).click()
  assert.deepEqual(await read(), before)

  await requestClear('待办', '打卡', '记账')
  await app.evaluate(() => {
    const fs = process.getBuiltinModule('node:fs/promises')
    const copyFile = fs.copyFile
    fs.copyFile = async (source, target, ...args) => {
      if (String(target).includes('DOIT-清空前-')) {
        fs.copyFile = copyFile
        throw new Error('模拟备份无法写入')
      }
      return copyFile(source, target, ...args)
    }
  })
  await clearDialog().getByLabel('清空确认词').fill('清空数据')
  await clearDialog().getByRole('button', { name: '确认清空', exact: true }).click()
  await expect(clearDialog().getByRole('alert')).toContainText('模拟备份无法写入')
  assert.deepEqual(await read(), before)
  await clearDialog().getByRole('button', { name: '确认清空', exact: true }).click()
  await expect(clearDialog()).toBeHidden()
  const after = await read()
  for (const field of ['tasks', 'tags', 'tagGroups', 'folders', 'habits', 'habitGroups'])
    assert.deepEqual(after[field], [])
  assert.deepEqual(
    after.lists.map((list) => list.id),
    ['inbox'],
  )
  assert.deepEqual(after.finance.entries, [])
  assert.equal(after.finance.accounts[0].openingBalance, 0)
  assert.deepEqual(after.assets, before.assets)
  assert.deepEqual(after.preferences, before.preferences)
  const backups = (await fs.readdir(testDir)).filter((file) => file.startsWith('DOIT-清空前-'))
  assert.equal(backups.length, 1)
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(testDir, backups[0]), 'utf8')), before)
  await expect(settings().locator('.clear-backup-location')).toContainText(backups[0])

  await requestClear('资产')
  await clearDialog().getByLabel('清空确认词').fill('清空数据')
  await clearDialog().getByRole('button', { name: '确认清空', exact: true }).click()
  await expect(clearDialog()).toBeHidden()
  assert.deepEqual((await read()).assets, { products: [], records: [] })
  await app.close()
  app = null
  await launch()
  assert.deepEqual((await read()).tasks, [])
  assert.deepEqual((await read()).assets.products, [])
  assert.deepEqual(errors, [])
  console.log(
    'PASS: confirmation, failed backup leaves data intact, selective reset, complete backup and restart',
  )
} finally {
  if (app) await app.close().catch(() => {})
}
