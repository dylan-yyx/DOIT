import { describe, expect, it } from 'vitest'
import type { FinanceData, FinanceEntry } from '../../core/types'
import { createSeed } from '../../core/seed'
import { validateData } from '../tasks/logic'
import {
  accountBalance,
  createFinanceData,
  financeSummary,
  ledgerEvents,
  newFinanceEntry,
  parseMoney,
  pendingReimbursement,
  personalExpense,
  reimbursed,
  validateFinanceData,
  withFinanceData,
} from './logic'

function expense(patch: Partial<FinanceEntry> = {}): FinanceEntry {
  return { ...newFinanceEntry('alipay', '2026-11-08'), title: '四人聚餐', amount: 40000, ...patch }
}
function book(entries: FinanceEntry[] = []): FinanceData {
  const f = createFinanceData()
  f.accounts[0].openingBalance = 100000
  return { ...f, entries }
}
describe('金额与基础收支', () => {
  it.each([
    ['20', 2000],
    ['0.01', 1],
    ['0.29', 29],
    ['12.30', 1230],
    ['-0.01', -1],
    ['10000', 1000000],
    [' 10.25 ', 1025],
  ])('精确解析 %s 元为整数分', (text, cents) => expect(parseMoney(text)).toBe(cents))
  it.each(['', '1.001', '1e3', 'NaN', 'Infinity', '20元', '--1', '1,000', '1000000000.01'])(
    '拒绝无效金额 %s',
    (value) => expect(parseMoney(value)).toBeNull(),
  )
  it('午餐20元与工资10000元对应收支、余额及结余', () => {
    const entries = [
      expense({ amount: 2000, title: '午餐' }),
      expense({
        id: 'salary-1',
        title: '工资',
        type: 'income',
        categoryId: 'salary',
        amount: 1000000,
      }),
    ]
    expect(financeSummary(entries)).toEqual({ income: 1000000, expense: 2000, adjustment: 0 })
    expect(accountBalance(book(entries), 'alipay')).toBe(1098000)
    expect(validateFinanceData(book(entries))).toBe(true)
  })
  it('对账调整支持正负，不改变收入和消费', () => {
    const f = book([
      expense({ type: 'adjustment', categoryId: '', amount: 57 }),
      expense({ id: 'negative', type: 'adjustment', categoryId: '', amount: -12 }),
    ])
    expect(financeSummary(f.entries)).toEqual({ income: 0, expense: 0, adjustment: 45 })
    expect(accountBalance(f, 'alipay')).toBe(100045)
    expect(accountBalance(f, 'alipay', '2026-11-07')).toBe(100000)
    expect(accountBalance(f, 'alipay', '2026-11-08', f.entries[0].id)).toBe(99988)
  })
})
describe('AA 消费、现金与跨月回款', () => {
  const aa = () => expense({ split: { people: 4, personalAmount: 10000, reimbursements: [] } })
  it('代付400消费只计100；未收款时余额先扣400，产生应收300', () => {
    const e = aa()
    expect(personalExpense(e)).toBe(10000)
    expect(pendingReimbursement(e)).toBe(30000)
    expect(accountBalance(book([e]), 'alipay')).toBe(60000)
    expect(financeSummary([e]).expense).toBe(10000)
  })
  it('支持部分回款、跨账户收款；回款不增加收入', () => {
    const e = aa()
    e.split!.reimbursements.push({
      id: 'r1',
      accountId: 'wechat',
      date: e.date,
      amount: 10000,
      note: '小王',
    })
    const f = book([e])
    expect(reimbursed(e)).toBe(10000)
    expect(pendingReimbursement(e)).toBe(20000)
    expect(accountBalance(f, 'alipay')).toBe(60000)
    expect(accountBalance(f, 'wechat')).toBe(10000)
    expect(financeSummary([e])).toEqual({ expense: 10000, income: 0, adjustment: 0 })
  })
  it('回款全部收齐后，净现金支出与个人承担一致', () => {
    const e = aa()
    e.split!.reimbursements.push({
      id: 'r1',
      accountId: 'alipay',
      date: e.date,
      amount: 30000,
      note: '',
    })
    expect(pendingReimbursement(e)).toBe(0)
    expect(accountBalance(book([e]), 'alipay')).toBe(90000)
  })
  it('跨月回款按到账日展示，不在新月份重复计入收入和支出', () => {
    const e = aa()
    e.date = '2026-10-31'
    e.split!.reimbursements.push({
      id: 'nov-receipt',
      date: '2026-11-08',
      accountId: 'wechat',
      amount: 10000,
      note: '',
    })
    const events = ledgerEvents([e])
    expect(events.map((event) => event.date)).toEqual(['2026-11-08', '2026-10-31'])
    expect(
      financeSummary(
        events
          .filter((event) => event.date.startsWith('2026-11') && !event.receipt)
          .map((event) => event.entry),
      ),
    ).toEqual({ income: 0, expense: 0, adjustment: 0 })
    expect(accountBalance(book([e]), 'wechat', '2026-10-31')).toBe(0)
    expect(accountBalance(book([e]), 'wechat', '2026-11-08')).toBe(10000)
    expect(pendingReimbursement(e, '2026-10-31')).toBe(30000)
  })
})
describe('旧数据迁移与备份校验', () => {
  it('只初始化空账本，保留已有待办和习惯，重复迁移不新增数据', () => {
    const old = createSeed()
    delete old.finance
    expect(validateData(old)).toBe(true)
    const next = withFinanceData(old)
    expect(next.tasks).toBe(old.tasks)
    expect(next.habits).toBe(old.habits)
    expect(next.finance!.entries).toEqual([])
    expect(withFinanceData(next)).toBe(next)
    expect(validateData(next)).toBe(true)
  })
  it.each([
    { amount: 0 },
    { amount: -1 },
    { amount: 1.5 },
    { amount: Infinity },
    { accountId: 'missing' },
    { categoryId: 'salary' },
    { date: '2026-02-30' },
    { title: '' },
    { type: 'adjustment', categoryId: '', amount: 0 },
    { type: 'adjustment', categoryId: 'food', amount: 10 },
    { split: { people: 1, personalAmount: 10000, reimbursements: [] } },
    { split: { people: 4, personalAmount: 40001, reimbursements: [] } },
    { split: { people: 4, personalAmount: -1, reimbursements: [] } },
    {
      split: {
        people: 4,
        personalAmount: 10000,
        reimbursements: [
          { id: 'r', date: '2026-11-08', accountId: 'wechat', amount: 30001, note: '' },
        ],
      },
    },
    {
      split: {
        people: 4,
        personalAmount: 10000,
        reimbursements: [
          { id: 'r', date: '2026-11-07', accountId: 'wechat', amount: 100, note: '' },
        ],
      },
    },
  ])('拒绝非法账目 %j', (patch) =>
    expect(validateFinanceData(book([expense(patch as Partial<FinanceEntry>)]))).toBe(false),
  )
  it.each([
    null,
    {},
    { accounts: [], categories: [], entries: [null] },
    { accounts: [null], categories: [], entries: [] },
  ])('损坏的嵌套数据不会抛出异常 %j', (value) => expect(validateFinanceData(value)).toBe(false))
  it('拒绝重复账户和重复回款ID及悬空回款账户', () => {
    const f = book()
    f.accounts.push(f.accounts[0])
    expect(validateFinanceData(f)).toBe(false)
    const receipt = { id: 'r', date: '2026-11-08', accountId: 'wechat', amount: 100, note: '' }
    const e = expense({
      split: { people: 4, personalAmount: 10000, reimbursements: [receipt, receipt] },
    })
    expect(validateFinanceData(book([e]))).toBe(false)
    e.split!.reimbursements = [{ ...receipt, accountId: 'missing' }]
    expect(validateFinanceData(book([e]))).toBe(false)
  })
})
