import { packager } from '@electron/packager'
import fs from 'node:fs/promises'
import path from 'node:path'
const root = process.cwd(),
  runId = Date.now().toString(),
  stage = path.join(root, `.packaging/stage-${runId}`),
  packageOutput = path.join(root, `.packaging/output-${runId}`),
  packageTemp = path.join(root, '.packaging/tmp')
await fs.mkdir(packageTemp, { recursive: true })
await fs.mkdir(stage, { recursive: true })
for (const dir of ['dist', 'electron', 'public'])
  await fs.cp(path.join(root, dir), path.join(stage, dir), {
    recursive: true,
    filter: (source) => !source.endsWith('.test.ts'),
  })
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'))
const electronPkg = JSON.parse(await fs.readFile('node_modules/electron/package.json', 'utf8'))
await fs.writeFile(
  path.join(stage, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      productName: 'DOIT 拾序',
      main: 'electron/main.cjs',
      description: pkg.description,
      author: 'DOIT',
      license: 'UNLICENSED',
    },
    null,
    2,
  ),
)
// Reuse the runtime downloaded for development; packaging works without a second download.
const zipName = `electron-v${electronPkg.version}-win32-x64.zip`
let zipDir
const cacheRoots = [
  process.env.ELECTRON_CACHE,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'electron/Cache'),
  process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'AppData/Local/electron/Cache'),
].filter(Boolean)
for (const cacheRoot of cacheRoots) {
  for (const dir of await fs.readdir(cacheRoot, { withFileTypes: true }).catch(() => [])) {
    if (dir.isDirectory()) {
      const candidate = path.join(cacheRoot, dir.name)
      try {
        await fs.access(path.join(candidate, zipName))
        zipDir = candidate
        break
      } catch {}
    }
  }
  if (zipDir) break
}
console.log(zipDir ? 'Using cached Electron runtime.' : 'Downloading Electron runtime.')
const results = await packager({
  dir: stage,
  out: packageOutput,
  tmpdir: packageTemp,
  name: 'DOIT',
  platform: 'win32',
  arch: 'x64',
  electronVersion: electronPkg.version,
  electronZipDir: zipDir,
  icon: path.join(root, 'public/icon.ico'),
  asar: true,
  overwrite: false,
  prune: false,
  appCopyright: 'DOIT 拾序',
  win32metadata: {
    CompanyName: 'DOIT',
    FileDescription: 'DOIT 拾序 · 个人管理工作台',
    ProductName: 'DOIT 拾序',
    InternalName: 'DOIT',
  },
})
const readme = [
  `DOIT 拾序 v${pkg.version}`,
  '',
  '双击 DOIT.exe 启动，无需安装。请保留本文件夹内的其他文件。',
  '个人数据保存在同目录的 data 文件夹中。移动软件时请连同 data 一起移动。',
  '首次启动含示例事项和示例习惯，可直接编辑或删除；账本与投资台账从空白开始。请定期在“设置与数据”中导出完整备份。',
  '打卡模块支持习惯预设、自定义目标、数值强度与日历补记。',
  '记账模块支持收入支出、账户和自定义分类、时间轴与日历、对账调整及 AA 均摊/回款；建议先设置账户的记账前余额。',
  'AA 按个人承担统计消费，回款只增加实际到账账户余额；对账调整单独展示，不计日常收支。',
  '资产模块支持期初持仓、买入卖出、现金分红、分红再投、费用、单项与批量估值，以及投资总览和清仓历史。',
  '基金股票可按份额和价格管理，理财可按金额管理；投资市值不含日常流动资金。暂为手动估值，不自动改变记账账户余额。',
  '累计收益包含持仓盈亏、已实现盈亏和分红；期初之前的已卖出收益及分红不会自动追溯。',
  '设置采用左侧分类、右侧内容的布局；“外观”支持六种纯色主题、远山背景、自定义背景图片与五种字体（含本机安装的霞鹜975圆体）。',
  '“数据管理”集中展示各模块记录数量、数据备份导入导出、数据位置与保存状态。',
  '自定义背景图片仅保存在本机，外观偏好与图片包含在完整数据备份中，重启后自动恢复。',
  '',
].join('\r\n')
const release = path.join(root, 'release/DOIT-win32-x64')
// Merge the new application into the portable folder; never remove an existing data folder.
await fs.mkdir(release, { recursive: true })
await fs.cp(results[0], release, { recursive: true })
await fs.writeFile(path.join(release, '使用说明.txt'), readme, 'utf8')
console.log('Packaged:', release)
await fs.writeFile(
  path.join(root, '.packaging/latest-clean-package.json'),
  JSON.stringify(
    {
      version: pkg.version,
      appDir: results[0],
      stage,
    },
    null,
    2,
  ),
)
