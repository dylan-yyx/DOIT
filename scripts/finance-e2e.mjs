import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/finance-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
const localDate = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = localDate()
const errors = []
let app, page
const read = () => page.evaluate(() => window.desktop.load())
const saved = () => expect(page.locator('.save-status')).toHaveText('已保存到本机')
const dialog = (name) => page.getByRole('dialog', { name, exact: true })
async function launch(dataDir = testDir) {
  const env = { ...process.env, DOIT_DATA_DIR: dataDir }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({
    ...(process.env.DOIT_TEST_EXE
      ? { executablePath: process.env.DOIT_TEST_EXE, args: [] }
      : { args: ['.'] }),
    env,
    timeout: 60000,
  })
  page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await page.getByRole('button', { name: '记账', exact: true }).click()
  await page.getByRole('heading', { name: '生活账本', exact: true }).waitFor()
  await saved()
}
async function create({
  title,
  amount,
  type = '支出',
  account = 'alipay',
  date = today,
  category,
  aa = false,
}) {
  await page
    .getByRole('button', { name: /^记一笔/ })
    .first()
    .click()
  const d = dialog('记一笔')
  await d.getByRole('button', { name: type, exact: true }).click()
  await d.getByLabel('金额', { exact: true }).fill(String(amount))
  await d.getByLabel('账目名称', { exact: true }).fill(title)
  await d.getByLabel('使用账户', { exact: true }).selectOption(account)
  await d.getByLabel('记账日期', { exact: true }).fill(date)
  if (category) await d.getByRole('button', { name: category, exact: true }).click()
  if (aa) {
    await d.getByLabel('AA 均摊', { exact: true }).check()
    await d.getByLabel('均摊人数（含我）').fill('4')
    await expect(d.getByLabel('我的承担（元）')).toHaveValue((amount / 4).toFixed(2))
    await page.screenshot({ path: 'test-results/finance-aa-editor.png' })
  }
  await d.getByRole('button', { name: '保存账目', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
}
async function open(title) {
  await page.getByRole('button', { name: `查看账目 ${title}`, exact: true }).click()
  return dialog('账目详情')
}
async function receipt(title, amount, account = 'alipay') {
  await (await open(title)).getByRole('button', { name: '记 AA 回款', exact: true }).click()
  const d = dialog('记 AA 回款')
  await d.getByLabel('回款金额（元）').fill(String(amount))
  await d.getByLabel('收款账户').selectOption(account)
  await d.getByLabel('回款备注').fill('同伴回款')
  await d.getByLabel('回款金额（元）').fill('999999')
  await d.getByRole('button', { name: '保存回款', exact: true }).click()
  await expect(d.getByRole('alert')).toContainText('不能超过待收金额')
  await d.getByLabel('回款金额（元）').fill(String(amount))
  await d.getByRole('button', { name: '保存回款', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
}
try {
  await launch()
  assert.deepEqual((await read()).finance.entries, [])
  const original = await read()
  await page.screenshot({ path: 'test-results/finance-empty.png' })
  await page.getByRole('button', { name: '管理账户', exact: true }).click()
  let d = dialog('账户管理')
  await d.getByRole('button', { name: /支付宝/ }).click()
  await d.getByLabel('初始余额（元）').fill('1000.00')
  await d.getByRole('button', { name: '保存账户', exact: true }).click()
  await saved()
  await d.getByLabel('账户名称').fill('招商储蓄卡')
  await d.getByLabel('初始余额（元）').fill('300.00')
  await d.getByRole('button', { name: '添加账户', exact: true }).click()
  await saved()
  assert.ok(
    (await read()).finance.accounts.some(
      (a) => a.name === '招商储蓄卡' && a.openingBalance === 30000,
    ),
  )
  await d.getByRole('button', { name: '完成', exact: true }).click()
  await page.getByRole('button', { name: '分类管理', exact: true }).click()
  d = dialog('分类管理')
  await d.getByLabel('分类名称').fill('宠物')
  await d.getByRole('button', { name: '添加分类', exact: true }).click()
  await saved()
  assert.ok((await read()).finance.categories.some((c) => c.name === '宠物'))
  await d.getByRole('button', { name: '完成', exact: true }).click()
  await create({ title: '午餐', amount: 20 })
  await create({
    title: '十一月工资',
    amount: 10000,
    type: '收入',
    account: 'bank',
    category: '工资',
  })
  await create({ title: '周末四人聚餐', amount: 400, aa: true })
  await expect(page.getByTestId('finance-expense')).toContainText('120.00')
  await expect(page.getByTestId('finance-income')).toContainText('10,000.00')
  await expect(page.getByTestId('finance-pending')).toHaveText('¥300.00')
  await receipt('周末四人聚餐', 100, 'wechat')
  await expect(page.getByTestId('finance-pending')).toHaveText('¥200.00')
  await receipt('周末四人聚餐', 200)
  await expect(page.getByTestId('finance-pending')).toHaveText('¥0.00')
  await expect(page.getByTestId('finance-income')).toContainText('10,000.00')
  let f = (await read()).finance
  assert.equal(f.entries.find((e) => e.title === '周末四人聚餐').split.personalAmount, 10000)
  assert.equal(f.entries.find((e) => e.title === '周末四人聚餐').split.reimbursements.length, 2)
  console.log(
    'PASS: empty ledger, accounts/categories, lunch 20, salary 10000, AA 400/4, split-account repayments without income inflation',
  )

  await page
    .getByRole('button', { name: /^记一笔/ })
    .first()
    .click()
  d = dialog('记一笔')
  await d.getByRole('button', { name: '对账调整', exact: true }).click()
  await d.getByLabel('账目名称').fill('本周余额宝收益与红包')
  await d.getByLabel('当前实际余额').fill('782.35')
  await expect(d).toContainText('+¥2.35')
  await d.getByRole('button', { name: '保存账目', exact: true }).click()
  await saved()
  assert.equal((await read()).finance.entries.find((e) => e.type === 'adjustment').amount, 235)
  await expect(page.getByTestId('finance-income')).toContainText('10,000.00')
  d = await open('午餐')
  await d.getByRole('button', { name: '编辑账目', exact: true }).click()
  d = dialog('编辑账目')
  await d.getByLabel('金额', { exact: true }).fill('22')
  await d.getByRole('button', { name: '保存修改', exact: true }).click()
  await saved()
  await expect(page.getByTestId('finance-expense')).toContainText('122.00')
  d = await open('周末四人聚餐')
  await d.getByRole('button', { name: '删除账目', exact: true }).click()
  await dialog('删除这笔账目？').getByRole('button', { name: '确认删除', exact: true }).click()
  await saved()
  await expect(page.getByTestId('finance-expense')).toContainText('22.00')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await saved()
  assert.equal(
    (await read()).finance.entries.find((e) => e.title === '周末四人聚餐').split.reimbursements
      .length,
    2,
  )
  d = await open('周末四人聚餐')
  await d.getByRole('button', { name: '编辑账目', exact: true }).click()
  d = dialog('编辑账目')
  await d.getByLabel('AA 均摊', { exact: true }).uncheck()
  await d.getByRole('button', { name: '保存修改', exact: true }).click()
  await expect(d.getByRole('alert')).toContainText('已有回款不能超过应收金额')
  await d.getByRole('button', { name: '取消', exact: true }).click()
  await page
    .getByRole('button', { name: /^记一笔/ })
    .first()
    .click()
  d = dialog('记一笔')
  await d.getByRole('button', { name: '对账调整', exact: true }).click()
  await d.getByLabel('使用账户').selectOption('wechat')
  await d.getByLabel('账目名称').fill('微信零钱对账')
  await d.getByLabel('当前实际余额').fill('99.50')
  await expect(d).toContainText('−¥0.50')
  await d.getByRole('button', { name: '保存账目', exact: true }).click()
  await saved()
  assert.equal((await read()).finance.entries.find((e) => e.title === '微信零钱对账').amount, -50)
  console.log(
    'PASS: reconciliation delta, unchanged income, edit expense, delete/undo including linked receipts',
  )

  await create({ title: '地铁出行', amount: 6, account: 'wechat', category: '交通' })
  await create({ title: '读一本喜欢的书', amount: 48, category: '学习成长', date: localDate(-1) })
  await create({ title: '朋友生日晚餐', amount: 320, aa: true, date: localDate(-2) })
  await receipt('朋友生日晚餐', 80, 'wechat')
  await page.locator('.finance-scroll').evaluate((el) => {
    el.scrollTop = 0
  })
  await page.screenshot({ path: 'test-results/finance-timeline.png' })
  await page.getByRole('tab', { name: '日历', exact: true }).click()
  await expect(page.locator('.finance-calendar-grid button')).toHaveCount(42)
  await page.locator(`.finance-calendar-grid button[aria-label^="${today} "]`).click()
  await expect(page.locator('.finance-calendar-entries')).toContainText('本周余额宝收益与红包')
  await page.screenshot({ path: 'test-results/finance-calendar.png' })
  await page.getByRole('tab', { name: '时间轴', exact: true }).click()
  await page.locator('.finance-ledger-caption button').click()
  await page.keyboard.press('Control+k')
  await expect(page.getByLabel('搜索账目')).toBeFocused()
  await page.getByLabel('搜索账目').fill('工资')
  await expect(page.locator('.finance-entry-row')).toHaveCount(1)
  await page.getByLabel('搜索账目').fill('')
  await page.getByLabel('搜索账目').fill('同伴回款')
  await expect(page.locator('.finance-entry-row')).toHaveCount(3)
  await page.getByLabel('搜索账目').fill('')
  await page.getByLabel('按分类筛选').selectOption('food')
  await expect(page.locator('.finance-entry-row')).toHaveCount(6) // 3 expenses + 3 receipts
  await page.getByLabel('按分类筛选').selectOption('all')
  await page.keyboard.press('Control+n')
  await expect(dialog('记一笔')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^AA 均摊/ }).click()
  await page.keyboard.press('Control+n')
  await dialog('记一笔').getByLabel('金额', { exact: true }).fill('400')
  await expect(dialog('记一笔').getByLabel('我的承担（元）')).toHaveValue('100.00')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '全部账目', exact: true }).click()
  console.log(
    'PASS: timeline/calendar, day selection, search, category filter and finance shortcuts',
  )

  // Exercise native backup export/import through real IPC and file I/O.
  const exportPath = path.join(testDir, 'finance-export.json')
  await app.evaluate(({ dialog }, exportPath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportPath })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportPath] })
  }, exportPath)
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('button', { name: '导出', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('备份已导出')
  const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'))
  assert.deepEqual(exported.finance, (await read()).finance)
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await expect(dialog('导入这份备份？')).toContainText(`${exported.finance.entries.length} 笔账目`)
  await dialog('导入这份备份？').getByRole('button', { name: '确认导入', exact: true }).click()
  await saved()
  const beforeRestart = await read()
  const malformed = structuredClone(exported)
  malformed.finance.entries[0].amount = -1
  await fs.writeFile(exportPath, JSON.stringify(malformed))
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('无法导入')
  assert.deepEqual((await read()).finance, beforeRestart.finance)
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click()
  assert.deepEqual(beforeRestart.tasks, original.tasks)
  assert.deepEqual(beforeRestart.habits, original.habits)
  await app.close()
  await launch()
  assert.deepEqual((await read()).finance, beforeRestart.finance)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 780))
  await page.waitForTimeout(200)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.equal(
    await page.locator('.finance-scroll').evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  )
  await page.screenshot({ path: 'test-results/finance-compact.png' })
  await app.close()
  const legacyDir = path.join(testDir, 'legacy')
  await fs.mkdir(legacyDir, { recursive: true })
  const legacy = { ...beforeRestart }
  delete legacy.finance
  await fs.writeFile(path.join(legacyDir, 'data.json'), JSON.stringify(legacy))
  await launch(legacyDir)
  const migrated = await read()
  assert.deepEqual(migrated.finance.entries, [])
  assert.deepEqual(migrated.tasks, legacy.tasks)
  assert.deepEqual(migrated.habits, legacy.habits)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: native backup round-trip, restart persistence, unchanged tasks/habits, legacy migration, compact layout and no renderer errors',
  )
  console.log('ALL FINANCE END-TO-END CHECKS PASSED.')
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/finance-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
