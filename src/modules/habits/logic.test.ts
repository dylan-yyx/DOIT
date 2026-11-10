import { describe, expect, it } from 'vitest'
import { createSeed } from '../../core/seed'
import { validateData } from '../tasks/logic'
import {
  createHabitExamples,
  habitDone,
  habitIntensity,
  habitMonthStats,
  habitOccursOn,
  habitStreak,
  newHabit,
  recordHabit,
  withHabitData,
} from './logic'

const habit = () => ({
  ...newHabit('2026-11-02'),
  name: '阅读',
  goal: { type: 'quantity' as const, target: 30, unit: '分钟' },
})
describe('习惯频率、打卡与强度', () => {
  it('开始日期之前不安排；自定义星期与休息日按实际星期判断', () => {
    expect(habitOccursOn(habit(), '2026-11-01')).toBe(false)
    expect(habitOccursOn({ ...habit(), frequency: 'weekdays' }, '2026-11-07')).toBe(false)
    expect(habitOccursOn({ ...habit(), frequency: 'weekends' }, '2026-11-08')).toBe(true)
    expect(habitOccursOn({ ...habit(), frequency: 'custom', days: [1, 5] }, '2026-11-06')).toBe(
      true,
    )
    expect(habitOccursOn({ ...habit(), frequency: 'custom', days: [1, 5] }, '2026-11-04')).toBe(
      false,
    )
  })
  it('15 分钟保留未达标记录；30、60、90 分钟对应不同的达标强度', () => {
    const h = habit(),
      day = '2026-11-08'
    for (const [value, level, done] of [
      [15, 1, false],
      [30, 2, true],
      [60, 3, true],
      [90, 4, true],
    ] as const) {
      const next = recordHabit(h, day, value, day)
      expect(habitDone(next, day)).toBe(done)
      expect(habitIntensity(next, day)).toBe(level)
    }
  })
  it('保存是更新当日总量，零值撤销；无效数值和未来日期不能记入', () => {
    const day = '2026-11-08',
      h = recordHabit(habit(), day, 60, day)
    expect(recordHabit(h, day, 90, day).records[day].value).toBe(90)
    expect(recordHabit(h, day, 0, day).records[day]).toBeUndefined()
    for (const value of [NaN, Infinity, -5]) expect(recordHabit(h, day, value, day)).toBe(h)
    expect(recordHabit(h, '2026-11-09', 30, day)).toBe(h)
    expect(recordHabit({ ...h, frequency: 'weekdays' }, day, 30, day).records[day].value).toBe(60)
  })
  it('完成类习惯只接受 0 或 1，一次即可达标', () => {
    const h = { ...habit(), goal: { type: 'check' as const, target: 1, unit: '次' } }
    expect(recordHabit(h, '2026-11-08', 2, '2026-11-08')).toBe(h)
    expect(habitDone(recordHabit(h, '2026-11-08', 1, '2026-11-08'), '2026-11-08')).toBe(true)
  })
  it('连续达标跳过非计划日，今天未完成仍保留之前的连续次数', () => {
    const h = {
      ...habit(),
      frequency: 'weekdays' as const,
      records: { '2026-11-05': { value: 30 }, '2026-11-06': { value: 60 } },
    }
    expect(habitStreak(h, '2026-11-09')).toBe(2)
    expect(habitStreak(h, '2026-11-10')).toBe(0)
  })
  it('月完成率只纳入已经到来的计划日，零计划不出现 NaN', () => {
    const h = {
      ...habit(),
      frequency: 'weekdays' as const,
      records: { '2026-11-05': { value: 30 }, '2026-11-06': { value: 60 } },
    }
    expect(habitMonthStats(h, '2026-11-01', '2026-11-08')).toEqual({
      done: 2,
      planned: 5,
      rate: 40,
    })
    expect(habitMonthStats(h, '2026-12-01', '2026-11-08')).toEqual({ done: 0, planned: 0, rate: 0 })
  })
})
describe('习惯数据与旧版备份兼容', () => {
  it('旧数据补充习惯时保留待办；空数组不重复生成示例', () => {
    const data = createSeed()
    delete data.habits
    delete data.habitGroups
    expect(validateData(data)).toBe(true)
    const upgraded = withHabitData(data)
    expect(upgraded.tasks).toEqual(data.tasks)
    expect(upgraded.habits).toHaveLength(0)
    expect(withHabitData({ ...upgraded, habits: [] }).habits).toEqual([])
    expect(validateData(upgraded)).toBe(true)
  })
  it('示例数据有效；坏的打卡数值、目标、日期、分组与重复 ID 被拒绝', () => {
    const data = { ...createSeed(), ...createHabitExamples('2026-11-08') }
    expect(validateData(data)).toBe(true)
    for (const patch of [
      { goal: { type: 'quantity', target: 0, unit: '分钟' } },
      { startDate: '2026-02-30' },
      { records: { '2026-11-08': { value: -1 } } },
      { groupId: 'missing' },
      { frequency: 'custom', days: [] },
    ])
      expect(validateData({ ...data, habits: [{ ...data.habits[0], ...patch }] })).toBe(false)
    expect(validateData({ ...data, habits: [data.habits[0], data.habits[0]] })).toBe(false)
    expect(validateData({ ...data, habitGroups: null })).toBe(false)
  })
})
