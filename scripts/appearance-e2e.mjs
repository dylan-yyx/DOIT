import { _electron as electron, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const testDir = path.resolve(`.test-data/appearance-${Date.now()}`)
await fs.mkdir(testDir, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
let app, page
const errors = []
const settings = () => page.getByRole('dialog', { name: '设置与数据', exact: true })
const saved = async () => {
  await expect(page.locator('.save-status')).toHaveText('已保存到本机')
}
const read = () => page.evaluate(() => window.desktop.load())
const openSettings = async () => {
  await page.getByRole('button', { name: '设置与数据', exact: true }).click()
  await expect(settings()).toHaveCSS('transform', 'none')
}
const closeSettings = () =>
  settings().getByRole('button', { name: '关闭弹窗', exact: true }).click()
const showData = () => settings().getByRole('tab', { name: '数据管理', exact: true }).click()
const showAppearance = () => settings().getByRole('tab', { name: '外观', exact: true }).click()
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
  page.setDefaultTimeout(15000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.getByRole('heading', { name: '我的一天', exact: true }).waitFor()
  await saved()
}
const themeNames = [
  ['鼠尾草', 'sage'],
  ['云朵白', 'cloud'],
  ['燕麦米', 'sand'],
  ['雾霭蓝', 'blue'],
  ['蔷薇粉', 'rose'],
  ['浅藤紫', 'lavender'],
]
try {
  await launch()
  assert.equal((await read()).tasks.length, 0)
  await page.getByLabel('快速添加事项').fill('外观验证事项')
  await page.getByLabel('快速添加事项').press('Enter')
  await saved()
  const original = await read()
  await openSettings()
  await expect(settings().getByRole('tab', { name: '外观', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const navigation = await page.locator('.settings-navigation').boundingBox()
  const content = await page.locator('.settings-main').boundingBox()
  assert.ok(navigation.x + navigation.width <= content.x + 1)
  await settings().getByRole('tab', { name: '外观', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(settings().getByRole('tabpanel', { name: '数据管理', exact: true })).toBeVisible()
  await expect(settings().getByRole('button', { name: '鼠尾草主题', exact: true })).toBeHidden()
  await page.screenshot({
    path: 'test-results/settings-data-management.png',
    animations: 'disabled',
  })
  await page.keyboard.press('Home')
  await expect(settings().getByRole('tabpanel', { name: '外观', exact: true })).toBeVisible()
  await expect(settings().getByRole('button', { name: '鼠尾草主题', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  for (const [name, id] of themeNames) {
    await settings()
      .getByRole('button', { name: `${name}主题`, exact: true })
      .click()
    await saved()
    await expect(page.locator('html')).toHaveAttribute('data-theme', id)
    assert.equal((await read()).preferences.appearance.theme, id)
  }
  const surfaces = new Set()
  for (const [name] of themeNames) {
    await settings()
      .getByRole('button', { name: `${name}主题`, exact: true })
      .click()
    await closeSettings()
    surfaces.add(
      await page.locator('.main-panel').evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    await openSettings()
  }
  assert.equal(surfaces.size, 6)
  await settings().getByRole('button', { name: '宋体字体', exact: true }).click()
  await saved()
  assert.match(
    await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily),
    /SimSun/,
  )
  await settings().getByRole('button', { name: '霞鹜975圆体字体', exact: true }).click()
  await saved()
  assert.equal((await read()).preferences.appearance.font, 'lxgw975')
  await closeSettings()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.task-row-title',
  })
  const { fonts: renderedFonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  assert.ok(
    renderedFonts.some(
      (font) => /LXGW 975 Yuan SC|霞鹜975圆体/.test(font.familyName) && font.glyphCount > 0,
    ),
    JSON.stringify(renderedFonts),
  )
  console.log(
    `PASS: installed font actually rendered: ${renderedFonts.map((font) => font.familyName).join(', ')}`,
  )
  await cdp.detach()
  await openSettings()
  await settings()
    .getByRole('button', { name: '霞鹜975圆体字体', exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/settings-lxgw975-font.png', animations: 'disabled' })
  const closeButton = settings().getByRole('button', { name: '关闭弹窗', exact: true })
  await expect(closeButton).toBeInViewport()
  const navAfterScroll = await page.locator('.settings-navigation').boundingBox()
  assert.equal(navAfterScroll.y, navigation.y)
  await settings()
    .getByRole('tabpanel', { name: '外观', exact: true })
    .evaluate((el) => {
      el.scrollTop = 0
    })
  await settings().getByRole('button', { name: '雾霭蓝主题', exact: true }).click()
  await page.screenshot({ path: 'test-results/appearance-settings.png', animations: 'disabled' })
  await closeSettings()
  for (const [module, selector] of [
    ['待办', '.main-panel'],
    ['打卡', '.habit-main'],
    ['记账', '.finance-main'],
    ['资产', '.asset-main'],
  ]) {
    await page.getByRole('button', { name: module, exact: true }).click()
    assert.equal(
      await page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(241, 246, 251)',
    )
    assert.match(
      await page.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily),
      /LXGW 975 Yuan SC/,
    )
  }
  await openSettings()
  await settings().getByRole('button', { name: '远山主题', exact: true }).click()
  await saved()
  await expect(page.locator('html')).toHaveAttribute('data-background', 'image')
  assert.match(
    await page.locator('.app-shell').evaluate((el) => getComputedStyle(el).backgroundImage),
    /misty-hills/,
  )
  assert.equal(
    await page.locator('.app-shell').evaluate(async (el) => {
      const image = new Image()
      image.src = getComputedStyle(el).backgroundImage.slice(5, -2)
      await image.decode()
      return image.naturalWidth
    }),
    2560,
  )
  assert.match(
    await page.locator('.asset-main').evaluate((el) => getComputedStyle(el).backgroundColor),
    /^rgba/,
  )
  await closeSettings()
  await page.screenshot({
    path: 'test-results/appearance-landscape-assets.png',
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '待办', exact: true }).click()
  await expect(page.getByRole('button', { name: '待办', exact: true })).toHaveClass(/active/)
  await page.screenshot({
    path: 'test-results/appearance-landscape-tasks.png',
    animations: 'disabled',
  })
  await openSettings()
  const input = settings().getByLabel('上传自定义背景图片')
  await input.setInputFiles({
    name: '无效.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  })
  await expect(settings().getByRole('alert')).toContainText('无法识别')
  assert.equal((await read()).preferences.appearance.theme, 'landscape')
  await input.setInputFiles({
    name: '过大.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(21 * 1024 * 1024),
  })
  await expect(settings().getByRole('alert')).toContainText('不能超过 20 MB')
  const image = await app.evaluate(({ nativeImage }) => {
    const pixels = Buffer.alloc(100 * 80 * 4)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 90
      pixels[i + 1] = 140
      pixels[i + 2] = 170
      pixels[i + 3] = 255
    }
    return nativeImage
      .createFromBitmap(pixels, { width: 100, height: 80 })
      .toPNG()
      .toString('base64')
  })
  const uploadPath = path.join(testDir, '上传后将移走.png')
  await fs.writeFile(uploadPath, Buffer.from(image, 'base64'))
  await input.setInputFiles(uploadPath)
  await expect(
    settings().getByRole('button', { name: '自定义图片主题', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await saved()
  let appearance = (await read()).preferences.appearance
  assert.match(appearance.customImage.dataUrl, /^data:image\/jpeg;base64,/)
  assert.equal(appearance.customImage.name, '上传后将移走.png')
  assert.equal(appearance.font, 'lxgw975')
  await fs.rename(uploadPath, path.join(testDir, '原图已移走.png'))
  const backupPath = path.join(testDir, '外观备份.json')
  await app.evaluate(({ dialog }, backupPath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: backupPath })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backupPath] })
  }, backupPath)
  await showData()
  await settings().getByRole('button', { name: '导出', exact: true }).click()
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await fs.readFile(backupPath, 'utf8')).preferences.appearance
      } catch {
        return null
      }
    })
    .toEqual(appearance)
  await showAppearance()
  await settings().getByRole('button', { name: '恢复默认', exact: true }).click()
  await saved()
  assert.equal((await read()).preferences.appearance.theme, 'sage')
  assert.equal((await read()).preferences.appearance.font, 'system')
  assert.equal(
    (await read()).preferences.appearance.customImage.dataUrl,
    appearance.customImage.dataUrl,
  )
  await showData()
  await settings().getByRole('button', { name: '导入', exact: true }).click()
  await page
    .getByRole('dialog', { name: '导入这份备份？', exact: true })
    .getByRole('button', { name: '确认导入', exact: true })
    .click()
  await saved()
  assert.deepEqual((await read()).preferences.appearance, appearance)
  await app.close()
  app = null
  await launch()
  assert.deepEqual((await read()).preferences.appearance, appearance)
  await expect(page.locator('html')).toHaveAttribute('data-background', 'image')
  assert.match(
    await page.locator('.app-shell').evaluate((el) => getComputedStyle(el).backgroundImage),
    /data:image\/jpeg/,
  )
  assert.match(
    await page
      .locator('.task-row-title')
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily),
    /LXGW 975 Yuan SC/,
  )
  await openSettings()
  await settings().getByRole('button', { name: '移除图片', exact: true }).click()
  await saved()
  assert.equal((await read()).preferences.appearance.customImage, undefined)
  await expect(page.locator('html')).toHaveAttribute('data-background', 'solid')
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1080, 700)
  })
  await settings().getByRole('button', { name: '楷体字体', exact: true }).click()
  await saved()
  await page.screenshot({
    path: 'test-results/appearance-compact-settings.png',
    animations: 'disabled',
  })
  assert.equal(await settings().evaluate((el) => el.scrollWidth > el.clientWidth), false)
  await expect(settings().getByRole('button', { name: '关闭弹窗', exact: true })).toBeInViewport()
  await showData()
  await page.screenshot({ path: 'test-results/settings-compact-data.png', animations: 'disabled' })
  assert.equal(
    await settings()
      .getByRole('tabpanel', { name: '数据管理', exact: true })
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  )
  await expect(settings().getByRole('button', { name: '导出', exact: true })).toBeVisible()
  await closeSettings()
  const final = await read()
  for (const key of [
    'tasks',
    'folders',
    'lists',
    'tags',
    'habits',
    'habitGroups',
    'finance',
    'assets',
  ])
    assert.deepEqual(final[key], original[key])
  assert.deepEqual(errors, [])
  console.log(
    'PASS: six solid themes, four module surfaces, fonts, built-in image, upload validation, embedded image independent of original file, backup round-trip, restart, removal, compact layout, unchanged module data, no renderer errors.',
  )
  console.log(`Data: ${testDir}`)
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'test-results/appearance-failure.png' }).catch(() => {})
  throw error
} finally {
  if (app) await app.close().catch(() => {})
}
