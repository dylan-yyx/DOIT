import type { AppData } from './types'
import { createFinanceData } from '../modules/finance/logic'
import { createAssetsData } from '../modules/assets/logic'

export function createSeed(): AppData {
  return {
    version: 1,
    folders: [],
    tags: [],
    tagGroups: [],
    tasks: [],
    habits: [],
    habitGroups: [],
    lists: [{ id: 'inbox', name: '收集箱', icon: 'Inbox', color: '#7d8a89' }],
    finance: createFinanceData(),
    assets: createAssetsData(),
    preferences: { name: '', weekStartsOn: 1, showCompleted: true, exampleCleanupDone: true },
  }
}
