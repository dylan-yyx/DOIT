import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/assets-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
const localDate = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
let app, page
const errors = []
const dialog = (name) => page.getByRole('dialog', { name, exact: true })
const saved = () => expect(page.locator('.save-status')).toHaveText('已保存到本机')
const read = () => page.evaluate(() => window.desktop.load())
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
  await page.getByRole('button', { name: '资产', exact: true }).click()
  await page.getByRole('heading', { name: '我的投资', exact: true }).waitFor()
  await saved()
}
async function totals(value, cost, profit) {
  await expect(page.getByTestId('assets-value')).toContainText(value)
  await expect(page.getByTestId('assets-cost')).toContainText(cost)
  await expect(page.getByTestId('assets-profit')).toContainText(profit)
}
async function closeDetail() {
  if (await dialog('投资详情').isVisible())
    await dialog('投资详情').getByRole('button', { name: '关闭详情', exact: true }).click()
}
async function createProduct({ name, platform, cost, value, quantity, price, type = 'fund' }) {
  await page.getByRole('button', { name: '新增投资', exact: true }).click()
  const d = dialog('新增投资')
  await d.getByLabel('产品名称', { exact: true }).fill(name)
  await d.getByLabel('投资类型', { exact: true }).selectOption(type)
  await d.getByLabel('持有平台', { exact: true }).fill(platform)
  if (cost === undefined) await d.getByLabel('录入已有持仓').uncheck()
  else {
    await d.getByLabel('期初日期', { exact: true }).fill(localDate(-8))
    await d.getByLabel('持仓成本（元）', { exact: true }).fill(cost)
    if (type === 'fund') {
      await d.getByLabel('持有份额 / 数量').fill(quantity)
      await d.getByLabel('当前单位价格（元）').fill(price)
    } else await d.getByLabel('当前市值（元）').fill(value)
  }
  await d.getByRole('button', { name: '保存投资', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
  return (await read()).assets.products.find((p) => p.name === name).id
}
async function transaction(
  assetId,
  type,
  { quantity, price, amount, fee = '0', basis, value, full = false, day = -1, note = '' },
) {
  await closeDetail()
  await page.getByRole('button', { name: '记一笔投资', exact: true }).click()
  const d = dialog('记一笔投资')
  await d.getByLabel('投资产品', { exact: true }).selectOption(assetId)
  await d.getByRole('button', { name: type, exact: true }).click()
  await d.getByLabel('记录日期', { exact: true }).fill(localDate(day))
  if (full) await d.getByLabel('全部卖出', { exact: true }).check()
  if (quantity) await d.getByLabel('交易份额', { exact: true }).fill(quantity)
  if (price !== undefined) await d.getByLabel('单位价格（元）', { exact: true }).fill(price)
  if (amount !== undefined) await d.getByLabel('交易金额（元）', { exact: true }).fill(amount)
  if (basis !== undefined) await d.getByLabel('本次赎回对应成本（元）').fill(basis)
  if (value !== undefined) await d.getByLabel('当前市值（元）').fill(value)
  if (await d.getByLabel('手续费（元）', { exact: true }).isVisible())
    await d.getByLabel('手续费（元）', { exact: true }).fill(fee)
  await d.getByLabel('记录备注', { exact: true }).fill(note)
  await d.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
}
try {
  await launch()
  const original = await read()
  assert.deepEqual(original.assets, { products: [], records: [] })
  await page.screenshot({ path: 'test-results/assets-empty.png' })
  const fund = await createProduct({
    name: '测试指数基金',
    platform: '证券测试',
    cost: '1000',
    quantity: '100',
    price: '11',
  })
  await totals('1,100.00', '1,000.00', '+100.00')
  await createProduct({ name: '测试未建仓产品', platform: '证券测试', type: 'stock' })
  await expect(page.locator('.asset-filter-counts')).toContainText('持有 1 项')
  await expect(page.getByRole('button', { name: /^全部投资/ }).locator('small')).toHaveText('1')
  await expect(page.locator('.asset-product-link')).toHaveCount(1)
  await page.getByRole('button', { name: '未建仓 1 项', exact: true }).click()
  await expect(page.getByLabel('持仓状态', { exact: true })).toHaveValue('pending')
  await expect(page.locator('.asset-product-link')).toHaveText(
    '测试未建仓产品证券测试 · 股票 / ETF',
  )
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  const archive = page.getByText('投资档案', { exact: true }).locator('..')
  await expect(archive.locator('strong')).toHaveText('2')
  await expect(archive.locator('small')).toHaveText('持有 1 · 未建仓 1')
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click()
  await page.getByRole('button', { name: '投资总览', exact: true }).click()
  await totals('1,100.00', '1,000.00', '+100.00')
  console.log('PASS: active count, uninvested product view and settings archive breakdown')
  const wealth = await createProduct({
    name: '测试银行理财',
    platform: '银行测试',
    type: 'wealth',
    cost: '10000',
    value: '10500',
  })
  await totals('11,600.00', '11,000.00', '+600.00')
  await transaction(fund, '买入', { quantity: '50', price: '12', fee: '5', day: -7 })
  await transaction(fund, '卖出', { quantity: '60', price: '13', fee: '3', day: -6 })
  await totals('11,670.00', '10,963.00', '+842.00')
  await transaction(fund, '现金分红', { amount: '30', fee: '2', day: -5, note: '现金到账' })
  await transaction(fund, '分红再投', { quantity: '10', price: '10', fee: '1', day: -4 })
  await transaction(fund, '其他费用', { amount: '4', day: -3 })
  await totals('11,500.00', '11,064.00', '+696.00')
  await page.getByRole('button', { name: '批量更新估值', exact: true }).click()
  let d = dialog('批量更新估值')
  await d.getByLabel('估值日期', { exact: true }).fill(localDate(-2))
  await d.getByLabel('测试指数基金的单位价格').fill('11')
  await d.getByLabel('测试银行理财的市值').fill('10600')
  await d.getByRole('button', { name: '保存 2 项估值', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
  await totals('11,700.00', '11,064.00', '+896.00')
  await page.screenshot({ path: 'test-results/assets-overview.png' })
  console.log(
    'PASS: unit and amount holdings, partial sale cost, cash/reinvested dividends, fees and batch valuations',
  )

  await page.getByRole('button', { name: '投资记录', exact: true }).click()
  const opening = (await read()).assets.records.find(
    (r) => r.assetId === fund && r.type === 'opening',
  )
  const unchanged = (await read()).assets
  await page.getByRole('button', { name: `编辑投资记录 ${opening.id}`, exact: true }).click()
  d = dialog('编辑投资记录')
  await d.getByLabel('交易份额', { exact: true }).fill('1')
  await d.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(d.getByRole('alert')).toContainText('卖出份额不能超过')
  assert.deepEqual((await read()).assets, unchanged)
  await page.screenshot({ path: 'test-results/assets-history-validation.png' })
  await d.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('button', { name: `删除投资记录 ${opening.id}`, exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('无法删除')
  assert.deepEqual((await read()).assets, unchanged)
  const valuation = unchanged.records.find((r) => r.assetId === wealth && r.type === 'valuation')
  await page.getByRole('button', { name: `删除投资记录 ${valuation.id}`, exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await saved()
  await totals('11,600.00', '11,064.00', '+796.00')
  await page.locator('.toast').getByRole('button', { name: '撤销', exact: true }).click()
  await saved()
  await totals('11,700.00', '11,064.00', '+896.00')
  assert.deepEqual((await read()).assets, unchanged)
  await page.getByRole('button', { name: `编辑投资记录 ${opening.id}`, exact: true }).click()
  d = dialog('编辑投资记录')
  await d.getByLabel('记录备注', { exact: true }).fill('核对期初持仓')
  await d.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
  console.log(
    'PASS: edit history, reject oversold timelines, block invalid deletion, delete and undo valuation',
  )

  await page.getByRole('button', { name: '投资总览', exact: true }).click()
  await transaction(wealth, '卖出', { amount: '3300', fee: '20', basis: '3000', value: '7500' })
  await totals('8,600.00', '8,064.00', '+1,076.00')
  await transaction(wealth, '卖出', { amount: '7400', fee: '10', full: true })
  await totals('1,100.00', '1,064.00', '+966.00')
  await page.getByRole('button', { name: '投资记录', exact: true }).click()
  const fullRedemption = (await read()).assets.records
    .filter((r) => r.assetId === wealth && r.type === 'sell')
    .at(-1)
  await page.getByRole('button', { name: `编辑投资记录 ${fullRedemption.id}`, exact: true }).click()
  d = dialog('编辑投资记录')
  await expect(d.getByLabel('当前市值（元）', { exact: true })).toHaveValue('0.00')
  await d.getByLabel('记录备注', { exact: true }).fill('全额赎回确认')
  await d.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
  await transaction(fund, '卖出', { price: '12', fee: '3', full: true })
  await totals('0.00', '0.00', '+1,063.00')
  await page.getByRole('button', { name: '全部持仓', exact: true }).click()
  await page.getByLabel('持仓状态', { exact: true }).selectOption('closed')
  await expect(page.locator('.asset-product-link')).toHaveCount(2)
  await page.getByRole('button', { name: '查看投资 测试指数基金 证券测试', exact: true }).click()
  await expect(dialog('投资详情')).toContainText('+393.00')
  await page.screenshot({ path: 'test-results/assets-closed-detail.png' })
  await closeDetail()
  await transaction(fund, '现金分红', { amount: '10', day: 0 })
  await transaction(fund, '买入', { quantity: '10', price: '10', fee: '1', day: 0 })
  await totals('100.00', '101.00', '+1,072.00')
  await page.getByLabel('持仓状态', { exact: true }).selectOption('active')
  await expect(page.locator('.asset-product-link')).toHaveCount(1)
  await page.getByRole('button', { name: '查看投资 测试指数基金 证券测试', exact: true }).click()
  await dialog('投资详情').getByRole('button', { name: '编辑产品', exact: true }).click()
  d = dialog('编辑投资产品')
  await expect(d.getByLabel('记录方式', { exact: true })).toBeDisabled()
  await d.getByLabel('产品名称', { exact: true }).fill('测试指数基金（已核对）')
  await d.getByRole('button', { name: '保存投资', exact: true }).click()
  await expect(dialog('投资详情')).toContainText('证券测试')
  await dialog('投资详情').getByRole('button', { name: '删除投资产品', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await saved()
  await totals('0.00', '0.00', '+670.00')
  await page.locator('.toast').getByRole('button', { name: '撤销', exact: true }).click()
  await saved()
  await totals('100.00', '101.00', '+1,072.00')
  await page.getByLabel('筛选持有平台', { exact: true }).selectOption('银行测试')
  await totals('0.00', '0.00', '+670.00')
  await page.getByLabel('筛选持有平台', { exact: true }).selectOption('all')
  await page.keyboard.press('Control+k')
  await expect(page.getByLabel('搜索投资', { exact: true })).toBeFocused()
  await page.getByLabel('搜索投资', { exact: true }).fill('已核对')
  await totals('100.00', '101.00', '+402.00')
  await page.getByRole('button', { name: '清空投资搜索', exact: true }).click()
  await page.keyboard.press('Control+n')
  await expect(dialog('新增投资')).toBeVisible()
  await page.keyboard.press('Escape')
  console.log(
    'PASS: amount partial/full redemption, zero holdings, retained gains, late dividend, reopening, product editing/deletion undo, filters and shortcuts',
  )

  await transaction(fund, '更新估值', { price: '0', day: 0 })
  await totals('0.00', '101.00', '+972.00')
  await page.getByRole('button', { name: '投资记录', exact: true }).click()
  const zeroQuote = (await read()).assets.records
    .filter((r) => r.assetId === fund && r.type === 'valuation')
    .at(-1)
  await page.getByRole('button', { name: `编辑投资记录 ${zeroQuote.id}`, exact: true }).click()
  d = dialog('编辑投资记录')
  await expect(d.getByLabel('单位价格（元）', { exact: true })).toHaveValue('0')
  await d.getByRole('button', { name: '保存记录', exact: true }).click()
  await expect(d).toBeHidden()
  await saved()
  await transaction(fund, '更新估值', { price: '10', day: 0 })
  await totals('100.00', '101.00', '+1,072.00')
  console.log('PASS: zero valuation and zero remaining value retain their values when editing')
  const exportPath = path.join(testDir, 'assets-export.json')
  await app.evaluate(({ dialog }, exportPath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportPath })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportPath] })
  }, exportPath)
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('button', { name: '导出', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('备份已导出')
  const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'))
  assert.deepEqual(exported.assets, (await read()).assets)
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await expect(dialog('导入这份备份？')).toContainText('3 项投资')
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await saved()
  const beforeRestart = await read()
  const malformed = structuredClone(exported)
  malformed.assets.records[0].amount = -1
  await fs.writeFile(exportPath, JSON.stringify(malformed))
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('无法导入')
  assert.deepEqual((await read()).assets, beforeRestart.assets)
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click()
  assert.deepEqual(beforeRestart.tasks, original.tasks)
  assert.deepEqual(beforeRestart.habits, original.habits)
  assert.deepEqual(beforeRestart.finance, original.finance)
  await app.close()
  await launch()
  assert.deepEqual((await read()).assets, beforeRestart.assets)
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1100, 780)
  })
  await page.waitForTimeout(200)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.equal(
    await page.locator('.asset-scroll').evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  )
  await page.screenshot({ path: 'test-results/assets-compact.png' })
  await app.close()
  const legacyDir = path.join(testDir, 'legacy')
  const legacy = structuredClone(beforeRestart)
  delete legacy.assets
  await fs.mkdir(legacyDir, { recursive: true })
  await fs.writeFile(path.join(legacyDir, 'data.json'), JSON.stringify(legacy))
  await launch(legacyDir)
  const migrated = await read()
  assert.deepEqual(migrated.assets, { products: [], records: [] })
  assert.deepEqual(migrated.tasks, legacy.tasks)
  assert.deepEqual(migrated.finance, legacy.finance)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: native backup round-trip and rejection, restart, unchanged other modules, legacy migration, compact layout, no renderer errors',
  )
  console.log('ALL ASSETS END-TO-END CHECKS PASSED.')
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/assets-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
