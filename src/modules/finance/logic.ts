import type { AppData, FinanceData, FinanceEntry, Reimbursement } from '../../core/types'
import { dateKey, parseDate } from '../../core/dates'

export const money = (cents: number) =>
  (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const moneyInput = (cents: number) => (cents / 100).toFixed(2)
export function parseMoney(value: string): number | null {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, decimal = ''] = value.trim().replace('-', '').split('.')
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 100_000_000_000
    ? value.trim().startsWith('-')
      ? -cents
      : cents
    : null
}
export function createFinanceData(): FinanceData {
  return {
    accounts: [
      { id: 'alipay', name: '支付宝', icon: 'Wallet', color: '#6b8ca9', openingBalance: 0 },
      { id: 'wechat', name: '微信', icon: 'Wallet', color: '#738967', openingBalance: 0 },
      { id: 'bank', name: '银行卡', icon: 'Landmark', color: '#937caf', openingBalance: 0 },
      { id: 'cash', name: '现金', icon: 'Wallet', color: '#c3a05d', openingBalance: 0 },
    ],
    categories: [
      ['food', '饮食', 'Coffee', '#c68570'],
      ['transport', '交通', 'Plane', '#6b8ca9'],
      ['shopping', '购物', 'Tag', '#937caf'],
      ['home', '居住', 'Home', '#c3a05d'],
      ['fun', '休闲娱乐', 'Music', '#738967'],
      ['health', '医疗健康', 'Heart', '#d16d72'],
      ['study', '学习成长', 'BookOpen', '#548f76'],
      ['other-expense', '其他支出', 'Layers', '#7d8a89'],
      ['salary', '工资', 'BriefcaseBusiness', '#237b65'],
      ['bonus', '奖金', 'Sparkles', '#c3a05d'],
      ['side-income', '兼职', 'Laptop', '#6b8ca9'],
      ['other-income', '其他收入', 'Plus', '#738967'],
    ].map(([id, name, icon, color], index) => ({
      id,
      name,
      icon,
      color,
      type: index < 8 ? 'expense' : 'income',
    })),
    entries: [],
  }
}
export const withFinanceData = (data: AppData): AppData =>
  data.finance ? data : { ...data, finance: createFinanceData() }
export function newFinanceEntry(accountId = 'alipay', date = dateKey()): FinanceEntry {
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    title: '',
    amount: 0,
    date,
    accountId,
    categoryId: 'food',
    note: '',
    createdAt: new Date().toISOString(),
  }
}
export const personalExpense = (entry: FinanceEntry) =>
  entry.type === 'expense' ? (entry.split?.personalAmount ?? entry.amount) : 0
export const reimbursed = (entry: FinanceEntry, through = '9999-12-31') =>
  entry.split?.reimbursements
    .filter((r) => r.date <= through)
    .reduce((sum, r) => sum + r.amount, 0) || 0
export const pendingReimbursement = (entry: FinanceEntry, through = '9999-12-31') =>
  entry.split ? entry.amount - entry.split.personalAmount - reimbursed(entry, through) : 0
export function accountBalance(
  finance: FinanceData,
  id: string,
  through = '9999-12-31',
  exclude = '',
) {
  let balance = finance.accounts.find((a) => a.id === id)?.openingBalance || 0
  for (const e of finance.entries) {
    if (e.id === exclude) continue
    if (e.date <= through && e.accountId === id)
      balance += e.type === 'expense' ? -e.amount : e.amount
    for (const r of e.split?.reimbursements || [])
      if (r.accountId === id && r.date <= through) balance += r.amount
  }
  return balance
}
export function financeSummary(entries: FinanceEntry[]) {
  return entries.reduce(
    (sum, e) => ({
      income: sum.income + (e.type === 'income' ? e.amount : 0),
      expense: sum.expense + personalExpense(e),
      adjustment: sum.adjustment + (e.type === 'adjustment' ? e.amount : 0),
    }),
    { income: 0, expense: 0, adjustment: 0 },
  )
}
export interface LedgerEvent {
  id: string
  date: string
  accountId: string
  entry: FinanceEntry
  receipt?: Reimbursement
}
export function ledgerEvents(entries: FinanceEntry[]): LedgerEvent[] {
  return entries
    .flatMap((entry) => [
      { id: entry.id, date: entry.date, accountId: entry.accountId, entry },
      ...(entry.split?.reimbursements || []).map((receipt) => ({
        id: receipt.id,
        date: receipt.date,
        accountId: receipt.accountId,
        entry,
        receipt,
      })),
    ])
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.entry.createdAt.localeCompare(a.entry.createdAt),
    )
}
export function validateFinanceData(value: unknown): boolean {
  if (value === undefined) return true // 兼容已有的 v1 待办、习惯备份
  try {
    if (!value || typeof value !== 'object') return false
    const f = value as FinanceData
    const str = (v: unknown): v is string => typeof v === 'string'
    const date = (v: unknown): v is string =>
      str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && dateKey(parseDate(v)) === v
    const cents = (v: unknown): v is number =>
      Number.isSafeInteger(v) && Math.abs(v as number) <= 100_000_000_000
    const entity = (v: { id: string; name: string; icon: string; color: string }) =>
      v &&
      str(v.id) &&
      !!v.id &&
      str(v.name) &&
      !!v.name.trim() &&
      str(v.icon) &&
      /^#[0-9a-f]{6}$/i.test(v.color)
    if (![f.accounts, f.categories, f.entries].every(Array.isArray)) return false
    if (
      [f.accounts, f.categories, f.entries].some(
        (items) => new Set(items.map((i) => i.id)).size !== items.length,
      )
    )
      return false
    if (!f.accounts.every((a) => entity(a) && cents(a.openingBalance))) return false
    if (!f.categories.every((c) => entity(c) && ['expense', 'income'].includes(c.type)))
      return false
    return f.entries.every((e) => {
      if (
        !e ||
        !str(e.id) ||
        !e.id ||
        !str(e.title) ||
        !e.title.trim() ||
        !str(e.note) ||
        !date(e.date) ||
        !str(e.createdAt) ||
        isNaN(Date.parse(e.createdAt)) ||
        !f.accounts.some((a) => a.id === e.accountId) ||
        !cents(e.amount)
      )
        return false
      if (e.type === 'adjustment')
        return e.amount !== 0 && e.categoryId === '' && e.split === undefined
      if (
        !['expense', 'income'].includes(e.type) ||
        e.amount <= 0 ||
        !f.categories.some((c) => c.id === e.categoryId && c.type === e.type)
      )
        return false
      if (e.split === undefined) return true
      const s = e.split
      if (
        e.type !== 'expense' ||
        !s ||
        !Number.isInteger(s.people) ||
        s.people < 2 ||
        s.people > 100 ||
        !cents(s.personalAmount) ||
        s.personalAmount < 0 ||
        s.personalAmount > e.amount ||
        !Array.isArray(s.reimbursements) ||
        new Set(s.reimbursements.map((r) => r.id)).size !== s.reimbursements.length
      )
        return false
      return (
        s.reimbursements.every(
          (r) =>
            r &&
            str(r.id) &&
            !!r.id &&
            date(r.date) &&
            r.date >= e.date &&
            f.accounts.some((a) => a.id === r.accountId) &&
            cents(r.amount) &&
            r.amount > 0 &&
            str(r.note),
        ) && reimbursed(e) <= e.amount - s.personalAmount
      )
    })
  } catch {
    return false
  }
}
