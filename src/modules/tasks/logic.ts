import type { Task, Repeat, AppData } from '../../core/types'
import { addDays, dateKey, daysBetween, parseDate } from '../../core/dates'
import { validateHabitData } from '../habits/logic'
import { validateFinanceData } from '../finance/logic'
import { validateAssetsData } from '../assets/logic'
import { validateAppearance } from '../../core/appearance'
export const repeatNames: Record<Repeat, string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '每周工作日',
  weekends: '每周休息日',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  custom: '自定义星期',
}
export function occursOn(task: Task, day: string): boolean {
  if (task.repeat === 'none') {
    if (!task.dueDate) return false
    return task.kind === 'progress'
      ? day >= (task.startDate || task.dueDate) && day <= task.dueDate
      : day === task.dueDate
  }
  const anchor = task.startDate || task.dueDate
  if (!anchor || day < anchor || (task.repeatUntil && day > task.repeatUntil)) return false
  const d = parseDate(day),
    a = parseDate(anchor),
    w = d.getDay()
  switch (task.repeat) {
    case 'daily':
      return true
    case 'weekdays':
      return w >= 1 && w <= 5
    case 'weekends':
      return w === 0 || w === 6
    case 'weekly':
      return w === a.getDay()
    case 'monthly':
      return (
        d.getDate() ===
        Math.min(a.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())
      )
    case 'yearly':
      return (
        d.getMonth() === a.getMonth() &&
        d.getDate() ===
          Math.min(a.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())
      )
    case 'custom':
      return task.repeatDays.includes(w)
  }
}
export function occurrenceKey(task: Task, day: string) {
  return task.repeat === 'none' ? 'once' : day
}
export function checksFor(task: Task, day: string) {
  return task.occurrences[occurrenceKey(task, day)]?.checks || []
}
export function progressValue(task: Task, day?: string) {
  return Math.min(
    task.total,
    Math.max(
      0,
      task.entries.filter((e) => !day || e.date <= day).reduce((n, e) => n + e.amount, 0),
    ),
  )
}
export function isCompleted(task: Task, day: string): boolean {
  if (task.kind === 'progress') return progressValue(task) >= task.total
  return task.repeat === 'none' ? task.completed : !!task.occurrences[day]?.completed
}
export function progressInfo(task: Task, day = dateKey()) {
  const start = task.startDate || task.dueDate || day,
    end = task.dueDate || start
  const days = Math.max(1, daysBetween(start, end) + 1)
  const elapsed = Math.min(days, Math.max(0, daysBetween(start, day) + 1))
  const expected = (task.total * elapsed) / days,
    actual = progressValue(task, day)
  return {
    days,
    elapsed,
    daily: task.total / days,
    expected,
    actual,
    ratio: actual / task.total,
    expectedRatio: expected / task.total,
    delta: actual - expected,
  }
}
export function toggleComplete(task: Task, day: string): Task {
  if (task.kind === 'progress') return task
  const key = occurrenceKey(task, day),
    completed = !isCompleted(task, day)
  return {
    ...task,
    completed: task.repeat === 'none' ? completed : task.completed,
    completedAt: completed ? new Date().toISOString() : undefined,
    occurrences: {
      ...task.occurrences,
      [key]: {
        ...task.occurrences[key],
        completed,
        checks: completed ? task.checklist.map((c) => c.id) : [],
        completedAt: completed ? new Date().toISOString() : undefined,
      },
    },
  }
}
export function toggleCheck(task: Task, id: string, day: string): Task {
  if (task.kind !== 'normal' || !task.checklist.some((item) => item.id === id)) return task
  const key = occurrenceKey(task, day),
    old = checksFor(task, day),
    checks = old.includes(id) ? old.filter((x) => x !== id) : [...old, id]
  const completed = task.checklist.length > 0 && task.checklist.every((c) => checks.includes(c.id))
  return {
    ...task,
    completed: task.repeat === 'none' ? completed : task.completed,
    completedAt: completed ? new Date().toISOString() : undefined,
    occurrences: {
      ...task.occurrences,
      [key]: { checks, completed, completedAt: completed ? new Date().toISOString() : undefined },
    },
  }
}
export function nextOccurrence(task: Task, from: string): string | null {
  if (task.repeat === 'none') return task.dueDate || null
  const anchor = task.startDate || task.dueDate
  const begin = anchor && anchor > from ? anchor : from
  for (let i = 0; i < 370; i++) {
    const day = addDays(begin, i)
    if (occursOn(task, day)) return day
  }
  return null
}
export function newTask(listId = 'inbox', day = dateKey()): Task {
  return {
    id: crypto.randomUUID(),
    title: '',
    listId,
    tagIds: [],
    notes: '',
    kind: 'normal',
    startDate: day,
    dueDate: day,
    timeMode: 'allday',
    startTime: '09:00',
    endTime: '10:00',
    repeat: 'none',
    repeatDays: [1, 2, 3, 4, 5],
    repeatUntil: '',
    priority: 'none',
    checklist: [],
    total: 20,
    unit: '章',
    entries: [],
    occurrences: {},
    completed: false,
    createdAt: new Date().toISOString(),
  }
}
export function validateData(value: unknown): value is AppData {
  // Import is an untrusted boundary. Malformed nested values must return false, never crash the UI.
  try {
    if (!value || typeof value !== 'object') return false
    const d = value as AppData
    const str = (v: unknown): v is string => typeof v === 'string'
    const date = (v: unknown) =>
      str(v) && (!v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && dateKey(parseDate(v)) === v))
    const time = (v: unknown) => str(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
    if (
      d.version !== 1 ||
      !Array.isArray(d.tasks) ||
      !Array.isArray(d.lists) ||
      !Array.isArray(d.folders) ||
      !Array.isArray(d.tags) ||
      !d.preferences ||
      !str(d.preferences.name) ||
      typeof d.preferences.showCompleted !== 'boolean'
    )
      return false
    if (!d.folders.every((f) => f && str(f.id) && str(f.name) && str(f.icon) && str(f.color)))
      return false
    if (
      !d.lists.every(
        (l) =>
          l &&
          str(l.id) &&
          str(l.name) &&
          str(l.icon) &&
          str(l.color) &&
          (!l.folderId || d.folders.some((f) => f.id === l.folderId)),
      ) ||
      !d.lists.some((l) => l.id === 'inbox')
    )
      return false
    if (!d.tags.every((t) => t && str(t.id) && str(t.name) && str(t.color))) return false
    if (
      [d.tasks, d.lists, d.folders, d.tags].some(
        (a) => new Set(a.map((x) => x.id)).size !== a.length,
      )
    )
      return false
    if (!validateHabitData(d)) return false
    if (!validateFinanceData(d.finance)) return false
    if (!validateAssetsData(d.assets)) return false
    if (!validateAppearance(d.preferences.appearance)) return false
    return d.tasks.every((t) => {
      if (
        !t ||
        !str(t.id) ||
        !str(t.title) ||
        !str(t.notes) ||
        !d.lists.some((l) => l.id === t.listId)
      )
        return false
      if (!Array.isArray(t.tagIds) || !t.tagIds.every((id) => d.tags.some((g) => g.id === id)))
        return false
      if (
        !['normal', 'progress'].includes(t.kind) ||
        !date(t.startDate) ||
        !date(t.dueDate) ||
        !date(t.repeatUntil)
      )
        return false
      if (t.startDate && t.dueDate && t.startDate > t.dueDate) return false
      if (
        !['allday', 'point', 'range'].includes(t.timeMode) ||
        !time(t.startTime) ||
        !time(t.endTime) ||
        (t.timeMode === 'range' && t.endTime <= t.startTime)
      )
        return false
      if (
        !Object.hasOwn(repeatNames, t.repeat) ||
        !Array.isArray(t.repeatDays) ||
        !t.repeatDays.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      )
        return false
      if (
        (t.repeat !== 'none' && !(t.startDate || t.dueDate)) ||
        (t.repeat === 'custom' && !t.repeatDays.length)
      )
        return false
      if (
        !['none', 'low', 'medium', 'high'].includes(t.priority) ||
        !Array.isArray(t.checklist) ||
        !t.checklist.every((c) => c && str(c.id) && str(c.title))
      )
        return false
      if (
        !Number.isFinite(t.total) ||
        t.total <= 0 ||
        !str(t.unit) ||
        !Array.isArray(t.entries) ||
        !t.entries.every(
          (e) =>
            e && str(e.id) && !!e.date && date(e.date) && Number.isFinite(e.amount) && e.amount > 0,
        )
      )
        return false
      if (t.kind === 'progress' && (!t.startDate || !t.dueDate || t.repeat !== 'none')) return false
      if (!t.occurrences || typeof t.occurrences !== 'object' || Array.isArray(t.occurrences))
        return false
      if (
        !Object.entries(t.occurrences).every(
          ([key, o]) =>
            (key === 'once' || (!!key && date(key))) &&
            o &&
            typeof o === 'object' &&
            (o.completed === undefined || typeof o.completed === 'boolean') &&
            (!o.checks || (Array.isArray(o.checks) && o.checks.every(str))),
        )
      )
        return false
      return typeof t.completed === 'boolean' && str(t.createdAt) && !isNaN(Date.parse(t.createdAt))
    })
  } catch {
    return false
  }
}
