const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')
const fs = require('node:fs/promises')
const syncFs = require('node:fs')
const path = require('node:path')
const { resolveDataDir } = require('./data-path.cjs')
const dataDir = resolveDataDir({
  override: process.env.DOIT_DATA_DIR,
  packaged: app.isPackaged,
  installed: syncFs.existsSync(path.join(process.resourcesPath, 'installed.json')),
  exeDir: path.dirname(app.getPath('exe')),
  appData: app.getPath('appData'),
  projectDir: path.join(__dirname, '..'),
})
syncFs.mkdirSync(dataDir, { recursive: true })
app.setPath('userData', path.join(dataDir, 'runtime'))
app.setName('DOIT 拾序')
const dataFile = path.join(dataDir, 'data.json')
let mainWindow,
  saveQueue = Promise.resolve(),
  quitting = false
function trusted(event) {
  return (
    mainWindow &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame
  )
}
function assertTrusted(event) {
  if (!trusted(event)) throw new Error('Unauthorized sender')
}
ipcMain.handle('data:load', async (event) => {
  assertTrusted(event)
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw new Error('本地数据无法读取，请保留原文件并恢复备份。')
  }
})
ipcMain.handle('data:save', (event, data) => {
  assertTrusted(event)
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.tasks) ||
    JSON.stringify(data).length > 20 * 1024 * 1024
  )
    throw new Error('数据格式或大小不正确')
  const text = JSON.stringify(data, null, 2)
  const operation = saveQueue
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(dataDir, { recursive: true })
      await fs.writeFile(dataFile + '.tmp', text, 'utf8')
      try {
        await fs.copyFile(dataFile, dataFile + '.bak')
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
      await fs.rename(dataFile + '.tmp', dataFile)
    })
  saveQueue = operation
  return operation
})
ipcMain.handle('data:export', async (event, data) => {
  assertTrusted(event)
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出 DOIT 备份',
    defaultPath: `DOIT-备份-${new Date().toLocaleDateString('sv-SE')}.json`,
    filters: [{ name: 'DOIT 数据备份', extensions: ['json'] }],
  })
  if (canceled || !filePath) return false
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  return true
})
ipcMain.handle('data:import', async (event) => {
  assertTrusted(event)
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '选择 DOIT 备份',
    properties: ['openFile'],
    filters: [{ name: 'DOIT 数据备份', extensions: ['json'] }],
  })
  if (canceled || !filePaths.length) return null
  const stat = await fs.stat(filePaths[0])
  if (stat.size > 20 * 1024 * 1024) throw new Error('备份文件不能超过 20 MB')
  return JSON.parse(await fs.readFile(filePaths[0], 'utf8'))
})
ipcMain.handle('data:path', (event) => {
  assertTrusted(event)
  return dataFile
})
ipcMain.on('window:action', (event, action) => {
  if (!trusted(event)) return
  if (action === 'minimize') mainWindow.minimize()
  if (action === 'maximize')
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  if (action === 'close') mainWindow.close()
})
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    frame: false,
    backgroundColor: '#f8faf8',
    title: 'DOIT 拾序',
    show: false,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.removeMenu()
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (process.env.DOIT_DEV_URL === 'http://127.0.0.1:5173')
    mainWindow.loadURL(process.env.DOIT_DEV_URL)
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}
const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    saveQueue
      .catch(() => {})
      .finally(() => {
        quitting = true
        app.quit()
      })
  })
}
