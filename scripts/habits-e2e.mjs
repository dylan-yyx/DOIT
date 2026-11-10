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
  app = await electron.launch({
    ...(process.env.DOIT_EXECUTABLE
      ? { executablePath: path.resolve(process.env.DOIT_EXECUTABLE), args: [] }
      : { args: ['.'] }),
    env,
    timeout: 60000,
  })
  page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await page.getByRole('button', { name: '打卡', exact: true }).click()
  await page.getByRole('heading', { name: '日常打卡', exact: true }).waitFor()
  await saved()
}
try {
  await launch()
  assert.equal((await read()).habits.length, 0)
  await page.screenshot({ path: 'test-results/habits-preview.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: '新建习惯', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '养成一个新习惯', exact: true })
  const groupField = () => dialog.getByLabel('分组', { exact: true })
  await dialog.getByRole('button', { name: '阅读', exact: true }).click()
  await expect(dialog.getByLabel('习惯名称')).toHaveValue('阅读')
  await expect(groupField()).toHaveValue('')
  await expect(dialog.getByLabel('每个计划日的基本目标')).toHaveValue('30')
  await page.screenshot({ path: 'test-results/habits-editor.png' })
  await dialog.getByLabel('习惯名称').fill('深度阅读验证')
  await dialog.getByLabel('开始日期').fill(yesterday)
  await groupField().selectOption('__new')
  await dialog.getByLabel('新分组名称').fill('学习成长')
  await dialog.getByRole('button', { name: '创建习惯', exact: true }).click()
  await saved()
  let h = (await read()).habits.find((h) => h.name === '深度阅读验证')
  const groupId = h.groupId
  assert.ok((await read()).habitGroups.some((g) => g.id === groupId && g.name === '学习成长'))
  const groupNav = page.locator('.habit-group-nav')
  const groupButton = groupNav.getByRole('button', { name: /^学习成长/ })
  await groupButton.click()
  await page.getByRole('button', { name: '新建习惯', exact: true }).click()
  await expect(groupField()).toHaveValue('')
  await dialog.getByRole('button', { name: '阅读', exact: true }).click()
  await expect(groupField()).toHaveValue('')
  await groupField().selectOption(groupId)
  await dialog.getByRole('button', { name: '运动', exact: true }).click()
  await expect(groupField()).toHaveValue(groupId)
  await dialog.getByRole('button', { name: '关闭弹窗' }).click()
  await page.locator('.habit-discover').getByRole('button', { name: '阅读', exact: true }).click()
  await expect(dialog.getByLabel('习惯名称')).toHaveValue('阅读')
  await expect(groupField()).toHaveValue('')
  await dialog.getByRole('button', { name: '关闭弹窗' }).click()
  const readingCard = page.getByRole('article', { name: '习惯 深度阅读验证' })
  const week = readingCard.getByRole('group', { name: '本周打卡' })
  await expect(week.getByRole('button')).toHaveCount(7)
  await week.getByRole('button', { name: `深度阅读验证 ${today} 填写完成量` }).click()
  const quantity = page.getByRole('dialog', { name: '填写习惯完成量' })
  await quantity.getByLabel('当天累计完成量（分钟）').fill('12')
  await quantity.getByRole('button', { name: '保存记录' }).click()
  await saved()
  assert.equal(
    (await read()).habits.find((h) => h.name === '深度阅读验证').records[today].value,
    12,
  )
  await expect(readingCard.getByTitle('打卡 1 次', { exact: true })).toBeVisible()
  await week.getByRole('button', { name: `深度阅读验证 ${today} 填写完成量` }).click()
  await expect(quantity.getByLabel('当天累计完成量（分钟）')).toHaveValue('12')
  await quantity.getByRole('button', { name: '取消', exact: true }).click()
  const previousWeek = new Date().getDay() === 1
  if (previousWeek) await page.getByRole('button', { name: '上一周的习惯', exact: true }).click()
  await week.getByRole('button', { name: `深度阅读验证 ${yesterday} 填写完成量` }).click()
  await quantity.getByLabel('当天累计完成量（分钟）').fill('8')
  await quantity.getByRole('button', { name: '保存记录' }).click()
  await saved()
  h = (await read()).habits.find((item) => item.name === '深度阅读验证')
  assert.equal(h.records[yesterday].value, 8)
  assert.equal(h.records[today].value, 12)
  if (previousWeek) await page.getByRole('button', { name: '今天', exact: true }).click()
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
  await expect(week.getByRole('button', { name: /未来日期/ })).toHaveCount(7)
  await expect(week.getByRole('button', { name: /未来日期/ }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '今天', exact: true }).click()
  console.log(
    'PASS: preset, custom group, daily totals, 30/60/90 intensity, historical entry, future lock',
  )

  const deleteGroup = groupNav.getByRole('button', { name: '删除分组 学习成长', exact: true })
  const confirmGroup = page.getByRole('dialog', { name: '删除分组“学习成长”？', exact: true })
  await deleteGroup.click()
  await confirmGroup.getByRole('button', { name: '取消', exact: true }).click()
  await expect(groupButton).toHaveClass(/active/)
  assert.equal((await read()).habits.find((habit) => habit.id === h.id).groupId, groupId)
  const recordsBefore = (await read()).habits.find((habit) => habit.id === h.id).records
  await deleteGroup.click()
  await confirmGroup.getByRole('button', { name: '删除分组', exact: true }).click()
  await saved()
  await expect(groupButton).toHaveCount(0)
  await expect(groupNav.getByRole('button', { name: /^未分组/ })).toHaveClass(/active/)
  await expect(readingCard).toBeVisible()
  const afterGroupDeletion = await read()
  assert.equal(
    afterGroupDeletion.habitGroups.some((group) => group.id === groupId),
    false,
  )
  const movedHabit = afterGroupDeletion.habits.find((habit) => habit.id === h.id)
  assert.equal(movedHabit.groupId, '')
  assert.deepEqual(movedHabit.records, recordsBefore)
  console.log(
    'PASS: ungrouped defaults, explicit group selection, and group deletion with records preserved',
  )

  await page.keyboard.press('Control+n')
  dialog = page.getByRole('dialog', { name: '养成一个新习惯', exact: true })
  await dialog.getByLabel('习惯名称').fill('拉伸打卡验证')
  await dialog.getByRole('button', { name: '更多图标' }).click()
  await dialog.getByRole('button', { name: '图标 拉伸', exact: true }).click()
  await dialog.getByRole('button', { name: '更多色系' }).click()
  await dialog
    .getByRole('group', { name: '莫兰迪色系' })
    .getByRole('button', { name: '习惯颜色 #899c85' })
    .click()
  await dialog.getByLabel('频率', { exact: true }).selectOption('custom')
  // Explicitly choose all seven days so this check also runs on weekends.
  for (const name of ['六', '日']) await dialog.getByRole('button', { name, exact: true }).click()
  await dialog.getByRole('button', { name: '创建习惯', exact: true }).click()
  const stretchCard = page.getByRole('article', { name: '习惯 拉伸打卡验证' })
  await expect(stretchCard.locator('.lucide-stretch-horizontal')).toBeVisible()
  await saved()
  const stretch = (await read()).habits.find((h) => h.name === '拉伸打卡验证')
  assert.equal(stretch.icon, 'StretchHorizontal')
  assert.equal(stretch.color, '#899c85')
  await page.getByRole('button', { name: `拉伸打卡验证 ${today} 打卡`, exact: true }).click()
  await saved()
  assert.equal((await read()).habits.find((h) => h.name === '拉伸打卡验证').records[today].value, 1)
  await page.getByRole('button', { name: `拉伸打卡验证 ${today} 撤销打卡`, exact: true }).click()
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
  await expect(page.locator('.habit-overview-row')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/habits-overview.png' })
  console.log(
    'PASS: custom frequency, boolean completion/undo, edit, deletion/restore, search, overview',
  )

  const tasksBefore = (await read()).tasks
  await app.close()
  await launch()
  h = (await read()).habits.find((h) => h.name === '深度阅读验证')
  assert.equal(h.groupId, '')
  assert.deepEqual((await read()).habitGroups, [])
  assert.equal(h.records[today].value, 90)
  assert.equal(h.records[yesterday].value, 45)
  await expect(
    page
      .getByRole('article', { name: '习惯 拉伸习惯已编辑' })
      .locator('.lucide-stretch-horizontal'),
  ).toBeVisible()
  assert.deepEqual((await read()).tasks, tasksBefore)
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1100, 700)
  })
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1100)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  const cards = await page.locator('.habit-card').evaluateAll((elements) =>
    elements.map((card) => {
      const box = card.getBoundingClientRect()
      const cell = card.querySelector('.habit-card-week > button').getBoundingClientRect()
      return { top: box.top, height: box.height, cellWidth: cell.width, cellHeight: cell.height }
    }),
  )
  assert.equal(cards.length, 2)
  assert.equal(cards[0].top, cards[1].top)
  assert.ok(
    cards.every((c) => c.height <= 64 && Math.abs(c.cellWidth - c.cellHeight) < 1),
    JSON.stringify(cards),
  )
  const deleteHabit = page.getByRole('button', { name: '删除习惯 深度阅读验证', exact: true })
  const footerLayout = await deleteHabit.evaluate((button) => {
    const content = button.closest('.habit-detail').querySelector('.habit-detail-scroll')
    const { top, bottom } = button.getBoundingClientRect()
    return {
      scrollTop: content.scrollTop,
      overflows: content.scrollHeight > content.clientHeight,
      fullyVisible: top >= content.getBoundingClientRect().bottom && bottom <= innerHeight,
    }
  })
  assert.deepEqual(footerLayout, { scrollTop: 0, overflows: true, fullyVisible: true })
  await deleteHabit.click({ trial: true })
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
