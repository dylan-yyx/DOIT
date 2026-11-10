import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/finance-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
const today = new Date().toLocaleDateString('sv-SE')
const errors = []
let app, page
const read = () => page.evaluate(() => window.desktop.load())
const saved = () => expect(page.locator('.save-status')).toHaveText('已保存到本机')
const dialog = (name) => page.getByRole('dialog', { name, exact: true })
const stat = (name) => page.getByTestId(`finance-${name}`).locator('strong')
const chooseCategory = () => page.getByLabel('按分类筛选', { exact: true })

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
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await page.getByRole('button', { name: '记账', exact: true }).click()
  await page.getByRole('heading', { name: '生活账本', exact: true }).waitFor()
  await saved()
}

async function newEntry() {
  await page
    .getByRole('button', { name: /^记一笔/ })
    .first()
    .click()
  return dialog('记一笔')
}
async function create({ title, amount, type = '支出', account = 'alipay', category }) {
  const d = await newEntry()
  await d.getByRole('button', { name: type, exact: true }).click()
  await d.getByLabel('金额', { exact: true }).fill(String(amount))
  await d.getByLabel('账目名称', { exact: true }).fill(title)
  await d.getByLabel('使用账户', { exact: true }).selectOption(account)
  if (category) await d.getByRole('button', { name: category, exact: true }).click()
  await d.getByRole('button', { name: '保存账目', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
}
async function open(title) {
  await page.getByRole('button', { name: `查看账目 ${title}`, exact: true }).click()
  return dialog('账目详情')
}

try {
  await launch()
  const original = await read()
  assert.deepEqual(original.finance.entries, [])
  await expect(stat('liquid')).toHaveText('¥0.00')
  await expect(page.getByText('账户合计', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '账目筛选' }).getByRole('button')).toHaveCount(
    3,
  )
  let d = await newEntry()
  const categories = d.getByRole('group', { name: '常用分类', exact: true })
  await expect(categories.getByRole('button')).toHaveText([
    '饮食',
    '衣着',
    '住房',
    '交通',
    '购物',
    '通信',
    '娱乐',
    '教育',
    '医疗',
    '公益',
    '投资',
    '其他',
  ])
  const rowCounts = await categories.getByRole('button').evaluateAll((buttons) => {
    const counts = {}
    for (const button of buttons) counts[button.offsetTop] = (counts[button.offsetTop] || 0) + 1
    return Object.values(counts)
  })
  assert.deepEqual(rowCounts, [4, 4, 4])
  await expect(d.getByLabel('AA 均摊')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/finance-categories.png' })
  await d.getByRole('button', { name: '收入', exact: true }).click()
  await expect(categories.getByRole('button')).toHaveText([
    '工资',
    '奖金',
    '红包',
    '兼职',
    '二手',
    '对账调整',
  ])
  await d.getByRole('button', { name: '取消', exact: true }).click()

  await page.getByRole('button', { name: '管理账户', exact: true }).click()
  d = dialog('账户管理')
  await d.getByRole('button', { name: /^支付宝/ }).click()
  await d.getByLabel('账户备注').fill('个人号')
  await d.getByLabel('初始余额（元）').fill('1000')
  await d.getByRole('button', { name: '保存账户', exact: true }).click()
  await d.getByLabel('账户名称').fill('支付宝')
  await d.getByLabel('账户备注').fill('工作号')
  await d.getByLabel('初始余额（元）').fill('300')
  await d.getByRole('button', { name: '添加账户', exact: true }).click()
  await d.getByRole('button', { name: '完成', exact: true }).click()
  await saved()
  const second = (await read()).finance.accounts.find(
    (a) => a.name === '支付宝' && a.note === '工作号',
  )
  assert.equal(second.openingBalance, 30000)
  await expect(stat('liquid')).toHaveText('¥1,300.00')
  await expect(
    page.locator('.finance-sidebar .finance-account-label').filter({ hasText: '支付宝' }),
  ).toHaveCount(2)
  d = await newEntry()
  await expect(d.getByLabel('使用账户').locator(`option[value="${second.id}"]`)).toHaveText(
    '支付宝 · 工作号',
  )
  await d.getByRole('button', { name: '取消', exact: true }).click()

  await page.getByRole('button', { name: '分类管理', exact: true }).click()
  d = dialog('分类管理')
  await d.getByLabel('分类名称').fill('宠物')
  await d.getByRole('button', { name: '添加分类', exact: true }).click()
  await d.getByRole('button', { name: '完成', exact: true }).click()
  await create({ title: '午餐', amount: 20, category: '饮食' })
  await create({ title: '本月工资', amount: 10000, type: '收入', category: '工资' })
  await create({ title: '货币基金零星收益', amount: 2.35, type: '收入', category: '对账调整' })
  await create({
    title: '节日红包',
    amount: 50,
    type: '收入',
    account: second.id,
    category: '红包',
  })
  await create({ title: '买入基金', amount: 1000, category: '投资' })
  const assertStats = async () => {
    await expect(stat('expense')).toHaveText('¥20.00')
    await expect(stat('income')).toHaveText('¥10,052.35')
    await expect(stat('net')).toHaveText('¥10,032.35')
    await expect(stat('liquid')).toHaveText('¥10,332.35')
  }
  await assertStats()
  await page.getByRole('button', { name: '上个月的账目', exact: true }).click()
  for (const name of ['expense', 'income', 'net']) await expect(stat(name)).toHaveText('¥0.00')
  await expect(stat('liquid')).toHaveText('¥10,332.35')
  await page.getByRole('button', { name: '本月', exact: true }).click()
  await assertStats()
  await page
    .locator('.finance-sidebar')
    .getByRole('button', { name: /支付宝.*工作号/ })
    .click()
  await expect(stat('income')).toHaveText('¥50.00')
  await expect(stat('liquid')).toHaveText('¥10,332.35')
  await page.getByRole('button', { name: '全部账户', exact: true }).click()
  await expect(page.locator('.finance-breakdown')).toContainText('饮食')
  await expect(page.locator('.finance-breakdown')).not.toContainText('投资')
  await chooseCategory().selectOption('investment')
  await expect(page.getByRole('button', { name: '查看账目 买入基金' })).toBeVisible()
  await expect(stat('expense')).toHaveText('¥0.00')
  await expect(stat('liquid')).toHaveText('¥10,332.35')
  await chooseCategory().selectOption('all')
  console.log(
    'PASS: category grid, account notes, reconciliation income, investment cash outflow, and all-account balances across months and filters',
  )

  await page.getByRole('tab', { name: '日历', exact: true }).click()
  await expect(page.locator('.finance-calendar-grid button')).toHaveCount(42)
  await page.locator(`.finance-calendar-grid button[aria-label^="${today} "]`).click()
  await expect(page.locator('.finance-calendar-entries')).toContainText('货币基金零星收益')
  await page.getByRole('tab', { name: '时间轴', exact: true }).click()
  await page.getByLabel('搜索账目').fill('节日红包')
  await expect(page.locator('.finance-entry-row')).toHaveCount(1)
  await expect(page.locator('.finance-entry-row')).toContainText('支付宝 · 工作号')
  await page.getByRole('button', { name: '清空账目搜索', exact: true }).click()
  await (await open('午餐')).getByRole('button', { name: '删除账目', exact: true }).click()
  await dialog('删除这笔账目？').getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(stat('expense')).toHaveText('¥0.00')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await assertStats()
  await app.close()
  app = null

  await launch()
  await assertStats()
  assert.equal((await read()).finance.accounts.find((a) => a.id === second.id).note, '工作号')
  const backupPath = path.join(testDir, 'ledger-backup.json')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, backupPath)
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('button', { name: '导出', exact: true }).click()
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await fs.readFile(backupPath, 'utf8')).finance.accounts.find(
          (a) => a.id === second.id,
        ).note
      } catch {
        return ''
      }
    })
    .toBe('工作号')
  await app.close()
  app = null
  console.log('PASS: calendar, search, deletion/undo, restart and native backup export')

  const legacyDir = path.join(testDir, 'legacy')
  await fs.mkdir(legacyDir)
  delete original.finance.categoryVersion
  original.finance.accounts[0].openingBalance = 100000
  original.finance.categories.find((c) => c.id === 'home').name = '居住'
  const old = { date: today, accountId: 'alipay', note: '', createdAt: new Date().toISOString() }
  original.finance.entries = [
    { ...old, id: 'legacy-gain', title: '旧收益', type: 'adjustment', amount: 235, categoryId: '' },
    { ...old, id: 'legacy-loss', title: '旧差额', type: 'adjustment', amount: -50, categoryId: '' },
    {
      ...old,
      id: 'legacy-payment',
      title: '旧聚餐',
      type: 'expense',
      amount: 40000,
      categoryId: 'food',
      split: {
        people: 4,
        personalAmount: 10000,
        reimbursements: [
          { id: 'legacy-refund', date: today, accountId: 'wechat', amount: 7500, note: '已到账' },
        ],
      },
    },
  ]
  await fs.writeFile(path.join(legacyDir, 'data.json'), JSON.stringify(original))
  await launch(legacyDir)
  await expect(stat('expense')).toHaveText('¥100.00')
  await expect(stat('income')).toHaveText('¥1.85')
  await expect(stat('net')).toHaveText('¥-98.15')
  await expect(stat('liquid')).toHaveText('¥676.85')
  await expect(
    page.getByRole('button', { name: '查看账目 历史回款 · 旧聚餐', exact: true }),
  ).toBeVisible()
  const migrated = (await read()).finance
  assert.equal(migrated.entries.find((e) => e.id === 'legacy-gain').categoryId, 'reconciliation')
  assert.equal(migrated.entries.find((e) => e.id === 'legacy-loss').amount, -50)
  assert.deepEqual(
    migrated.entries.find((e) => e.id === 'legacy-payment').split,
    original.finance.entries[2].split,
  )
  await (await open('旧聚餐')).getByRole('button', { name: '编辑账目', exact: true }).click()
  d = dialog('编辑账目')
  await expect(d.getByLabel('金额')).toHaveJSProperty('readOnly', true)
  await expect(d.getByLabel('金额')).toHaveValue('100.00')
  await d.getByRole('button', { name: '取消', exact: true }).click()
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1100, 780)
  })
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1100)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/finance-compact.png' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS: positive and negative legacy adjustments, historical cash balances, compact window',
  )
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/finance-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
