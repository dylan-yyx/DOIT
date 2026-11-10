import type { AppData } from './types'
import { createSeed } from './seed'
import type { ModuleId } from '../modules/registry'

export function clearModuleData(data: AppData, selected: readonly ModuleId[]): AppData {
  const empty = createSeed()
  const next = { ...data }
  if (selected.includes('tasks')) {
    next.tasks = empty.tasks
    next.lists = empty.lists
    next.folders = empty.folders
    next.tags = empty.tags
    next.tagGroups = empty.tagGroups
    delete next.taskSidebarOrder
    delete next.taskListSorting
  }
  if (selected.includes('habits')) {
    next.habits = empty.habits
    next.habitGroups = empty.habitGroups
  }
  if (selected.includes('finance')) next.finance = empty.finance
  if (selected.includes('assets')) next.assets = empty.assets
  return next
}
