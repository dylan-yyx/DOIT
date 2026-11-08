import type { Task } from '../../core/types'
import { checksFor, isCompleted, occurrenceKey } from './logic'

export type ChecklistEdit =
  | { type: 'add'; title: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'remove'; id: string }

export function editChecklist(task: Task, edit: ChecklistEdit, day: string): Task {
  if (task.kind !== 'normal') return task
  if (edit.type === 'rename') {
    return {
      ...task,
      checklist: task.checklist.map((item) =>
        item.id === edit.id ? { ...item, title: edit.title } : item,
      ),
    }
  }
  if (edit.type === 'add' && !edit.title.trim()) return task
  const checklist =
    edit.type === 'add'
      ? [...task.checklist, { id: crypto.randomUUID(), title: edit.title.trim() }]
      : task.checklist.filter((item) => item.id !== edit.id)
  const validIds = new Set(checklist.map((item) => item.id))
  const occurrences = Object.fromEntries(
    Object.entries(task.occurrences).map(([key, state]) => [
      key,
      {
        ...state,
        checks: state.checks?.filter((id) => validIds.has(id)),
      },
    ]),
  )
  const key = occurrenceKey(task, day)
  const checks = checksFor(task, day).filter((id) => validIds.has(id))
  const completed = checklist.length
    ? checklist.every((item) => checks.includes(item.id))
    : isCompleted(task, day)
  const completedAt = completed
    ? task.occurrences[key]?.completedAt || new Date().toISOString()
    : undefined
  // A structural edit changes this occurrence; historical completion is left intact.
  occurrences[key] = { ...occurrences[key], checks, completed, completedAt }
  return {
    ...task,
    checklist,
    occurrences,
    completed: task.repeat === 'none' ? completed : task.completed,
    completedAt: task.repeat === 'none' ? completedAt : task.completedAt,
  }
}
