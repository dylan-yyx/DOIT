import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { writeLegacyFixture } from './test-fixtures.mjs'

const testDir = path.resolve(`.test-data/e2e-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
await writeLegacyFixture(testDir)
await fs.mkdir('test-results', { recursive: true })
const env = { ...process.env, DOIT_DATA_DIR: testDir }
delete env.ELECTRON_RUN_AS_NODE
const errors = []
let app, page
const launch = async () => {
  app = await electron.launch({
    ...(process.env.DOIT_EXECUTABLE
      ? { executablePath: path.resolve(process.env.DOIT_EXECUTABLE), args: [] }
      : { args: ['.'] }),
    env,
    timeout: 60000,
  })
  page = await app.firstWindow()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
}
const read = () => page.evaluate(() => window.desktop.load())
const saved = async () => {
  await expect(page.locator('.save-status')).toHaveText('已保存到本机')
}
const openNew = async (name) => {
  await page.keyboard.press('Control+n')
  const dialog = page.getByRole('dialog', { name: '新建事项', exact: true })
  await dialog.getByLabel('事项名称').fill(name)
  return dialog
}
const localDate = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = localDate(),
  tomorrow = localDate(1)
async function expectCompactSummary(actions, maxHeight) {
  const summary = page.locator('main .module-summary-row')
  const buttons = summary.locator('.module-summary-actions').getByRole('button')
  await expect(buttons).toHaveText(actions)
  const dimensions = await summary.evaluate((row) => {
    const stats = row.firstElementChild.getBoundingClientRect()
    const buttons = [...row.querySelectorAll('.module-summary-actions button')].map((button) =>
      button.getBoundingClientRect(),
    )
    return {
      height: row.offsetHeight,
      rightAligned: buttons.every((button) => button.left >= stats.right),
      stacked: buttons.every((button, i) => i === 0 || button.top >= buttons[i - 1].bottom),
    }
  })
  assert.ok(dimensions.height <= maxHeight, JSON.stringify(dimensions))
  assert.ok(dimensions.rightAligned && dimensions.stacked)
  await expect(page.locator('main .breadcrumb h1')).toBeVisible()
}

try {
  await launch()
  await saved()
  await expectCompactSummary(['新建事项'], 62)
  const progressBar = page.getByRole('progressbar', { name: '今日完成进度' })
  const completedBefore = Number(await progressBar.getAttribute('value'))
  await page.screenshot({ path: 'test-results/01-today.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  console.log('PASS: native window, initial data, local persistence, initial layout')

  await page.getByLabel('快速添加事项').fill('桌面验证事项')
  await page.getByLabel('快速添加事项').press('Enter')
  await page.getByRole('button', { name: '完成 桌面验证事项', exact: true }).click()
  await expect(progressBar).toHaveAttribute('value', String(completedBefore + 1))
  await saved()
  assert.equal((await read()).tasks.find((t) => t.title === '桌面验证事项').completed, true)
  await app.close()
  await launch()
  assert.equal((await read()).tasks.find((t) => t.title === '桌面验证事项').completed, true)
  console.log('PASS: quick creation, completion, close and relaunch restore')

  await page.getByRole('button', { name: '新建清单或文件夹', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '文件夹', exact: true }).click()
  await dialog.getByLabel('文件夹名称').fill('验证文件夹')
  await dialog.getByRole('button', { name: '图标 嫩芽', exact: true }).click()
  await dialog.getByRole('button', { name: '保存文件夹', exact: true }).click()
  const folderActions = page.getByRole('button', { name: '文件夹操作 验证文件夹', exact: true })
  const folderMenu = page.getByRole('group', { name: '验证文件夹的操作', exact: true })
  await folderActions.click()
  await expect(folderMenu).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const triggerBox = await folderActions.boundingBox()
  const menuBox = await folderMenu.boundingBox()
  assert.ok(Math.abs(triggerBox.x + triggerBox.width - menuBox.x - menuBox.width) < 3)
  await page.keyboard.press('Escape')
  await expect(folderMenu).toBeHidden()
  await page.getByRole('button', { name: '验证文件夹', exact: true }).click()
  await folderActions.click()
  await folderMenu.getByRole('button', { name: '编辑文件夹', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '编辑文件夹' })
  await expect(dialog.getByRole('button', { name: '图标 嫩芽' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await dialog.getByRole('button', { name: '更多图标' }).click()
  await dialog.getByRole('button', { name: '图标 山峰', exact: true }).click()
  await dialog.getByRole('button', { name: '保存文件夹' }).click()
  await saved()
  const folder = (await read()).folders.find((item) => item.name === '验证文件夹')
  assert.equal(folder.icon, 'Mountain')
  assert.equal(folder.collapsed, true)

  await folderActions.click()
  await folderMenu.getByRole('button', { name: '添加新清单', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('清单名称').fill('验证清单')
  await expect(dialog.getByLabel('所在文件夹')).toHaveValue(folder.id)
  await expect(dialog.getByRole('group', { name: '常用图标' }).getByRole('button')).toHaveCount(8)
  await expect(dialog.getByRole('group', { name: '经典色系' }).getByRole('button')).toHaveCount(9)
  await dialog.getByRole('button', { name: '更多图标' }).click()
  await dialog.getByRole('button', { name: '图标 影视', exact: true }).click()
  await expect(
    dialog.getByRole('group', { name: '常用图标' }).getByRole('button', { name: '图标 影视' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: '更多色系' }).click()
  await expect(dialog.getByRole('group', { name: '孟菲斯色系' })).toBeVisible()
  await dialog
    .getByRole('group', { name: '马卡龙色系' })
    .getByRole('button', { name: '颜色 #dc8ba2' })
    .click()
  await expect(dialog.getByRole('group', { name: '马卡龙色系' }).getByRole('button')).toHaveCount(9)
  await expect(dialog.getByRole('group', { name: '经典色系' })).toHaveCount(0)
  await dialog.screenshot({ path: 'test-results/list-style.png' })
  await dialog.getByRole('button', { name: '保存清单', exact: true }).click()
  await expect(
    page.locator('.folder-lists').getByRole('button', { name: '验证清单', exact: true }),
  ).toBeVisible()
  await saved()
  const nestedList = (await read()).lists.find((item) => item.name === '验证清单')
  assert.equal(nestedList.icon, 'Clapperboard')
  assert.equal(nestedList.color, '#dc8ba2')
  assert.equal(nestedList.folderId, folder.id)
  await page.getByRole('button', { name: '新建标签', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('标签名称').fill('验证标签')
  await dialog.getByRole('button', { name: '保存标签', exact: true }).click()
  console.log('PASS: folder, nested list, icon, color and cross-list tag creation')

  dialog = await openNew('每日验证任务')
  await dialog.getByLabel('所属清单').selectOption({ label: '验证清单' })
  await dialog.getByLabel('重复方式').selectOption('daily')
  await dialog.getByLabel('安排类型').selectOption('range')
  await dialog.getByLabel('设置时间', { exact: true }).check()
  await dialog.getByLabel('开始时间').fill('09:00')
  await dialog.getByLabel('结束时间').fill('10:30')
  await dialog.getByRole('button', { name: '验证标签', exact: true }).click()
  await dialog.getByLabel('备注', { exact: true }).fill('验证备注可搜索，并且重启后仍然存在。')
  await dialog.getByRole('button', { name: '添加检查事项', exact: true }).click()
  await dialog.getByLabel('子任务 1', { exact: true }).fill('验证第一步')
  await dialog.getByRole('button', { name: '添加检查事项', exact: true }).click()
  await dialog.getByLabel('子任务 2', { exact: true }).fill('验证第二步')
  await dialog.getByRole('button', { name: '保存事项', exact: true }).click()
  await page
    .locator('.detail-panel')
    .getByRole('button', { name: '验证第一步', exact: true })
    .click()
  await expect(page.locator('.detail-panel .completed-badge')).toHaveCount(0)
  await page
    .locator('.detail-panel')
    .getByRole('button', { name: '验证第二步', exact: true })
    .click()
  await expect(page.locator('.detail-panel .completed-badge')).toHaveText('已完成')
  await saved()
  let repeated = (await read()).tasks.find((t) => t.title === '每日验证任务')
  assert.equal(repeated.occurrences[today].completed, true)
  assert.equal(repeated.occurrences[tomorrow], undefined)
  assert.equal(repeated.completed, false)
  await expect(page.getByRole('tab', { name: '周视图', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^全部事项/ }).click()
  await expect(page.getByRole('tab', { name: '月视图', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.calendar-day')).toHaveCount(42)
  await page.getByRole('tab', { name: '日视图', exact: true }).click()
  await expect(page.locator('.calendar-day')).toHaveCount(1)
  await page.getByRole('button', { name: '下一期', exact: true }).click()
  const tomorrowEvent = page.locator(`[data-date="${tomorrow}"] [data-task-id="${repeated.id}"]`)
  await tomorrowEvent.getByRole('button', { name: '改名 每日验证任务', exact: true }).click()
  await expect(tomorrowEvent.getByRole('textbox', { name: '修改事项名称' })).toBeFocused()
  await expect(page.locator('.detail-panel h2')).toHaveText('每日验证任务')
  await tomorrowEvent.getByRole('textbox', { name: '修改事项名称' }).press('Escape')
  await page.getByRole('button', { name: '今天', exact: true }).click()
  await page.getByRole('tab', { name: '周视图', exact: true }).click()
  if (new Date(`${today}T12:00:00`).getDay() === 0)
    await page.getByRole('button', { name: '下一期', exact: true }).click()
  await page.locator(`[data-date="${tomorrow}"] [data-task-id="${repeated.id}"]`).click()
  await expect(page.locator('.detail-panel .completed-badge')).toHaveCount(0)
  await expect(page.locator('.detail-panel .detail-check.checked')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/02-week.png' })
  await page.getByRole('tab', { name: '月视图', exact: true }).click()
  await expect(page.locator('.calendar-day')).toHaveCount(42)
  const monthHeights = await page
    .locator('.calendar-day')
    .evaluateAll((cells) => cells.map((cell) => cell.clientHeight))
  assert.ok(monthHeights.every((height) => height >= 80 && height <= 122))
  await page.screenshot({ path: 'test-results/03-month.png' })
  console.log(
    'PASS: time range, daily repetition, independent checklist completion, day/week/month views',
  )

  await page.getByRole('button', { name: /^我的一天/ }).click()
  dialog = await openNew('20 章阅读验证')
  await dialog.getByRole('button', { name: '进度事项', exact: true }).click()
  await dialog.getByLabel('开始日期').fill(today)
  await dialog.getByLabel('结束日期').fill(localDate(4))
  await dialog.getByLabel('总目标').fill('20')
  await dialog.getByLabel('单位', { exact: true }).fill('章')
  await page.screenshot({ path: 'test-results/04-task-editor.png' })
  await dialog.getByRole('button', { name: '保存事项', exact: true }).click()
  await page.getByRole('button', { name: '记录进度', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '记录一点进展', exact: true })
  await dialog.getByLabel('本次完成（章）').fill('3')
  await dialog.getByLabel('随手记（可选）').fill('第一天读完 3 章。')
  await dialog.getByRole('button', { name: '保存进度', exact: true }).click()
  await expect(page.locator('.pace-message strong')).toHaveText('比计划少 1 章')
  await expect(page.locator('.pace-message p')).toHaveText('每天计划 4 章 · 第 1 / 5 天')
  await page.getByRole('button', { name: '记录进度', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '记录一点进展', exact: true })
  await dialog.getByLabel('本次完成（章）').fill('17')
  await dialog.getByRole('button', { name: '保存进度', exact: true }).click()
  await expect(page.getByRole('button', { name: '已完成目标', exact: true })).toBeDisabled()
  await page
    .locator('.history-item')
    .filter({ hasText: '+17 章' })
    .getByRole('button', { name: '删除进度记录', exact: true })
    .click()
  await expect(page.locator('.pace-message strong')).toHaveText('比计划少 1 章')
  console.log(
    'PASS: progress logging, 20 chapters / 5 days calculation, auto completion and record correction',
  )

  await page.keyboard.press('Control+k')
  await page.getByLabel('搜索事项', { exact: true }).fill('验证备注可搜索')
  await expect(page.locator('.task-row')).toHaveCount(1)
  await expect(page.locator('.task-row-title')).toHaveText('每日验证任务')
  await page.getByRole('button', { name: '清空搜索', exact: true }).click()
  await page.getByRole('button', { name: '编辑清单 验证清单', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '删除清单', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click()
  await saved()
  repeated = (await read()).tasks.find((t) => t.id === repeated.id)
  assert.equal(repeated.listId, 'inbox')
  console.log('PASS: global note search and list deletion preserving tasks')

  // Only the OS file chooser is stubbed. Export/import still exercise the real native IPC and disk IO.
  const backupPath = path.join(testDir, 'roundtrip-backup.json')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, backupPath)
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '导出', exact: true }).click()
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await fs.readFile(backupPath, 'utf8')).version
      } catch {
        return null
      }
    })
    .toBe(1)
  const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'))
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click()
  await page.getByLabel('快速添加事项').fill('导入后应被替换的临时事项')
  await page.getByLabel('快速添加事项').press('Enter')
  await saved()
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, backupPath)
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '导入', exact: true }).click()
  await page
    .getByRole('dialog', { name: '导入这份备份？', exact: true })
    .getByRole('button', { name: '确认导入', exact: true })
    .click()
  await saved()
  assert.equal((await read()).tasks.length, backup.tasks.length)
  assert.equal(
    (await read()).tasks.some((t) => t.title === '导入后应被替换的临时事项'),
    false,
  )
  assert.equal((await fs.stat(path.join(testDir, 'data.json.bak'))).isFile(), true)
  console.log('PASS: native export and confirmed import roundtrip, previous-save backup')

  await page.getByRole('button', { name: '打卡', exact: true }).click()
  await expect(page.getByRole('heading', { name: '日常打卡', exact: true })).toBeVisible()
  await expectCompactSummary(['新建习惯'], 62)
  await page.getByRole('button', { name: '记账', exact: true }).click()
  await expect(page.getByRole('heading', { name: '生活账本', exact: true })).toBeVisible()
  await expectCompactSummary(['记一笔'], 110)
  await page.getByRole('button', { name: '资产', exact: true }).click()
  await expect(page.getByRole('heading', { name: '我的投资', exact: true })).toBeVisible()
  await expectCompactSummary(['记一笔投资', '新增投资'], 116)
  await expect(page.getByRole('heading', { name: '从第一项投资开始', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/05-assets-empty.png' })
  await page.getByRole('button', { name: '待办', exact: true }).click()
  await page.getByRole('button', { name: '查看进度 读完《掌控习惯》', exact: true }).click()
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1080, 700)
  })
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1080)
  await expectCompactSummary(['新建事项'], 62)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/06-small-window.png' })
  await page.getByRole('button', { name: /^全部事项/ }).click()
  await page.getByRole('tab', { name: '周视图', exact: true }).click()
  await page.getByRole('button', { name: '上一期', exact: true }).click()
  const action = page.locator('.view-toolbar').getByRole('button', { name: '新建事项' })
  assert.ok(
    await action.evaluate(
      (button) =>
        button.getBoundingClientRect().right <=
        button.closest('main').getBoundingClientRect().right,
    ),
  )
  for (const [module, labels, height] of [
    ['打卡', ['新建习惯'], 62],
    ['记账', ['记一笔'], 110],
    ['资产', ['记一笔投资', '新增投资'], 116],
  ]) {
    await page.getByRole('button', { name: module, exact: true }).click()
    await expectCompactSummary(labels, height)
  }
  assert.deepEqual(errors, [])
  console.log('PASS: habits, finance and assets modules, compact window layout, no renderer errors')
  console.log(`ALL END-TO-END CHECKS PASSED. Data: ${testDir}`)
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
