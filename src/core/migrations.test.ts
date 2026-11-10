import { describe, expect, it } from 'vitest'
import { createSeed } from './seed'
import { createLegacySeed } from './legacy-examples'
import { upgradeData } from './migrations'
import { newTask, validateData } from '../modules/tasks/logic'
import { habitPresets, newHabit } from '../modules/habits/logic'

describe('空白初始化与示例清理', () => {
  it('首次启动仅保留收集箱，习惯预设仍可供用户选择', () => {
    const data = createSeed()
    expect(data.lists.map((l) => l.id)).toEqual(['inbox'])
    for (const key of ['folders', 'tags', 'tagGroups', 'tasks', 'habits', 'habitGroups'] as const)
      expect(data[key]).toEqual([])
    expect(habitPresets).toHaveLength(8)
    expect(validateData(data)).toBe(true)
  })
  it('旧版原始示例可一次性清理，清理结果满足完整备份验证', () => {
    const data = upgradeData(createLegacySeed())
    expect(data.tasks).toEqual([])
    expect(data.habits).toEqual([])
    expect(data.tags).toEqual([])
    expect(data.folders).toEqual([])
    expect(data.lists.map((l) => l.id)).toEqual(['inbox'])
    expect(data.preferences.exampleCleanupDone).toBe(true)
    expect(validateData(data)).toBe(true)
    expect(upgradeData(data)).toEqual(data)
  })
  it('删除默认清单后自动移至收集箱的示例也能识别', () => {
    const old = createLegacySeed()
    old.tasks = old.tasks.map((t) => ({ ...t, listId: 'inbox' }))
    old.folders = []
    old.lists = old.lists.filter((l) => l.id === 'inbox')
    expect(upgradeData(old).tasks).toEqual([])
  })
  it('保留用户新增事项、习惯，以及修改过的示例、标签和进度', () => {
    const old = createLegacySeed()
    old.tasks[0].entries.push({ id: 'real-entry', date: old.tasks[0].dueDate, amount: 5 })
    old.tasks[1].notes = '自己填写的复盘笔记'
    const custom = { ...newTask(), id: 'my-task', title: '自己的事项', tagIds: ['focus'] }
    old.tasks.push(custom)
    old.habits![0].records[old.tasks[0].dueDate] = { value: 90, note: '自己的补记' }
    old.habits!.push({ ...newHabit(), id: 'mine', name: '自己的习惯' })
    old.tags[2].name = '自己改的标签'
    const next = upgradeData(old)
    expect(next.tasks.map((t) => t.id)).toEqual(['read', 'weekly-review', 'my-task'])
    expect(next.tasks[0].entries).toEqual(old.tasks[0].entries)
    expect(next.tasks.every((t) => t.listId === 'inbox')).toBe(true)
    expect(next.habits?.map((h) => h.id)).toEqual(['habit-example-0', 'mine'])
    expect(next.tags.some((t) => t.name === '自己改的标签')).toBe(true)
    expect(next.finance).toEqual(old.finance)
    expect(next.assets).toEqual(old.assets)
    expect(validateData(next)).toBe(true)
  })
  it('不按同名误删用户创建的记录；没有习惯模块的旧数据不再生成习惯', () => {
    const old = createLegacySeed()
    const own = { ...newTask(), title: old.tasks[0].title }
    old.tasks.push(own)
    delete old.habits
    delete old.habitGroups
    const next = upgradeData(old)
    expect(next.tasks.map((t) => t.id)).toEqual([own.id])
    expect(next.habits).toEqual([])
  })
})
