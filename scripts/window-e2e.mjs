import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/window-${Date.now()}`)
const env = { ...process.env, DOIT_DATA_DIR: testDir }
delete env.ELECTRON_RUN_AS_NODE
const settingsFile = path.join(testDir, 'window-settings.json')
let app, page

async function launch() {
  app = await electron.launch({
    ...(process.env.DOIT_EXECUTABLE
      ? { executablePath: path.resolve(process.env.DOIT_EXECUTABLE), args: [] }
      : { args: ['.'] }),
    env,
    timeout: 60000,
  })
  page = await app.firstWindow()
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()))
    .toBe(true)
  // Stub only the native prompt so tests don't need to interact with the OS dialog.
  await app.evaluate(({ dialog, Tray }) => {
    globalThis.closeResponse = 2
    globalThis.promptCalls = 0
    dialog.showMessageBox = async (_window, options) => {
      globalThis.promptCalls++
      if (options.buttons.join(',') !== '最小化到托盘,退出应用,取消')
        throw new Error('Unexpected close choices')
      return { response: globalThis.closeResponse, checkboxChecked: true }
    }
    const setContextMenu = Tray.prototype.setContextMenu
    Tray.prototype.setContextMenu = function (menu) {
      globalThis.doitMenu = menu
      return setContextMenu.call(this, menu)
    }
  })
}

async function quickAdd(title) {
  await page.getByLabel('快速添加事项').fill(title)
  await page.getByLabel('快速添加事项').press('Enter')
  await expect(page.locator('.save-status')).toHaveText('已保存到本机')
  return page.evaluate(
    async (name) => (await window.desktop.load()).tasks.find((t) => t.title === name),
    title,
  )
}
const visible = () =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
const closeButton = () => page.getByRole('button', { name: '关闭软件', exact: true })
const closeChoice = async () => JSON.parse(await fs.readFile(settingsFile, 'utf8')).closeChoice

try {
  await launch()
  const scheduled = await quickAdd('我的一天快捷事项')
  assert.equal(scheduled.dueDate, new Date().toLocaleDateString('sv-SE'))
  await page.getByRole('button', { name: /^收集箱/ }).click()
  const unscheduled = await quickAdd('收集箱快捷事项')
  assert.equal(unscheduled.startDate, '')
  assert.equal(unscheduled.dueDate, '')
  await expect(page.locator('.task-row-schedule').filter({ hasText: '未安排' })).toHaveCount(1)

  await page.getByRole('button', { name: /^我的生活空间/ }).click()
  const rename = page.getByRole('dialog', { name: '重命名生活空间' })
  await rename.getByLabel('生活空间名称').fill('  拾序计划  ')
  await rename.getByRole('button', { name: '保存名称' }).click()
  await expect(page.locator('.workspace-name strong')).toHaveText('拾序计划')
  for (const name of ['打卡', '记账', '资产', '待办']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.workspace-name strong')).toHaveText('拾序计划')
  }

  await closeButton().click()
  await expect.poll(() => app.evaluate(() => globalThis.promptCalls)).toBe(1)
  assert.equal(await visible(), true)
  await assert.rejects(fs.access(settingsFile), { code: 'ENOENT' })
  await app.evaluate(() => {
    globalThis.closeResponse = 0
  })
  await closeButton().click()
  await expect.poll(visible).toBe(false)
  assert.equal(await closeChoice(), 'tray')
  await app.evaluate(() => {
    const open = globalThis.doitMenu.items.find((item) => item.label === '打开 DOIT')
    open.click(open, null, {})
  })
  await expect.poll(visible).toBe(true)
  await app.evaluate(() => {
    const menu = globalThis.doitMenu.items.find((item) => item.label === '关闭按钮行为')
    const ask = menu.submenu.items.find((item) => item.label === '询问')
    ask.click(ask, null, {})
  })
  assert.equal(await closeChoice(), 'ask')
  await closeButton().click()
  await expect.poll(visible).toBe(false)
  assert.equal(await closeChoice(), 'tray')
  await app.close()
  app = null

  await launch()
  await expect(page.locator('.workspace-name strong')).toHaveText('拾序计划')
  await closeButton().click()
  await expect.poll(visible).toBe(false)
  assert.equal(await app.evaluate(() => globalThis.promptCalls), 0)
  await app.evaluate(({ app }) => app.emit('second-instance'))
  await expect.poll(visible).toBe(true)

  await app.close()
  app = null
  await fs.unlink(settingsFile)
  await launch()
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.closeResponse = 1
    setTimeout(() => BrowserWindow.getAllWindows()[0].close(), 50)
  })
  await app.waitForEvent('close')
  app = null
  assert.equal(await closeChoice(), 'quit')
  console.log(
    'PASS: maximized startup, quick-add defaults, workspace name, tray close/reopen and explicit exit',
  )
} finally {
  if (app) await app.close().catch(() => {})
}
