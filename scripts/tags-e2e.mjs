import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { legacyFixture } from './test-fixtures.mjs'

const testDir = path.resolve(`.test-data/tags-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
let app, page
const errors = []
const settings = () => page.getByRole('dialog', { name: '设置与数据', exact: true })
const panel = () => settings().getByRole('tabpanel', { name: '待办设置', exact: true })
const read = () => page.evaluate(() => window.desktop.load())
const saved = () => expect(page.locator('.save-status')).toHaveText('已保存到本机')
async function launch(directory = testDir) {
  const env = { ...process.env, DOIT_DATA_DIR: directory }
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
  await saved()
}
async function manage() {
  await page.getByRole('button', { name: '管理标签', exact: true }).click()
  await expect(panel()).toBeVisible()
  await expect(settings()).toHaveCSS('transform', 'none')
}
const close = () => settings().getByRole('button', { name: '关闭弹窗', exact: true }).click()
async function createGroup(name) {
  await panel().getByRole('button', { name: '新建分组', exact: true }).click()
  await panel().getByRole('textbox', { name: '分组名称', exact: true }).fill(name)
  await panel().getByRole('button', { name: '保存分组', exact: true }).click()
  await saved()
  return (await read()).tagGroups.find((g) => g.name === name).id
}
async function createTag(name, group, pinned = false) {
  await panel().getByRole('button', { name: '新建标签', exact: true }).first().click()
  const form = panel().getByRole('form', { name: '标签编辑' })
  await form.getByLabel('标签名称', { exact: true }).fill(name)
  await form.getByLabel('所属分组', { exact: true }).selectOption(group)
  await form.getByLabel('固定到左侧栏', { exact: true }).setChecked(pinned)
  await form.getByRole('button', { name: '保存标签', exact: true }).click()
  await saved()
}
try {
  await launch()
  const fresh = await read()
  for (const key of ['tasks', 'tags', 'tagGroups', 'folders', 'habits', 'habitGroups'])
    assert.deepEqual(fresh[key], [])
  assert.deepEqual(
    fresh.lists.map((l) => l.id),
    ['inbox'],
  )
  await page.screenshot({ path: 'test-results/empty-tasks.png', animations: 'disabled' })
  await page.getByRole('button', { name: '打卡', exact: true }).click()
  await expect(page.locator('.habit-card')).toHaveCount(0)
  await page.getByRole('button', { name: '新建习惯', exact: true }).click()
  const habit = page.getByRole('dialog', { name: '养成一个新习惯', exact: true })
  for (const name of ['阅读', '运动', '喝水', '戒糖', '冥想', '早睡', '写作', '学外语'])
    await expect(habit.getByRole('button', { name, exact: true })).toBeVisible()
  await habit.getByRole('button', { name: '阅读', exact: true }).click()
  await habit.getByLabel('习惯名称', { exact: true }).fill('我的阅读习惯')
  await habit.getByRole('button', { name: '创建习惯', exact: true }).click()
  await saved()
  assert.equal((await read()).habits.length, 1)
  await page.getByRole('button', { name: '待办', exact: true }).click()
  await manage()
  await panel().getByRole('button', { name: '管理分组', exact: true }).click()
  const books = await createGroup('书籍'),
    films = await createGroup('影视')
  for (const name of ['文学', '科幻', '科普', '纪实', '传记'])
    await createTag(name, books, name === '文学')
  for (const name of ['剧情', '喜剧', '动画']) await createTag(name, films)
  await panel().getByRole('button', { name: '新建标签', exact: true }).first().click()
  await panel().getByLabel('标签名称', { exact: true }).fill('文学')
  await panel().getByRole('button', { name: '保存标签', exact: true }).click()
  await expect(panel().getByRole('alert')).toContainText('同名')
  await panel().getByRole('button', { name: '取消编辑标签', exact: true }).click()
  assert.equal((await read()).tags.length, 8)
  await panel().getByLabel('搜索标签', { exact: true }).fill('科')
  await expect(panel().locator('.tag-table tbody tr')).toHaveCount(2)
  await panel().getByLabel('搜索标签', { exact: true }).fill('')
  await panel().getByLabel('按标签分组筛选', { exact: true }).selectOption(films)
  await expect(panel().locator('.tag-table tbody tr')).toHaveCount(3)
  await panel().getByLabel('按标签分组筛选', { exact: true }).selectOption('__all')
  await panel().getByRole('button', { name: '固定标签 科幻', exact: true }).click()
  await saved()
  await close()
  await expect(page.locator('.sidebar-tags .side-row-wrap')).toHaveCount(2)
  await expect(
    page.locator('.sidebar-tags').getByRole('button', { name: '科普', exact: true }),
  ).toHaveCount(0)
  await page.keyboard.press('Control+n')
  const taskForm = page.getByRole('dialog', { name: '新建事项', exact: true })
  await taskForm.getByLabel('事项名称').fill('阅读与观影记录')
  await taskForm.getByLabel('可选标签分组').selectOption(books)
  await taskForm.getByLabel('搜索可选标签').fill('科幻')
  await taskForm.getByRole('button', { name: '科幻', exact: true }).click()
  await taskForm.getByLabel('搜索可选标签').fill('')
  await taskForm.getByRole('button', { name: '文学', exact: true }).click()
  await taskForm.getByLabel('可选标签分组').selectOption(films)
  await taskForm.getByRole('button', { name: '动画', exact: true }).click()
  await taskForm.getByRole('button', { name: '保存事项', exact: true }).click()
  await saved()
  let data = await read()
  const taskId = data.tasks[0].id,
    literatureId = data.tags.find((t) => t.name === '文学').id,
    scifiId = data.tags.find((t) => t.name === '科幻').id
  assert.equal(data.tasks[0].tagIds.length, 3)
  await manage()
  await panel().getByRole('button', { name: '编辑标签 文学', exact: true }).click()
  await panel().getByLabel('标签名称', { exact: true }).fill('文学经典')
  await panel().getByRole('button', { name: '标签颜色 #937caf', exact: true }).click()
  await panel().getByRole('button', { name: '保存标签', exact: true }).click()
  await saved()
  assert.equal((await read()).tags.find((t) => t.id === literatureId).name, '文学经典')
  assert.ok((await read()).tasks[0].tagIds.includes(literatureId))
  await panel().getByLabel('选择标签 科幻', { exact: true }).check()
  await panel().getByLabel('选择标签 科普', { exact: true }).check()
  await panel().getByLabel('批量移至分组').selectOption(films)
  await saved()
  assert.equal((await read()).tags.find((t) => t.name === '科幻').groupId, films)
  await panel().getByLabel('批量移至分组').selectOption(books)
  await panel().getByRole('button', { name: '取消选择', exact: true }).click()
  await saved()
  await panel().getByRole('button', { name: '管理分组', exact: true }).click()
  await panel().getByRole('button', { name: '删除分组 影视', exact: true }).click()
  await panel().getByRole('button', { name: '确认删除', exact: true }).click()
  await saved()
  data = await read()
  assert.equal(data.tags.length, 8)
  assert.equal(data.tags.find((t) => t.name === '动画').groupId, undefined)
  assert.equal(data.tasks[0].tagIds.length, 3)
  await panel().getByRole('button', { name: '动画', exact: true }).click()
  await expect(settings()).toBeHidden()
  await expect(page.locator('.sidebar-tags .side-row-wrap.active')).toContainText('动画')
  await page.getByRole('button', { name: /^全部事项/ }).click()
  await expect(page.locator('.sidebar-tags .side-row-wrap')).toHaveCount(2)
  await manage()
  await panel().getByRole('button', { name: '删除标签 科幻', exact: true }).click()
  await panel().getByRole('button', { name: '确认删除', exact: true }).click()
  await saved()
  data = await read()
  assert.equal(data.tasks.length, 1)
  assert.equal(data.tasks[0].id, taskId)
  assert.ok(!data.tasks[0].tagIds.includes(scifiId))
  assert.equal(data.tasks[0].tagIds.length, 2)
  const backupPath = path.join(testDir, 'tags-backup.json')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, backupPath)
  await settings().getByRole('tab', { name: '数据管理', exact: true }).click()
  await settings().getByRole('button', { name: '导出', exact: true }).click()
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await fs.readFile(backupPath, 'utf8')).tagGroups
      } catch {
        return null
      }
    })
    .toEqual(data.tagGroups)
  await settings().getByRole('tab', { name: '待办设置', exact: true }).click()
  await panel().getByRole('button', { name: '取消固定标签 文学经典', exact: true }).click()
  await saved()
  await settings().getByRole('tab', { name: '数据管理', exact: true }).click()
  await settings().getByRole('button', { name: '导入', exact: true }).click()
  await page
    .getByRole('dialog', { name: '导入这份备份？', exact: true })
    .getByRole('button', { name: '确认导入', exact: true })
    .click()
  await saved()
  assert.equal((await read()).tags.find((t) => t.id === literatureId).pinned, true)
  await app.close()
  app = null
  await launch()
  assert.equal((await read()).tasks.length, 1)
  assert.equal((await read()).habits.length, 1)
  await manage()
  await page.screenshot({ path: 'test-results/tag-management.png', animations: 'disabled' })
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1080, 700)
  })
  await expect(settings().getByRole('button', { name: '关闭弹窗', exact: true })).toBeInViewport()
  assert.equal(await panel().evaluate((el) => el.scrollWidth > el.clientWidth), false)
  await page.screenshot({ path: 'test-results/tag-management-compact.png', animations: 'disabled' })
  await app.close()
  app = null
  const legacyDir = path.join(testDir, 'legacy')
  await fs.mkdir(legacyDir)
  const old = await legacyFixture()
  delete old.preferences.exampleCleanupDone
  old.tasks[0].notes = '这段真实笔记需要保留'
  await fs.writeFile(path.join(legacyDir, 'data.json'), JSON.stringify(old))
  await launch(legacyDir)
  const migrated = await read()
  assert.equal(migrated.tasks.length, 1)
  assert.equal(migrated.tasks[0].notes, '这段真实笔记需要保留')
  assert.deepEqual(migrated.habits, [])
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(legacyDir, 'data.before-v0.4.0.json'), 'utf8')),
    old,
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: clean initial tasks/habits, all habit presets, groups, search, pinning, bulk moves, tag picker, rename, safe group/tag deletion, backup/import, restart, compact layout, legacy cleanup with original backup and preserved real edits.',
  )
  console.log(`Data: ${testDir}`)
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/tags-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
