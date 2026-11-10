import { describe, expect, it } from 'vitest'
import { addDays, dateKey, daysBetween, monthGrid, startOfWeek } from '../../core/dates'
import { createLegacySeed as createSeed } from '../../core/legacy-examples'
import {
  checksFor,
  isCompleted,
  newTask,
  occursOn,
  progressInfo,
  progressValue,
  taskDateDraft,
  taskDateError,
  toggleCheck,
  toggleComplete,
  validateData,
} from './logic'
const task = () => ({ ...newTask('inbox', '2026-11-02'), title: '测试事项' })
describe('日期与重复规则', () => {
  it('以本地日历日期而不是 UTC 转换日期', () =>
    expect(dateKey(new Date(2026, 10, 7, 0, 1))).toBe('2026-11-07'))
  it('跨月和跨年正确计算天数', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
  it('周一为每周第一天，月历共六周', () => {
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26')
    expect(monthGrid('2026-11-07')).toHaveLength(42)
  })
  it('普通事项只在到期日出现', () => {
    expect(occursOn(task(), '2026-11-02')).toBe(true)
    expect(occursOn(task(), '2026-11-03')).toBe(false)
  })
  it('旧版普通事项保留原来的单日安排', () => {
    const legacy = { ...task(), startDate: '2026-11-01' }
    expect(occursOn(legacy, legacy.startDate)).toBe(false)
    expect(taskDateDraft(legacy)).toMatchObject({
      dateMode: 'single',
      startDate: legacy.dueDate,
      dueDate: legacy.dueDate,
    })
  })
  it('普通时间段包含起止日期，期间各天共享完成状态', () => {
    const range = { ...task(), dateMode: 'range' as const, dueDate: '2026-11-04' }
    expect([1, 2, 3, 4, 5].map((day) => occursOn(range, `2026-11-0${day}`))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ])
    expect(isCompleted(toggleComplete(range, range.startDate), range.dueDate)).toBe(true)
  })
  it('跨日时间段接受次日凌晨结束，单日时间段要求结束时间晚于开始', () => {
    const range = {
      ...task(),
      dateMode: 'range' as const,
      dueDate: '2026-11-03',
      timeMode: 'range' as const,
      startTime: '22:00',
      endTime: '06:00',
    }
    expect(taskDateError(range)).toBe('')
    expect(validateData({ ...createSeed(), tasks: [range] })).toBe(true)
    expect(taskDateError({ ...range, dueDate: range.startDate })).toContain('结束时间')
  })
  it('没有日期的事项不出现在日历', () =>
    expect(occursOn({ ...task(), dueDate: '', startDate: '' }, '2026-11-02')).toBe(false))
  it('每天重复不早于起始日期', () => {
    const t = { ...task(), repeat: 'daily' as const }
    expect(occursOn(t, '2026-11-01')).toBe(false)
    expect(occursOn(t, '2026-11-03')).toBe(true)
  })
  it('工作日按周一至周五计算', () => {
    const t = { ...task(), repeat: 'weekdays' as const }
    expect(occursOn(t, '2026-11-06')).toBe(true)
    expect(occursOn(t, '2026-11-07')).toBe(false)
  })
  it('休息日按周六周日计算', () => {
    const t = { ...task(), repeat: 'weekends' as const }
    expect(occursOn(t, '2026-11-07')).toBe(true)
    expect(occursOn(t, '2026-11-08')).toBe(true)
    expect(occursOn(t, '2026-11-09')).toBe(false)
  })
  it('每周沿用起始星期', () => {
    const t = { ...task(), repeat: 'weekly' as const }
    expect(occursOn(t, '2026-11-09')).toBe(true)
    expect(occursOn(t, '2026-11-10')).toBe(false)
  })
  it('31 日的每月重复在短月落到月末', () => {
    const t = {
      ...task(),
      startDate: '2026-01-31',
      dueDate: '2026-01-31',
      repeat: 'monthly' as const,
    }
    expect(occursOn(t, '2026-02-28')).toBe(true)
    expect(occursOn(t, '2026-03-31')).toBe(true)
    expect(occursOn(t, '2026-03-28')).toBe(false)
  })
  it('闰日的每年重复在非闰年落到 2 月末', () => {
    const t = { ...task(), startDate: '2024-02-29', repeat: 'yearly' as const }
    expect(occursOn(t, '2025-02-28')).toBe(true)
    expect(occursOn(t, '2028-02-29')).toBe(true)
  })
  it('自定义星期与重复截止日期', () => {
    const t = {
      ...task(),
      repeat: 'custom' as const,
      repeatDays: [1, 3],
      repeatUntil: '2026-11-11',
    }
    expect(occursOn(t, '2026-11-11')).toBe(true)
    expect(occursOn(t, '2026-11-12')).toBe(false)
    expect(occursOn(t, '2026-11-16')).toBe(false)
  })
})
describe('独立完成与检查事项', () => {
  it('普通事项可完成并恢复', () => {
    const t = toggleComplete(task(), '2026-11-02')
    expect(isCompleted(t, '2026-11-02')).toBe(true)
    expect(isCompleted(toggleComplete(t, '2026-11-02'), '2026-11-02')).toBe(false)
  })
  it('今天完成重复事项不会完成明天', () => {
    const t = toggleComplete({ ...task(), repeat: 'daily' }, '2026-11-02')
    expect(isCompleted(t, '2026-11-02')).toBe(true)
    expect(isCompleted(t, '2026-11-03')).toBe(false)
  })
  it('全部子任务勾选才完成，取消勾选会重新打开', () => {
    const t = {
      ...task(),
      checklist: [
        { id: 'a', title: '第一步' },
        { id: 'b', title: '第二步' },
      ],
    }
    const one = toggleCheck(t, 'a', '2026-11-02')
    expect(one.completed).toBe(false)
    const both = toggleCheck(one, 'b', '2026-11-02')
    expect(both.completed).toBe(true)
    expect(toggleCheck(both, 'a', '2026-11-02').completed).toBe(false)
  })
  it('重复事项的检查项按日期隔离', () => {
    const t = toggleCheck(
      { ...task(), repeat: 'daily', checklist: [{ id: 'a', title: '第一步' }] },
      'a',
      '2026-11-02',
    )
    expect(checksFor(t, '2026-11-02')).toEqual(['a'])
    expect(checksFor(t, '2026-11-03')).toEqual([])
  })
})
describe('进度事项的计划比较', () => {
  const progress = () => ({
    ...task(),
    kind: 'progress' as const,
    startDate: '2026-11-02',
    dueDate: '2026-11-06',
    total: 20,
    entries: [{ id: 'entry', date: '2026-11-02', amount: 3 }],
  })
  it('20 章分 5 天，首日读 3 章应落后 1 章', () => {
    const info = progressInfo(progress(), '2026-11-02')
    expect(info.days).toBe(5)
    expect(info.daily).toBe(4)
    expect(info.expected).toBe(4)
    expect(info.delta).toBe(-1)
  })
  it('第二天应累计 8 章', () => expect(progressInfo(progress(), '2026-11-03').expected).toBe(8))
  it('开始前计划为 0，结束后目标封顶', () => {
    expect(progressInfo(progress(), '2026-11-01').expected).toBe(0)
    expect(progressInfo(progress(), '2026-11-10').expected).toBe(20)
  })
  it('历史日进度不包含未来记录', () => {
    const t = {
      ...progress(),
      entries: [...progress().entries, { id: 'next', date: '2026-11-03', amount: 4 }],
    }
    expect(progressValue(t, '2026-11-02')).toBe(3)
    expect(progressValue(t)).toBe(7)
  })
  it('目标达成后自动完成，删除记录后重新打开', () => {
    const t = { ...progress(), entries: [{ id: 'all', date: '2026-11-02', amount: 20 }] }
    expect(isCompleted(t, '2026-11-02')).toBe(true)
    expect(isCompleted({ ...t, entries: [] }, '2026-11-02')).toBe(false)
  })
  it('单日进度任务不除零', () => {
    const info = progressInfo({ ...progress(), dueDate: '2026-11-02' }, '2026-11-02')
    expect(info.daily).toBe(20)
    expect(info.expected).toBe(20)
  })
})
describe('备份验证', () => {
  it('示例数据可以往返 JSON', () =>
    expect(validateData(JSON.parse(JSON.stringify(createSeed())))).toBe(true))
  it('拒绝断开的清单关联', () => {
    const d = createSeed()
    d.tasks[0].listId = 'missing'
    expect(validateData(d)).toBe(false)
  })
  it('拒绝重复 ID 和缺失的字段', () => {
    const d = createSeed()
    d.tasks.push(d.tasks[0])
    expect(validateData(d)).toBe(false)
    expect(validateData({ version: 1, tasks: [] })).toBe(false)
  })
  it('拒绝坏日期和非对象的元素而不抛错', () => {
    const d = createSeed()
    d.tasks[0].dueDate = '2026-02-31'
    expect(validateData(d)).toBe(false)
    expect(validateData({ ...createSeed(), lists: [null] })).toBe(false)
  })
})
