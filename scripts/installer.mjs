import { build, Platform, Arch } from 'electron-builder'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'

const root = process.cwd()
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'))
const clean = JSON.parse(await fs.readFile('.packaging/latest-clean-package.json', 'utf8'))
if (clean.version !== pkg.version)
  throw new Error('请先运行 pnpm build 和 pnpm package，生成当前版本的干净程序。')
const appDir = path.resolve(clean.appDir)
if (!appDir.startsWith(path.join(root, '.packaging') + path.sep))
  throw new Error('安装包只能使用隔离构建目录。')
// Never package the live portable folder: it contains the owner's personal data.
for (const forbidden of ['data', 'runtime', '.local-data']) {
  if (await fs.stat(path.join(appDir, forbidden)).catch(() => null))
    throw new Error(`构建目录中含有个人数据：${forbidden}`)
}
await fs.writeFile(path.join(appDir, 'resources/installed.json'), '{"storage":"appData"}\n')
const output = path.join(root, 'release/installers')
await build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  prepackaged: appDir,
  projectDir: clean.stage,
  publish: 'never',
  config: {
    appId: 'com.doit.desktop',
    productName: 'DOIT 拾序',
    artifactName: 'DOIT-Setup-${version}-${arch}.${ext}',
    directories: { output, buildResources: path.join(root, 'public') },
    electronVersion: JSON.parse(await fs.readFile('node_modules/electron/package.json', 'utf8'))
      .version,
    win: {
      executableName: 'DOIT',
      icon: path.join(root, 'public/icon.ico'),
      signAndEditExecutable: false,
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowElevation: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'DOIT 拾序',
      uninstallDisplayName: 'DOIT 拾序',
      installerLanguages: ['zh_CN', 'en_US'],
      language: '2052',
      runAfterFinish: true,
      deleteAppDataOnUninstall: false,
    },
  },
})
const name = `DOIT-Setup-${pkg.version}-x64.exe`
const hash = crypto.createHash('sha256')
for await (const chunk of createReadStream(path.join(output, name))) hash.update(chunk)
await fs.writeFile(path.join(output, 'SHA256SUMS.txt'), `${hash.digest('hex')}  ${name}\n`)
console.log('Installer:', path.join(output, name))
