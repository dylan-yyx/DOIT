import type { AppData, Task } from './types'
import { addDays, dateKey } from './dates'
import { newTask } from '../modules/tasks/logic'
import { createHabitSeed } from '../modules/habits/logic'
import { createFinanceData } from '../modules/finance/logic'
import { createAssetsData } from '../modules/assets/logic'
export function createSeed(): AppData {
  const today = dateKey(),
    base = (id: string, title: string, listId: string, patch: Partial<Task> = {}): Task => ({
      ...newTask(listId, today),
      id,
      title,
      ...patch,
    })
  return {
    version: 1,
    ...createHabitSeed(today),
    finance: createFinanceData(),
    assets: createAssetsData(),
    preferences: { name: '', weekStartsOn: 1, showCompleted: true },
    folders: [
      { id: 'personal', name: '个人成长', icon: 'Sprout', color: '#738967' },
      { id: 'work', name: '工作与生活', icon: 'Folder', color: '#788da3' },
    ],
    lists: [
      { id: 'inbox', name: '收集箱', icon: 'Inbox', color: '#7d8a89' },
      {
        id: 'reading',
        name: '阅读与学习',
        icon: 'BookOpen',
        color: '#937caf',
        folderId: 'personal',
      },
      { id: 'health', name: '健康生活', icon: 'Heart', color: '#c68570', folderId: 'personal' },
      {
        id: 'projects',
        name: '工作计划',
        icon: 'BriefcaseBusiness',
        color: '#6b8ca9',
        folderId: 'work',
      },
      { id: 'life', name: '生活琐事', icon: 'Coffee', color: '#c3a05d', folderId: 'work' },
    ],
    tags: [
      { id: 'focus', name: '深度专注', color: '#9778b5' },
      { id: 'self', name: '自我提升', color: '#548f76' },
      { id: 'relax', name: '慢慢生活', color: '#b48c52' },
    ],
    tasks: [
      base('read', '读完《掌控习惯》', 'reading', {
        kind: 'progress',
        startDate: addDays(today, -1),
        dueDate: addDays(today, 3),
        total: 20,
        unit: '章',
        tagIds: ['self', 'focus'],
        notes:
          '每天留一点时间阅读，让改变从微小的行动开始。\n\n阅读时记下一个对自己有启发的观点，试着把它用在生活里。',
        entries: [
          {
            id: 'read-entry-1',
            date: addDays(today, -1),
            amount: 3,
            note: '读完前 3 章，记下关于微习惯的思考。',
          },
        ],
      }),
      base('weekly-review', '整理本周工作，准备周复盘', 'projects', {
        timeMode: 'range',
        startTime: '10:00',
        endTime: '11:00',
        priority: 'high',
        tagIds: ['focus'],
        notes: '把本周的进展、遇到的问题和下周的重点整理清楚。',
        checklist: [
          { id: 'review-1', title: '回顾本周已完成的工作' },
          { id: 'review-2', title: '记录问题与改进方向' },
          { id: 'review-3', title: '确定下周的三件重要事项' },
        ],
      }),
      base('walk', '去公园走走，给自己充个电', 'health', {
        timeMode: 'range',
        startTime: '16:30',
        endTime: '17:00',
        repeat: 'weekends',
        tagIds: ['relax'],
        notes: '带上耳机，听一期喜欢的播客。',
      }),
      base('water', '记得喝水，也记得休息', 'health', { repeat: 'daily', tagIds: ['relax'] }),
      base('desk', '整理书桌和电脑文件', 'life', {
        timeMode: 'point',
        startTime: '20:00',
        checklist: [
          { id: 'desk-1', title: '整理桌面物品' },
          { id: 'desk-2', title: '归档下载文件' },
        ],
      }),
      base('done-demo', '给新的一天列个小计划', 'inbox', {
        completed: true,
        completedAt: new Date().toISOString(),
        occurrences: { once: { completed: true } },
      }),
      base('tomorrow', '采购下周的食材', 'life', {
        dueDate: addDays(today, 1),
        startDate: addDays(today, 1),
        tagIds: ['relax'],
      }),
      base('monday', '推进个人项目的第一版设计', 'projects', {
        dueDate: addDays(today, 2),
        startDate: addDays(today, 2),
        priority: 'medium',
        tagIds: ['focus'],
      }),
      base('someday', '找一个周末去看展', 'inbox', {
        dueDate: '',
        startDate: '',
        tagIds: ['relax'],
      }),
    ],
  }
}
