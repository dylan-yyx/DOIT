import type { AppData } from './types'
import { dateKey } from './dates'
import { createLegacySeed } from './legacy-examples'
import { withTagData } from '../modules/tasks/tags'
import { withHabitData } from '../modules/habits/logic'
import { withFinanceData } from '../modules/finance/logic'
import { withAssetsData } from '../modules/assets/logic'

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export function removeLegacyExamples(data: AppData): AppData {
  if (data.preferences.exampleCleanupDone) return data
  const original = createLegacySeed()
  const tasks = data.tasks.filter((task) => {
    if (!original.tasks.some((sample) => sample.id === task.id)) return true
    const sample = createLegacySeed(dateKey(new Date(task.createdAt))).tasks.find(
      (t) => t.id === task.id,
    )
    if (!sample) return true
    if (task.listId === 'inbox' && !data.lists.some((l) => l.id === sample.listId))
      sample.listId = 'inbox'
    // Preserve edited text, schedules, tags, checklists, and recorded progress.
    const compare = (t: typeof task) => {
      const {
        createdAt: _created,
        completedAt: _at,
        completed: _done,
        occurrences: _occurrences,
        ...rest
      } = t
      return rest
    }
    return stable(compare(task)) !== stable(compare(sample))
  })
  const removeLists = original.lists
    .filter((l) => l.id !== 'inbox' && data.lists.some((current) => stable(current) === stable(l)))
    .map((l) => l.id)
  const removeFolders = original.folders
    .filter((f) =>
      data.folders.some(({ collapsed: _collapsed, ...current }) => stable(current) === stable(f)),
    )
    .map((f) => f.id)
  const habits =
    data.habits?.filter((habit) => {
      if (!habit.example) return true
      const sample = createLegacySeed(dateKey(new Date(habit.createdAt))).habits?.find(
        (h) => h.id === habit.id,
      )
      if (!sample) return true
      const compare = ({ createdAt: _created, ...rest }: typeof habit) => rest
      return stable(compare(habit)) !== stable(compare(sample))
    }) || []
  const tags = data.tags.filter(
    (tag) =>
      !original.tags.some((sample) => stable(tag) === stable(sample)) ||
      tasks.some((t) => t.tagIds.includes(tag.id)),
  )
  return {
    ...data,
    tasks: tasks.map((t) => (removeLists.includes(t.listId) ? { ...t, listId: 'inbox' } : t)),
    lists: data.lists
      .filter((l) => !removeLists.includes(l.id))
      .map((l) => (removeFolders.includes(l.folderId || '') ? { ...l, folderId: undefined } : l)),
    folders: data.folders.filter((f) => !removeFolders.includes(f.id)),
    tags,
    habits,
    habitGroups:
      data.habitGroups?.filter(
        (g) =>
          habits.some((h) => h.groupId === g.id) ||
          !original.habitGroups?.some((sample) => stable(sample) === stable(g)),
      ) || [],
    preferences: { ...data.preferences, exampleCleanupDone: true },
  }
}
export function upgradeData(data: AppData): AppData {
  return withTagData(withAssetsData(withFinanceData(withHabitData(removeLegacyExamples(data)))))
}
