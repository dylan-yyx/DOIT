import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const env = { ...process.env, DOIT_DATA_DIR: path.resolve(`.test-data/inline-${Date.now()}`) }
delete env.ELECTRON_RUN_AS_NODE
const errors = []
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
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor({ timeout: 20000 })
  await expect.poll(async () => !!(await page.evaluate(() => window.desktop.load()))).toBe(true)
}
const read = () => page.evaluate(() => window.desktop.load())
const detail = () => page.getByLabel('事项详情')

try {
  await launch()
  const initial = await read()
  await page.keyboard.press('Control+n')
  let dialog = page.getByRole('dialog', { name: '新建事项', exact: true })
  await dialog.getByLabel('事项名称').fill('详情直接编辑验证')
  await dialog.getByLabel('备注', { exact: true }).fill('记下今天的收获。\n#阅读 #自我提升 #阅读')
  await expect(dialog.getByLabel('从备注识别的标签')).toContainText('# 阅读')
  assert.equal((await read()).tags.length, initial.tags.length)
  await dialog.getByRole('button', { name: '保存事项', exact: true }).click()
  let item
  await expect
    .poll(async () => {
      item = (await read()).tasks.find((task) => task.title === '详情直接编辑验证')
      return item?.notes
    })
    .toBe('记下今天的收获。')
  const id = item.id
  assert.equal((await read()).tags.length, initial.tags.length + 1)
  assert.equal(item.tagIds.length, 2)
  assert.equal(item.tagIds.includes('self'), true)
  console.log('PASS: note hashtags preview without mutation, conversion, reuse and deduplication')

  const notes = detail().getByRole('textbox', { name: '备注', exact: true })
  await notes.click()
  await expect(notes).toBeFocused()
  await notes.fill('直接点空白就可以写。\n第二行也会保留。 #随手记')
  await detail().locator('.detail-title-row h2').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(notes).toHaveValue('直接点空白就可以写。\n第二行也会保留。')
  await expect
    .poll(async () => (await read()).tasks.find((task) => task.id === id).notes)
    .toBe('直接点空白就可以写。\n第二行也会保留。')
  assert.equal((await read()).tasks.find((task) => task.id === id).tagIds.length, 3)
  console.log('PASS: direct notes editing, multiline persistence and inline hashtag conversion')

  await detail()
    .locator('.detail-title-row')
    .getByRole('button', { name: '添加检查事项', exact: true })
    .click()
  const composer = detail().getByRole('textbox', { name: '新增检查事项', exact: true })
  await expect(composer).toBeFocused()
  await composer.fill('第一步：整理观点')
  await composer.dispatchEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 229,
    isComposing: true,
  })
  assert.equal((await read()).tasks.find((task) => task.id === id).checklist.length, 0)
  await composer.press('Enter')
  await expect(composer).toBeFocused()
  await composer.fill('第二步：写下行动')
  await composer.press('Enter')
  await expect
    .poll(async () => (await read()).tasks.find((task) => task.id === id).checklist.length)
    .toBe(2)
  await composer.fill('离开时也会保存的一步')
  await notes.click()
  await expect
    .poll(async () => (await read()).tasks.find((task) => task.id === id).checklist.length)
    .toBe(3)
  await detail().getByRole('button', { name: '删除检查事项 3', exact: true }).click()
  await detail()
    .getByRole('textbox', { name: '检查事项 1', exact: true })
    .fill('第一步：整理核心观点')
  await detail().getByRole('textbox', { name: '检查事项 1', exact: true }).press('Tab')
  await detail().getByRole('button', { name: '第一步：整理核心观点', exact: true }).click()
  await detail().getByRole('button', { name: '第二步：写下行动', exact: true }).click()
  await expect(detail().locator('.completed-badge')).toHaveText('已完成')
  await detail()
    .locator('.detail-title-row')
    .getByRole('button', { name: '添加检查事项', exact: true })
    .click()
  await composer.fill('补充的一步')
  await composer.press('Enter')
  await expect(detail().locator('.completed-badge')).toHaveCount(0)
  await detail().getByRole('button', { name: '删除检查事项 3', exact: true }).click()
  await expect(detail().locator('.completed-badge')).toHaveText('已完成')
  await notes.click()
  await notes.fill('备注与检查事项同时保留。')
  await detail().getByRole('button', { name: '第二步：写下行动', exact: true }).click()
  await expect(detail().locator('.completed-badge')).toHaveCount(0)
  await expect
    .poll(async () => (await read()).tasks.find((task) => task.id === id).notes)
    .toBe('备注与检查事项同时保留。')
  await expect
    .poll(async () => (await read()).tasks.find((task) => task.id === id).completed)
    .toBe(false)
  item = (await read()).tasks.find((task) => task.id === id)
  assert.equal(item.checklist.length, 2)
  assert.equal(item.completed, false)
  assert.equal(item.occurrences.once.checks.length, 1)
  console.log(
    'PASS: title shortcut, continuous addition, IME Enter, inline rename/delete and completion updates',
  )

  await page.keyboard.press('Control+n')
  dialog = page.getByRole('dialog', { name: '新建事项', exact: true })
  await dialog.getByLabel('事项名称').fill('取消后不留下标签')
  await dialog.getByLabel('备注', { exact: true }).fill('#这个标签不应出现')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal(
    (await read()).tags.some((tag) => tag.name === '这个标签不应出现'),
    false,
  )
  await fs.mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/07-inline-edit.png' })
  await app.close()
  await launch()
  await page.locator(`.task-row[data-task-id="${id}"]`).click()
  await expect(detail().getByRole('textbox', { name: '备注', exact: true })).toHaveValue(
    '备注与检查事项同时保留。',
  )
  await expect(detail().getByRole('textbox', { name: '检查事项 1', exact: true })).toHaveValue(
    '第一步：整理核心观点',
  )
  await expect(detail().locator('.detail-check.checked')).toHaveCount(1)
  assert.equal((await read()).tasks.find((task) => task.id === id).tagIds.length, 3)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: cancellation leaves no new tags, restart restores notes/checklist/tags, no renderer errors',
  )
  console.log('ALL INLINE EDIT CHECKS PASSED')
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/inline-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
