export type Repeat =
  'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type Priority = 'none' | 'low' | 'medium' | 'high'
export interface Folder {
  id: string
  name: string
  icon: string
  color: string
  collapsed?: boolean
}
export interface TaskList {
  id: string
  name: string
  icon: string
  color: string
  folderId?: string
}
export interface Tag {
  id: string
  name: string
  color: string
}
export interface ChecklistItem {
  id: string
  title: string
}
export interface ProgressEntry {
  id: string
  date: string
  amount: number
  note?: string
}
export interface OccurrenceState {
  completed?: boolean
  checks?: string[]
  completedAt?: string
}
export interface Task {
  id: string
  title: string
  listId: string
  tagIds: string[]
  notes: string
  kind: 'normal' | 'progress'
  startDate: string
  dueDate: string
  timeMode: 'allday' | 'point' | 'range'
  startTime: string
  endTime: string
  repeat: Repeat
  repeatDays: number[]
  repeatUntil: string
  priority: Priority
  checklist: ChecklistItem[]
  total: number
  unit: string
  entries: ProgressEntry[]
  occurrences: Record<string, OccurrenceState>
  completed: boolean
  completedAt?: string
  createdAt: string
}
export interface HabitGroup {
  id: string
  name: string
  color: string
}
export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  groupId: string
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom'
  days: number[]
  startDate: string
  goal: { type: 'check' | 'quantity'; target: number; unit: string }
  records: Record<string, { value: number; note?: string }>
  createdAt: string
  example?: boolean
}
export interface AppData {
  version: 1
  folders: Folder[]
  lists: TaskList[]
  tags: Tag[]
  tasks: Task[]
  habits?: Habit[]
  habitGroups?: HabitGroup[]
  finance?: FinanceData
  assets?: AssetsData
  preferences: {
    name: string
    weekStartsOn: 1
    showCompleted: boolean
    appearance?: Appearance
  }
}
export type ThemeId =
  'sage' | 'cloud' | 'sand' | 'blue' | 'rose' | 'lavender' | 'landscape' | 'custom'
export type FontId = 'system' | 'yahei' | 'song' | 'kai' | 'lxgw975'
export interface Appearance {
  theme: ThemeId
  font: FontId
  customImage?: { name: string; dataUrl: string }
}
export interface FinanceAccount {
  id: string
  name: string
  icon: string
  color: string
  openingBalance: number // 金额统一以分存储
}
export interface FinanceCategory {
  id: string
  name: string
  type: 'expense' | 'income'
  icon: string
  color: string
}
export interface Reimbursement {
  id: string
  date: string
  accountId: string
  amount: number
  note: string
}
export interface FinanceEntry {
  id: string
  type: 'expense' | 'income' | 'adjustment'
  title: string
  amount: number
  date: string
  accountId: string
  categoryId: string
  note: string
  createdAt: string
  split?: { people: number; personalAmount: number; reimbursements: Reimbursement[] }
}
export interface FinanceData {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  entries: FinanceEntry[]
}
export type AssetCategory = 'fund' | 'stock' | 'wealth' | 'bond' | 'gold' | 'other'
export interface AssetProduct {
  id: string
  name: string
  code: string
  category: AssetCategory
  platform: string
  mode: 'units' | 'amount'
  note: string
  createdAt: string
}
export type AssetRecordType =
  'opening' | 'buy' | 'sell' | 'dividend' | 'reinvest' | 'fee' | 'valuation'
export interface AssetRecord {
  id: string
  assetId: string
  type: AssetRecordType
  date: string
  amount: number // 金额以整数分保存；买卖金额不含手续费
  fee: number
  quantity: number // 数量和单位价格均以百万分之一保存
  price: number
  value: number // 按金额管理的期初、估值或赎回后的市值
  basis: number // 按金额管理的本次赎回对应成本
  note: string
  createdAt: string
}
export interface AssetsData {
  products: AssetProduct[]
  records: AssetRecord[]
}
export type Filter =
  | { kind: 'smart'; id: 'today' | 'upcoming' | 'all' | 'inbox' | 'completed' }
  | { kind: 'list' | 'tag'; id: string }
export type View = 'list' | 'week' | 'month'
export interface DesktopAPI {
  load: () => Promise<AppData | null>
  save: (data: AppData) => Promise<void>
  exportData: (data: AppData) => Promise<boolean>
  importData: () => Promise<unknown | null>
  dataPath: () => Promise<string>
  window: (action: 'minimize' | 'maximize' | 'close') => void
}
declare global {
  interface Window {
    desktop?: DesktopAPI
  }
}
