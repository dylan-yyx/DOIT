import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/e2e-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
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

try {
  await launch()
  await saved()
  await page.screenshot({ path: 'test-results/01-today.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  console.log('PASS: native window, initial data, local persistence, initial layout')

  await page.getByLabel('快速添加事项').fill('桌面验证事项')
  await page.getByLabel('快速添加事项').press('Enter')
  await page.getByRole('button', { name: '完成 桌面验证事项', exact: true }).click()
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
  await dialog.getByRole('button', { name: '图标 Sprout', exact: true }).click()
  await dialog.getByRole('button', { name: '保存文件夹', exact: true }).click()
  await page.getByRole('button', { name: '新建清单或文件夹', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('清单名称').fill('验证清单')
  await dialog.getByLabel('所在文件夹').selectOption({ label: '验证文件夹' })
  await dialog.getByRole('button', { name: '颜色 #937caf', exact: true }).click()
  await dialog.getByRole('button', { name: '保存清单', exact: true }).click()
  await page.getByRole('button', { name: '新建标签', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('标签名称').fill('验证标签')
  await dialog.getByRole('button', { name: '保存标签', exact: true }).click()
  console.log('PASS: folder, nested list, icon, color and cross-list tag creation')

  dialog = await openNew('每日验证任务')
  await dialog.getByLabel('所属清单').selectOption({ label: '验证清单' })
  await dialog.getByLabel('重复方式').selectOption('daily')
  await dialog.getByLabel('时间方式').selectOption('range')
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
  await page.getByRole('tab', { name: '周视图', exact: true }).click()
  if (new Date(`${today}T12:00:00`).getDay() === 0)
    await page.getByRole('button', { name: '下一期', exact: true }).click()
  await page.locator(`[data-date="${tomorrow}"] [data-task-id="${repeated.id}"]`).click()
  await expect(page.locator('.detail-panel .completed-badge')).toHaveCount(0)
  await expect(page.locator('.detail-panel .detail-check.checked')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/02-week.png' })
  await page.getByRole('tab', { name: '月视图', exact: true }).click()
  await expect(page.locator('.calendar-day')).toHaveCount(42)
  await page.screenshot({ path: 'test-results/03-month.png' })
  console.log(
    'PASS: time range, daily repetition, independent checklist completion, week/month views',
  )

  await page.getByRole('tab', { name: '列表', exact: true }).click()
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
  await expect(page.locator('.task-row-title>span')).toHaveText('每日验证任务')
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
  await page.getByRole('button', { name: '记账', exact: true }).click()
  await expect(page.getByRole('heading', { name: '生活账本', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '资产', exact: true }).click()
  await expect(page.getByRole('heading', { name: '我的投资', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '从第一项投资开始', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/05-assets-empty.png' })
  await page.getByRole('button', { name: '待办', exact: true }).click()
  await page.getByRole('button', { name: '查看进度 读完《掌控习惯》', exact: true }).click()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 780))
  await page.waitForTimeout(500)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/06-small-window.png' })
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
