import type { AppData, Habit, HabitGroup } from '../../core/types'
import { addDays, dateKey, daysBetween, parseDate } from '../../core/dates'

export const habitFrequencies = {
  daily: '每天',
  weekdays: '工作日',
  weekends: '休息日',
  custom: '自定义星期',
}
export const habitColors = ['#32856f', '#7f83b0', '#bd8c57', '#7193ac', '#bc7e81', '#7e9862']
export const habitPresets = [
  {
    name: '阅读',
    icon: 'BookOpen',
    color: habitColors[0],
    group: '学习成长',
    type: 'quantity',
    target: 30,
    unit: '分钟',
    description: '每天给自己一点阅读时间',
  },
  {
    name: '运动',
    icon: 'Dumbbell',
    color: habitColors[1],
    group: '健康生活',
    type: 'quantity',
    target: 30,
    unit: '分钟',
    description: '让身体动起来',
  },
  {
    name: '喝水',
    icon: 'Coffee',
    color: habitColors[3],
    group: '健康生活',
    type: 'quantity',
    target: 2000,
    unit: 'ml',
    description: '记得及时补充水分',
  },
  {
    name: '戒糖',
    icon: 'Leaf',
    color: habitColors[5],
    group: '健康生活',
    type: 'check',
    target: 1,
    unit: '次',
    description: '少一点添加糖',
  },
  {
    name: '冥想',
    icon: 'Sprout',
    color: habitColors[2],
    group: '自我关照',
    type: 'quantity',
    target: 10,
    unit: '分钟',
    description: '留一小段安静的时间',
  },
  {
    name: '早睡',
    icon: 'Moon',
    color: habitColors[1],
    group: '自我关照',
    type: 'check',
    target: 1,
    unit: '次',
    description: '按自己的计划好好休息',
  },
  {
    name: '写作',
    icon: 'Pencil',
    color: habitColors[4],
    group: '学习成长',
    type: 'quantity',
    target: 500,
    unit: '字',
    description: '把想法慢慢写下来',
  },
  {
    name: '学外语',
    icon: 'GraduationCap',
    color: habitColors[3],
    group: '学习成长',
    type: 'quantity',
    target: 20,
    unit: '分钟',
    description: '每天积累一点新知识',
  },
] as const

