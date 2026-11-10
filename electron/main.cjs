const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron')
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
const windowSettingsFile = path.join(dataDir, 'window-settings.json')
const closeChoices = [
  { id: 'ask', label: '询问' },
  { id: 'tray', label: '最小化到托盘' },
  { id: 'quit', label: '退出应用' },
]
let mainWindow,
  tray,
  saveQueue = Promise.resolve(),
  closeChoice = 'ask',
  askingToClose = false,
  quitPending = false,
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
    const value = JSON.parse(await fs.readFile(dataFile, 'utf8'))
    if (value?.preferences && !value.preferences.exampleCleanupDone) {
      try {
        await fs.copyFile(
          dataFile,
          path.join(dataDir, 'data.before-v0.4.0.json'),
          syncFs.constants.COPYFILE_EXCL,
        )
      } catch (e) {
        if (e.code !== 'EEXIST') throw e
      }
    }
    return value
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw new Error('本地数据无法读取，请保留原文件并恢复备份。')
  }
})
ipcMain.handle('data:save', (event, data, beforeClear) => {
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
      const backup =
        beforeClear === true ? path.join(dataDir, `DOIT-清空前-${Date.now()}.json`) : undefined
      if (backup) await fs.copyFile(dataFile, backup, syncFs.constants.COPYFILE_EXCL)
      await fs.writeFile(dataFile + '.tmp', text, 'utf8')
      try {
        await fs.copyFile(dataFile, dataFile + '.bak')
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
      await fs.rename(dataFile + '.tmp', dataFile)
      return backup
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

function showWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function updateTrayMenu() {
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 DOIT', click: showWindow },
      {
        label: '关闭按钮行为',
        submenu: closeChoices.map(({ id, label }) => ({
          label,
          type: 'radio',
          checked: closeChoice === id,
          click: () => setCloseChoice(id),
        })),
      },
      { type: 'separator' },
      { label: '退出 DOIT', click: () => app.quit() },
    ]),
  )
}

function setCloseChoice(choice) {
  closeChoice = choice
  try {
    syncFs.writeFileSync(windowSettingsFile + '.tmp', JSON.stringify({ closeChoice: choice }))
    syncFs.renameSync(windowSettingsFile + '.tmp', windowSettingsFile)
  } catch (error) {
    console.warn('Could not save the window settings:', error.code)
  }
  updateTrayMenu()
}

function createTray() {
  try {
    const saved = JSON.parse(syncFs.readFileSync(windowSettingsFile, 'utf8'))
    if (closeChoices.some(({ id }) => id === saved?.closeChoice)) closeChoice = saved.closeChoice
  } catch {}
  tray = new Tray(path.join(__dirname, '../public/icon.ico'))
  tray.setToolTip('DOIT 拾序')
  tray.on('click', showWindow)
  updateTrayMenu()
}

async function closeWindow(window) {
  if (askingToClose || quitPending) return
  if (closeChoice === 'tray') return window.hide()
  if (closeChoice === 'quit') return app.quit()
  askingToClose = true
  try {
    const { response, checkboxChecked } = await dialog.showMessageBox(window, {
      type: 'question',
      title: '关闭 DOIT',
      message: '关闭窗口时如何处理 DOIT？',
      detail: '最小化后可从系统托盘重新打开。可随时在托盘菜单中修改关闭行为。',
      buttons: [closeChoices[1].label, closeChoices[2].label, '取消'],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: '记住此选择',
      checkboxChecked: true,
      noLink: true,
    })
    if (response === 2 || quitPending || window.isDestroyed()) return
    if (checkboxChecked) setCloseChoice(response === 0 ? 'tray' : 'quit')
    if (response === 0) window.hide()
    else if (response === 1) app.quit()
  } catch {
    // Keep the window open if the system dialog cannot be shown.
  } finally {
    askingToClose = false
  }
}

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
  const window = mainWindow
  window.once('ready-to-show', () => {
    window.maximize()
    window.show()
  })
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    void closeWindow(window)
  })
  window.on('closed', () => {
    mainWindow = null
  })
  if (process.env.DOIT_DEV_URL === 'http://127.0.0.1:5173')
    mainWindow.loadURL(process.env.DOIT_DEV_URL)
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}
const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
else {
  app.on('second-instance', showWindow)
  app.whenReady().then(() => {
    createTray()
    createWindow()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    if (quitPending) return
    quitPending = true
    saveQueue
      .catch(() => {})
      .finally(() => {
        quitting = true
        app.quit()
      })
  })
}
