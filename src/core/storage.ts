import type { AppData } from './types'
import { validateData } from '../modules/tasks/logic'
import { upgradeData } from './migrations'
const KEY = 'doit-data-v1'
export async function loadData(): Promise<AppData | null> {
  const value = window.desktop
    ? await window.desktop.load()
    : JSON.parse(localStorage.getItem(KEY) || 'null')
  if (value !== null && !validateData(value))
    throw new Error('数据格式不完整。为保护原文件，已暂停自动保存，请从备份恢复。')
  return value ? upgradeData(value) : null
}
export async function saveData(data: AppData, beforeClear = false) {
  if (window.desktop) return window.desktop.save(data, beforeClear)
  else localStorage.setItem(KEY, JSON.stringify(data))
}
export async function exportData(data: AppData) {
  if (window.desktop) return window.desktop.exportData(data)
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `DOIT-备份-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