export function newHabit(today = dateKey()): Habit {
  return {
    id: crypto.randomUUID(),
    name: '',
    icon: 'Target',
    color: habitColors[0],
    groupId: '',
    frequency: 'daily',
    days: [1, 2, 3, 4, 5],
    startDate: today,
    goal: { type: 'check', target: 1, unit: '次' },
    records: {},
    createdAt: new Date().toISOString(),
  }
}
export function habitOccursOn(habit: Habit, day: string) {
  if (day < habit.startDate) return false
  const weekday = parseDate(day).getDay()
  return (
    habit.frequency === 'daily' ||
    (habit.frequency === 'weekdays' && weekday > 0 && weekday < 6) ||
    (habit.frequency === 'weekends' && (weekday === 0 || weekday === 6)) ||
    (habit.frequency === 'custom' && habit.days.includes(weekday))
  )
}
export function habitValue(habit: Habit, day: string) {
  return habit.records[day]?.value || 0
}
export function habitDone(habit: Habit, day: string) {
  return habitOccursOn(habit, day) && habitValue(habit, day) >= habit.goal.target
}
export function habitIntensity(habit: Habit, day: string) {
  const value = habitValue(habit, day)
  if (!value) return 0
  if (habit.goal.type === 'check') return 2
  const ratio = value / habit.goal.target
  return ratio < 1 ? 1 : ratio < 2 ? 2 : ratio < 3 ? 3 : 4
}
export function habitGoalText(habit: Habit) {
  return habit.goal.type === 'check'
    ? '完成即可打卡'
    : `${habit.frequency === 'daily' ? '每日' : '计划日'}目标 ${habit.goal.target} ${habit.goal.unit}`
}
export function habitFrequencyText(habit: Habit) {
  if (habit.frequency !== 'custom') return habitFrequencies[habit.frequency]
  const names = ['日', '一', '二', '三', '四', '五', '六']
  return `每周${[1, 2, 3, 4, 5, 6, 0]
    .filter((n) => habit.days.includes(n))
    .map((n) => names[n])
    .join('、')}`
}
export function recordHabit(habit: Habit, day: string, value: number, today = dateKey()): Habit {
  if (day > today || !habitOccursOn(habit, day) || !Number.isFinite(value) || value < 0)
    return habit
  if (habit.goal.type === 'check' && value !== 0 && value !== 1) return habit
  const records = { ...habit.records }
  if (value === 0) delete records[day]
  else records[day] = { ...records[day], value }
  return { ...habit, records }
}
export function habitStreak(habit: Habit, today = dateKey()) {
  let streak = 0
  const count = Math.max(0, daysBetween(habit.startDate, today))
  for (let i = 0; i <= count; i++) {
    const day = addDays(today, -i)
    if (!habitOccursOn(habit, day)) continue
    if (i === 0 && !habitDone(habit, day)) continue
    if (!habitDone(habit, day)) break
    streak++
  }
  return streak
}
export function habitMonthStats(habit: Habit, month: string, today = dateKey()) {
  const start = month.slice(0, 7) + '-01'
  const date = parseDate(start)
  const length = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const days = Array.from({ length }, (_, i) => addDays(start, i)).filter(
    (d) => d <= today && habitOccursOn(habit, d),
  )
  const done = days.filter((d) => habitDone(habit, d)).length
  return {
    done,
    planned: days.length,
    rate: days.length ? Math.round((done / days.length) * 100) : 0,
  }
}
export function createHabitSeed(today = dateKey()): { habits: Habit[]; habitGroups: HabitGroup[] } {
  const habitGroups = [
    { id: 'habit-growth', name: '学习成长', color: habitColors[0] },
    { id: 'habit-health', name: '健康生活', color: habitColors[1] },
    { id: 'habit-self', name: '自我关照', color: habitColors[2] },
  ]
  const habits = habitPresets.slice(0, 6).map((preset, index): Habit => {
    const habit: Habit = {
      ...newHabit(today),
      id: `habit-example-${index}`,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      groupId: habitGroups.find((g) => g.name === preset.group)!.id,
      goal: { type: preset.type, target: preset.target, unit: preset.unit },
      startDate: addDays(today, -35),
      example: true,
    }
    for (let i = 35; i > 0; i--) {
      if ((i + index * 2) % (index === 0 ? 13 : 5) === 0) continue
      habit.records[addDays(today, -i)] = {
        value:
          preset.type === 'check' ? 1 : preset.target * (index === 0 ? [1, 2, 1, 3][i % 4] : 1),
      }
    }
    if (index === 0) habit.records[today] = { value: 60 }
    if (index === 2) habit.records[today] = { value: 1500 }
    if (index === 3) habit.records[today] = { value: 1 }
    return habit
  })
  return { habits, habitGroups }
}
// v1 backups made before this module remain valid; initialize examples only once.
export function withHabitData(data: AppData): AppData {
  if (data.habits !== undefined) return { ...data, habitGroups: data.habitGroups || [] }
  return { ...data, ...createHabitSeed() }
}

export function validateHabitData(data: AppData): boolean {
  if (data.habits === undefined && data.habitGroups === undefined) return true
  if (!Array.isArray(data.habits) || !Array.isArray(data.habitGroups)) return false
  const str = (v: unknown): v is string => typeof v === 'string'
  const date = (v: unknown): v is string =>
    str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && dateKey(parseDate(v)) === v
  if (!data.habitGroups.every((g) => g && str(g.id) && !!g.id && str(g.name) && str(g.color)))
    return false
  if (
    [data.habits, data.habitGroups].some(
      (items) => new Set(items.map((i) => i.id)).size !== items.length,
    )
  )
    return false
  return data.habits.every(
    (h) =>
      h &&
      str(h.id) &&
      !!h.id &&
      str(h.name) &&
      str(h.icon) &&
      /^#[0-9a-f]{6}$/i.test(h.color) &&
      str(h.groupId) &&
      (!h.groupId || data.habitGroups!.some((g) => g.id === h.groupId)) &&
      ['daily', 'weekdays', 'weekends', 'custom'].includes(h.frequency) &&
      Array.isArray(h.days) &&
      h.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6) &&
      (h.frequency !== 'custom' || h.days.length > 0) &&
      date(h.startDate) &&
      !!h.goal &&
      ['check', 'quantity'].includes(h.goal.type) &&
      Number.isFinite(h.goal.target) &&
      h.goal.target > 0 &&
      str(h.goal.unit) &&
      !!h.goal.unit.trim() &&
      (h.goal.type !== 'check' || h.goal.target === 1) &&
      str(h.createdAt) &&
      !isNaN(Date.parse(h.createdAt)) &&
      (h.example === undefined || typeof h.example === 'boolean') &&
      !!h.records &&
      typeof h.records === 'object' &&
      !Array.isArray(h.records) &&
      Object.entries(h.records).every(
        ([day, r]) =>
          date(day) &&
          r &&
          typeof r === 'object' &&
          Number.isFinite(r.value) &&
          r.value > 0 &&
          (h.goal.type !== 'check' || r.value === 1) &&
          (r.note === undefined || str(r.note)),
      ),
  )
}
