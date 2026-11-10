import type { Task } from '../../core/types'
import { friendlyDate, shortDate } from '../../core/dates'
import { spansMultipleDays } from './logic'

export function taskDateLabel(task: Task, day: string) {
  if (task.repeat !== 'none') return friendlyDate(day)
  if (spansMultipleDays(task)) return `${shortDate(task.startDate)}–${shortDate(task.dueDate)}`
  return task.dueDate ? friendlyDate(task.dueDate) : '未安排'
}

export function taskScheduleLabel(task: Task, day: string) {
  const date = taskDateLabel(task, day)
  if (task.timeMode === 'allday' || (!task.dueDate && task.repeat === 'none')) return date
  if (task.timeMode === 'point') return `${date} ${task.startTime}`
  if (task.kind === 'normal' && spansMultipleDays(task))
    return `${shortDate(task.startDate)} ${task.startTime}–${shortDate(task.dueDate)} ${task.endTime}`
  return `${date} ${task.startTime}–${task.endTime}`
}

export function taskCalendarTime(task: Task, day: string) {
  if (task.timeMode === 'allday') return ''
  if (task.timeMode === 'point') return task.startTime
  if (task.kind === 'normal' && spansMultipleDays(task)) {
    if (day === task.startDate) return `${task.startTime} 起`
    if (day === task.dueDate) return `${task.endTime} 止`
    return ''
  }
  return `${task.startTime}–${task.endTime}`
}
