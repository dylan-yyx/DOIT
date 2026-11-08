import { useEffect, useRef, useState } from 'react'
import type { AppData, FinanceData, FinanceEntry } from '../../core/types'
import {
  dateKey,
  friendlyDate,
  monthGrid,
  moveMonth,
  parseDate,
  shortDate,
  weekdays,
} from '../../core/dates'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import FinanceEditor from './FinanceEditor'
import { AccountManager, CategoryManager, ReimbursementEditor } from './FinanceManagers'
import {
  accountBalance,
  financeSummary,
  ledgerEvents,
  money,
  newFinanceEntry,
  pendingReimbursement,
  personalExpense,
  reimbursed,
  type LedgerEvent,
} from './logic'
import './finance.css'

type Filter = 'all' | 'expense' | 'income' | 'aa' | 'adjustment'
type Props = {
  data: AppData
  today: string
  status: 'saving' | 'saved' | 'error'
  saveError: string
  onChange: (fn: (data: AppData) => AppData) => void
  onSettings: () => void
  notify: (message: string, undo?: () => void) => void
}
export default function FinanceBoard({
  data,
  today,
  status,
  saveError,
  onChange,
  onSettings,
  notify,
}: Props) {
  const finance = data.finance!
  const [month, setMonth] = useState(today.slice(0, 7))
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline')
  const [filter, setFilter] = useState<Filter>('all')
  const [account, setAccount] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ entry: FinanceEntry; editing: boolean } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [manager, setManager] = useState<'accounts' | 'categories' | null>(null)
  const [receiptFor, setReceiptFor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    action: () => void
  } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const detail = finance.entries.find((e) => e.id === detailId)
  const receiptEntry = finance.entries.find((e) => e.id === receiptFor)
  function change(fn: (f: FinanceData) => FinanceData) {
    onChange((d) => ({ ...d, finance: fn(d.finance!) }))
  }
  function create(day = today) {
    const entry = newFinanceEntry(account === 'all' ? finance.accounts[0]?.id || '' : account, day)
    entry.categoryId = finance.categories.find((c) => c.type === 'expense')?.id || ''
    if (filter === 'income') {
      entry.type = 'income'
      entry.categoryId = finance.categories.find((c) => c.type === 'income')?.id || ''
    }
    if (filter === 'adjustment') {
      entry.type = 'adjustment'
      entry.categoryId = ''
    }
    if (filter === 'aa') entry.split = { people: 4, personalAmount: 0, reimbursements: [] }
    setEditor({ entry, editing: false })
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || document.querySelector('[role="dialog"]')) return
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        create()
      }
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  })
  const matchesKind = (e: FinanceEntry) =>
    filter === 'all' || (filter === 'aa' ? !!e.split : e.type === filter)
  const query = search.trim().toLocaleLowerCase()
  const matchesText = (e: FinanceEntry) =>
    [e.title, e.note, finance.categories.find((c) => c.id === e.categoryId)?.name || ''].some((s) =>
      s.toLocaleLowerCase().includes(query),
    )
  const matchesCategory = (e: FinanceEntry) => category === 'all' || e.categoryId === category
  const events = ledgerEvents(finance.entries).filter(
    (event) =>
      event.date.startsWith(month) &&
      (account === 'all' || event.accountId === account) &&
      matchesKind(event.entry) &&
      matchesCategory(event.entry) &&
      (matchesText(event.entry) || !!event.receipt?.note.toLocaleLowerCase().includes(query)) &&
      (!event.receipt || filter === 'all' || filter === 'aa'),
  )
  const entries = events.filter((e) => !e.receipt).map((e) => e.entry)
  const summary = financeSummary(entries)
  const outstanding = finance.entries.filter(
    (e) =>
      e.date <= today &&
      pendingReimbursement(e, today) > 0 &&
      (account === 'all' || e.accountId === account),
  )
  const pending = outstanding.reduce((s, e) => s + pendingReimbursement(e, today), 0)
  const balances = finance.accounts.map((a) => ({
    ...a,
    balance: accountBalance(finance, a.id, today),
  }))
  const totalBalance = balances.reduce((s, a) => s + a.balance, 0)
  const expenseCategories = finance.categories
    .map((c) => ({
      ...c,
      total: entries
        .filter((e) => e.categoryId === c.id)
        .reduce((s, e) => s + personalExpense(e), 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
  let degrees = 0
  const gradient = expenseCategories
    .map((c) => {
      const start = degrees
      degrees += (c.total / summary.expense) * 360
      return `${c.color} ${start}deg ${degrees}deg`
    })
    .join(',')
  const grouped = (items: LedgerEvent[]) => {
    const groups = new Map<string, LedgerEvent[]>()
    for (const event of items) groups.set(event.date, [...(groups.get(event.date) || []), event])
    return [...groups]
  }
  function saveEntry(entry: FinanceEntry) {
    change((f) => ({
      ...f,
      entries: f.entries.some((e) => e.id === entry.id)
        ? f.entries.map((e) => (e.id === entry.id ? entry : e))
        : [...f.entries, entry],
    }))
    setEditor(null)
    setMonth(entry.date.slice(0, 7))
    setSelectedDay(null)
    setSearch('')
    setFilter('all')
    setCategory('all')
    setAccount('all')
    notify('账目已保存')
  }
  function removeEntry(entry: FinanceEntry) {
    setDetailId(null)
    setConfirm({
      title: '删除这笔账目？',
      message: `“${entry.title}”将被删除${entry.split?.reimbursements.length ? '，关联的 AA 回款也会一并删除' : ''}，账户余额和统计会重新计算。`,
      action: () => {
        change((f) => ({ ...f, entries: f.entries.filter((e) => e.id !== entry.id) }))
        notify('账目已删除', () =>
          change((f) =>
            f.entries.some((e) => e.id === entry.id) ? f : { ...f, entries: [...f.entries, entry] },
          ),
        )
      },
    })
  }
  function navigate(step: number) {
    setMonth(moveMonth(`${month}-01`, step).slice(0, 7))
    setSelectedDay(null)
  }
  function selectDay(day: string) {
    setSelectedDay(day)
    setMonth(day.slice(0, 7))
  }
  function chooseFilter(next: Filter) {
    setFilter(next)
    setSelectedDay(null)
    setCategory('all')
  }
  function row(event: LedgerEvent) {
    const e = event.entry,
      c = finance.categories.find((c) => c.id === e.categoryId)
    const a = finance.accounts.find((a) => a.id === event.accountId)
    const kind = event.receipt ? 'receipt' : e.type
    return (
      <button
        className="finance-entry-row"
        key={event.id}
        aria-label={`查看账目 ${event.receipt ? 'AA 回款 · ' : ''}${e.title}`}
        onClick={() => setDetailId(e.id)}
      >
        <i
          className={`finance-entry-icon ${kind}`}
          style={
            kind === 'expense' && c ? { color: c.color, background: `${c.color}13` } : undefined
          }
        >
          <Icon
            name={
              event.receipt ? 'Users' : e.type === 'adjustment' ? 'RefreshCw' : c?.icon || 'Wallet'
            }
            size={19}
          />
        </i>
        <span className="finance-entry-text">
          <strong>
            {event.receipt ? `AA 回款 · ${e.title}` : e.title}
            {e.split && !event.receipt && <em>AA</em>}
          </strong>
          <small>
            {event.receipt ? '收回垫款' : e.type === 'adjustment' ? '对账调整' : c?.name} <b>·</b>{' '}
            {a?.name}
            {event.receipt?.note && ` · ${event.receipt.note}`}
            {!event.receipt && e.note && ` · ${e.note}`}
          </small>
        </span>
        <span className={`finance-entry-amount ${kind}`}>
          <strong>
            {event.receipt || e.type === 'income' || (e.type === 'adjustment' && e.amount > 0)
              ? '+'
              : '−'}
            {money(
              event.receipt?.amount ??
                (e.type === 'expense' ? personalExpense(e) : Math.abs(e.amount)),
            )}
          </strong>
          <small>
            {event.receipt
              ? '不计收入'
              : e.split
                ? `实付 ${money(e.amount)} · 待收 ${money(pendingReimbursement(e))}`
                : e.type === 'adjustment'
                  ? '不计日常收支'
                  : ''}
          </small>
        </span>
        <Icon name="ChevronRight" size={14} />
      </button>
    )
  }
  function timeline(items: LedgerEvent[]) {
    return (
      <div className="finance-timeline">
        {grouped(items).map(([day, list]) => {
          const s = financeSummary(list.filter((e) => !e.receipt).map((e) => e.entry))
          return (
            <section className="finance-day-group" key={day}>
              <div className="finance-day-heading">
                <i />
                <h3>
                  {shortDate(day)}
                  <span>
                    星期{weekdays[parseDate(day).getDay()]}
                    {day === today && ' · 今天'}
                  </span>
                </h3>
                <small>
                  {s.income > 0 && <span className="income">收入 {money(s.income)}</span>}
                  {s.expense > 0 && <span className="expense">支出 {money(s.expense)}</span>}
                </small>
              </div>
              <div className="finance-day-entries">{list.map(row)}</div>
            </section>
          )
        })}
      </div>
    )
  }
  const calendarDay = selectedDay || (today.startsWith(month) ? today : `${month}-01`)
  const displayedEvents = selectedDay ? events.filter((e) => e.date === selectedDay) : events
  return (
    <>
      <aside className="sidebar finance-sidebar">
        <div className="workspace-name">
          <div className="workspace-avatar">
            <Icon name="Leaf" size={17} />
          </div>
          <div>
            <strong>我的生活空间</strong>
            <span>每一笔，都有迹可循</span>
          </div>
        </div>
        <nav className="smart-nav" aria-label="账目筛选">
          {(
            [
              ['all', '全部账目', 'Layers'],
              ['expense', '日常支出', 'ArrowUpRight'],
              ['income', '日常收入', 'Plus'],
              ['aa', 'AA 均摊', 'Users'],
              ['adjustment', '对账调整', 'RefreshCw'],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              className={`side-row ${filter === id ? 'active' : ''}`}
              onClick={() => chooseFilter(id)}
            >
              <Icon name={icon} size={18} />
              <span>{label}</span>
              {id === 'aa' && outstanding.length > 0 && <small>{outstanding.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-scroll">
          <div className="sidebar-section-heading">
            <span>我的账户</span>
            <button
              className="icon-button"
              aria-label="管理账户"
              title="管理账户"
              onClick={() => setManager('accounts')}
            >
              <Icon name="Settings2" size={15} />
            </button>
          </div>
          <button
            className={`side-row finance-account-row ${account === 'all' ? 'active' : ''}`}
            onClick={() => {
              setAccount('all')
              setSelectedDay(null)
            }}
          >
            <Icon name="Wallet" size={17} />
            <span>全部账户</span>
          </button>
          {balances.map((a) => (
            <button
              className={`side-row finance-account-row ${account === a.id ? 'active' : ''}`}
              key={a.id}
              onClick={() => {
                setAccount(a.id)
                setSelectedDay(null)
              }}
            >
              <Icon name={a.icon} size={17} style={{ color: a.color }} />
              <span>
                {a.name}
                <small>¥{money(a.balance)}</small>
              </span>
            </button>
          ))}
          <button className="finance-add-account" onClick={() => setManager('accounts')}>
            <Icon name="Plus" size={14} />
            添加 / 管理账户
          </button>
          <div className="finance-account-total">
            <span>账户合计</span>
            <strong>¥{money(totalBalance)}</strong>
            <small>
              另有 AA 待收 ¥
              {money(
                finance.entries.reduce(
                  (s, e) => s + (e.date <= today ? pendingReimbursement(e, today) : 0),
                  0,
                ),
              )}
            </small>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="side-row" onClick={() => setManager('categories')}>
            <Icon name="Tag" size={17} />
            <span>分类管理</span>
          </button>
          <button className="side-row" onClick={onSettings}>
            <Icon name="Settings2" size={17} />
            <span>设置与数据</span>
          </button>
          <div className="local-indicator">
            <i />
            本地记账 · 安心记录
          </div>
        </div>
      </aside>
      <main className="finance-main">
        <div className="main-topline">
          <div className="breadcrumb">
            <Icon name="Wallet" size={14} />
            记账<span>/</span>生活账本
          </div>
          <div className="main-topline-right">
            <span className={`save-status ${status}`} title={saveError || '更改会自动保存到本机'}>
              <i />
              {status === 'saved'
                ? '已保存到本机'
                : status === 'saving'
                  ? '正在保存…'
                  : '保存失败，请备份'}
            </span>
            <div className="finance-search">
              <Icon name="Search" size={14} />
              <input
                ref={searchRef}
                aria-label="搜索账目"
                placeholder="搜索账目或备注"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedDay(null)
                }}
              />
              {search && (
                <button aria-label="清空账目搜索" onClick={() => setSearch('')}>
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="finance-scroll">
          <header className="finance-heading">
            <div>
              <div className="finance-eyebrow">LIFE, ONE ENTRY AT A TIME</div>
              <h1>
                生活账本 <Icon name="Sprout" size={24} />
              </h1>
              <p>记下生活的来往，让每一分花得明白。</p>
            </div>
            <button
              className="button primary"
              onClick={() => create()}
              disabled={!finance.accounts.length}
            >
              <Icon name="Plus" size={17} />
              记一笔<kbd>Ctrl N</kbd>
            </button>
          </header>
          <div className="finance-period-bar">
            <div className="finance-month-nav">
              <button
                className="icon-button"
                aria-label="上个月的账目"
                onClick={() => navigate(-1)}
              >
                <Icon name="ChevronLeft" size={17} />
              </button>
              <label>
                <span>
                  {month.slice(0, 4)} 年 {Number(month.slice(5))} 月
                </span>
                <input
                  aria-label="账目月份"
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) {
                      setMonth(e.target.value)
                      setSelectedDay(null)
                    }
                  }}
                />
              </label>
              <button className="icon-button" aria-label="下个月的账目" onClick={() => navigate(1)}>
                <Icon name="ChevronRight" size={17} />
              </button>
              <button
                className="finance-current-month"
                onClick={() => {
                  setMonth(today.slice(0, 7))
                  setSelectedDay(null)
                }}
              >
                本月
              </button>
            </div>
            <span className="finance-period-note">慢慢记录，心中有数</span>
          </div>
          <section className="finance-summary" aria-label="本月收支统计">
            <div data-testid="finance-expense">
              <span>
                <i className="expense-dot" />
                个人支出
              </span>
              <strong className="expense">
                <small>¥</small>
                {money(summary.expense)}
              </strong>
              <p>AA 只计我承担的部分</p>
            </div>
            <div data-testid="finance-income">
              <span>
                <i className="income-dot" />
                日常收入
              </span>
              <strong className="income">
                <small>¥</small>
                {money(summary.income)}
              </strong>
              <p>AA 回款不重复计入</p>
            </div>
            <div data-testid="finance-net">
              <span>
                <Icon name="ChartNoAxesCombined" size={13} />
                收支结余
              </span>
              <strong>
                <small>¥</small>
                {money(summary.income - summary.expense)}
              </strong>
              <p>
                另有对账调整 {summary.adjustment >= 0 ? '+' : '−'}
                {money(Math.abs(summary.adjustment))}
              </p>
            </div>
          </section>
          <div className="finance-content-grid">
            <div className="finance-ledger">
              <div className="finance-ledger-toolbar">
                <div className="finance-view-tabs" role="tablist" aria-label="记账视图">
                  {(
                    [
                      { id: 'timeline', label: '时间轴', icon: 'List' },
                      { id: 'calendar', label: '日历', icon: 'CalendarDays' },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.id}
                      role="tab"
                      aria-selected={view === v.id}
                      onClick={() => setView(v.id)}
                    >
                      <Icon name={v.icon} size={15} />
                      {v.label}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="按分类筛选"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setSelectedDay(null)
                  }}
                >
                  <option value="all">全部分类</option>
                  {finance.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type === 'expense' ? '支出' : '收入'} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="finance-ledger-caption">
                <span>
                  {filter !== 'all'
                    ? (
                        {
                          expense: '日常支出',
                          income: '日常收入',
                          aa: 'AA 均摊',
                          adjustment: '对账调整',
                        } as const
                      )[filter]
                    : '全部账目'}{' '}
                  · {events.length} 条记录
                  {account !== 'all'
                    ? ` · ${finance.accounts.find((a) => a.id === account)?.name}`
                    : ''}
                </span>
                {selectedDay && (
                  <button onClick={() => setSelectedDay(null)}>
                    {shortDate(selectedDay)}
                    <Icon name="X" size={12} />
                  </button>
                )}
              </div>
              {view === 'timeline' ? (
                displayedEvents.length ? (
                  timeline(displayedEvents)
                ) : (
                  <div className="finance-empty">
                    <i>
                      <Icon name="BookOpen" size={29} />
                    </i>
                    <h3>{finance.entries.length ? '这里还没有账目' : '从生活里的第一笔开始'}</h3>
                    <p>
                      {finance.entries.length
                        ? '试试切换月份或筛选条件，也可以再记一笔。'
                        : '一顿午餐、一笔工资，都是生活的小小足迹。'}
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => create(selectedDay || today)}
                    >
                      记一笔
                    </button>
                  </div>
                )
              ) : (
                <>
                  <div className="finance-calendar">
                    <div className="finance-calendar-week">
                      {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>
                    <div className="finance-calendar-grid">
                      {monthGrid(`${month}-01`).map((day) => {
                        const daily = events.filter((e) => e.date === day),
                          s = financeSummary(daily.filter((e) => !e.receipt).map((e) => e.entry))
                        const receipts = daily
                          .filter((e) => e.receipt)
                          .reduce((n, e) => n + e.receipt!.amount, 0)
                        return (
                          <button
                            key={day}
                            aria-label={`${day} ${daily.length}条账目`}
                            aria-pressed={day === calendarDay}
                            className={`${day.startsWith(month) ? '' : 'outside'} ${day === today ? 'today' : ''} ${day === calendarDay ? 'selected' : ''}`}
                            onClick={() => selectDay(day)}
                          >
                            <b>{Number(day.slice(-2))}</b>
                            {daily.length > 0 && (
                              <em className="finance-calendar-count">{daily.length}笔</em>
                            )}
                            {s.expense > 0 && <span className="expense">−{money(s.expense)}</span>}
                            {s.income > 0 && <span className="income">+{money(s.income)}</span>}
                            {receipts > 0 && (
                              <small className="receipt">回款 +{money(receipts)}</small>
                            )}
                            {s.adjustment !== 0 && (
                              <small className="adjustment">
                                调 {s.adjustment > 0 ? '+' : '−'}
                                {money(Math.abs(s.adjustment))}
                              </small>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="finance-calendar-day-title">
                    <h3>{friendlyDate(calendarDay, today)}的账目</h3>
                    <button disabled={calendarDay > today} onClick={() => create(calendarDay)}>
                      <Icon name="Plus" size={14} />
                      记到这一天
                    </button>
                  </div>
                  {events.some((e) => e.date === calendarDay) ? (
                    <div className="finance-calendar-entries">
                      {events.filter((e) => e.date === calendarDay).map(row)}
                    </div>
                  ) : (
                    <p className="finance-day-empty">这一天还没有记录，平淡也是生活。</p>
                  )}
                </>
              )}
              <p className="finance-ledger-foot">
                <Icon name="CircleHelp" size={13} />
                统计随当前月份与筛选变化；回款、对账调整单独展示。
              </p>
            </div>
            <aside className="finance-insights">
              <section className="finance-report">
                <div className="finance-section-title">
                  <h3>支出去向</h3>
                  <span>按个人承担</span>
                </div>
                <div
                  className={`finance-donut ${summary.expense ? '' : 'empty'}`}
                  style={{ background: gradient ? `conic-gradient(${gradient})` : undefined }}
                  role="img"
                  aria-label={`个人支出共 ${money(summary.expense)} 元`}
                >
                  <div>
                    <span>本月支出</span>
                    <strong>¥{money(summary.expense)}</strong>
                  </div>
                </div>
                {expenseCategories.length ? (
                  <div className="finance-breakdown">
                    {expenseCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCategory(c.id)
                          setSelectedDay(null)
                        }}
                      >
                        <i style={{ background: c.color }} />
                        <span>
                          {c.name}
                          <small>{Math.round((c.total / summary.expense) * 100)}%</small>
                        </span>
                        <strong>{money(c.total)}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="finance-report-empty">记录支出后，看看钱花在哪里。</p>
                )}
              </section>
              <section className="finance-aa-report">
                <div className="finance-section-title">
                  <h3>
                    <Icon name="Users" size={16} />
                    AA 待收
                  </h3>
                  <span>全部日期</span>
                </div>
                <strong className="finance-pending" data-testid="finance-pending">
                  ¥{money(pending)}
                </strong>
                <p>已垫付、尚未收回的部分</p>
                {outstanding.slice(0, 3).map((e) => (
                  <button
                    className="finance-outstanding"
                    key={e.id}
                    onClick={() => setDetailId(e.id)}
                  >
                    <span>
                      {e.title}
                      <small>
                        {shortDate(e.date)} · {e.split!.people} 人均摊
                      </small>
                    </span>
                    <strong>
                      {money(pendingReimbursement(e, today))}
                      <Icon name="ChevronRight" size={12} />
                    </strong>
                  </button>
                ))}
                {outstanding.length === 0 && (
                  <div className="finance-aa-clear">
                    <Icon name="CheckCircle2" size={17} />
                    没有待收垫款，轻轻松松。
                  </div>
                )}
              </section>
              <div className="finance-quiet-note">
                <Icon name="Leaf" size={19} />
                <p>
                  把钱花在喜欢的事上，
                  <br />
                  也为明天留一点余地。
                </p>
                <span>A LITTLE RECORD, A CLEARER LIFE</span>
              </div>
            </aside>
          </div>
        </div>
      </main>
      {editor && (
        <FinanceEditor
          initial={editor.entry}
          editing={editor.editing}
          finance={finance}
          onSave={saveEntry}
          onClose={() => setEditor(null)}
        />
      )}
      {manager === 'accounts' && (
        <AccountManager
          finance={finance}
          onClose={() => setManager(null)}
          onSave={(account) => {
            change((f) => ({
              ...f,
              accounts: f.accounts.some((a) => a.id === account.id)
                ? f.accounts.map((a) => (a.id === account.id ? account : a))
                : [...f.accounts, account],
            }))
            notify('账户已保存')
          }}
        />
      )}
      {manager === 'categories' && (
        <CategoryManager
          finance={finance}
          onClose={() => setManager(null)}
          onSave={(category) => {
            change((f) => ({
              ...f,
              categories: f.categories.some((c) => c.id === category.id)
                ? f.categories.map((c) => (c.id === category.id ? category : c))
                : [...f.categories, category],
            }))
            notify('分类已保存')
          }}
        />
      )}
      {receiptEntry && (
        <ReimbursementEditor
          entry={receiptEntry}
          finance={finance}
          onClose={() => setReceiptFor(null)}
          onSave={(receipt) => {
            change((f) => ({
              ...f,
              entries: f.entries.map((e) =>
                e.id === receiptEntry.id && e.split && receipt.amount <= pendingReimbursement(e)
                  ? {
                      ...e,
                      split: { ...e.split, reimbursements: [...e.split.reimbursements, receipt] },
                    }
                  : e,
              ),
            }))
            setReceiptFor(null)
            notify('AA 回款已保存，不计入收入')
          }}
        />
      )}
      {detail && (
        <Modal title="账目详情" onClose={() => setDetailId(null)}>
          <div className="finance-detail">
            <div className={`finance-detail-amount ${detail.type}`}>
              <span>
                {detail.type === 'income'
                  ? '收入'
                  : detail.type === 'adjustment'
                    ? '对账调整'
                    : detail.split
                      ? '个人承担'
                      : '支出'}
              </span>
              <strong>
                ¥{money(detail.type === 'expense' ? personalExpense(detail) : detail.amount)}
              </strong>
              <h3>{detail.title}</h3>
            </div>
            <dl>
              <div>
                <dt>记账日期</dt>
                <dd>{detail.date}</dd>
              </div>
              <div>
                <dt>使用账户</dt>
                <dd>{finance.accounts.find((a) => a.id === detail.accountId)?.name}</dd>
              </div>
              <div>
                <dt>分类</dt>
                <dd>
                  {detail.type === 'adjustment'
                    ? '对账调整 · 不计日常收支'
                    : finance.categories.find((c) => c.id === detail.categoryId)?.name}
                </dd>
              </div>
              {detail.note && (
                <div>
                  <dt>备注</dt>
                  <dd className="finance-detail-note">{detail.note}</dd>
                </div>
              )}
            </dl>
            {detail.split && (
              <section className="finance-detail-aa">
                <div className="finance-section-title">
                  <h3>
                    <Icon name="Users" size={16} />
                    AA 均摊 · {detail.split.people} 人
                  </h3>
                </div>
                <div className="finance-detail-aa-grid">
                  <span>
                    实际代付<strong>¥{money(detail.amount)}</strong>
                  </span>
                  <span>
                    我的承担<strong>¥{money(detail.split.personalAmount)}</strong>
                  </span>
                  <span>
                    已收回<strong>¥{money(reimbursed(detail))}</strong>
                  </span>
                  <span>
                    还待收<strong>¥{money(pendingReimbursement(detail))}</strong>
                  </span>
                </div>
                <p className="finance-hint">付款账户按实付金额扣除，消费统计只记我的承担。</p>
                {detail.split.reimbursements.map((r) => (
                  <div className="finance-receipt-row" key={r.id}>
                    <span>
                      {r.date}
                      <small>
                        {finance.accounts.find((a) => a.id === r.accountId)?.name}
                        {r.note && ` · ${r.note}`}
                      </small>
                    </span>
                    <strong>+{money(r.amount)}</strong>
                    <button
                      className="icon-button"
                      aria-label={`删除回款 ${r.id}`}
                      onClick={() => {
                        setDetailId(null)
                        setConfirm({
                          title: '删除这笔回款？',
                          message: '账户余额将扣回此笔回款，AA 待收金额会相应恢复。',
                          action: () => {
                            change((f) => ({
                              ...f,
                              entries: f.entries.map((e) =>
                                e.id === detail.id && e.split
                                  ? {
                                      ...e,
                                      split: {
                                        ...e.split,
                                        reimbursements: e.split.reimbursements.filter(
                                          (receipt) => receipt.id !== r.id,
                                        ),
                                      },
                                    }
                                  : e,
                              ),
                            }))
                            notify('回款已删除')
                          },
                        })
                      }}
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                ))}
                {pendingReimbursement(detail) > 0 && (
                  <button
                    className="button primary full"
                    onClick={() => {
                      setDetailId(null)
                      setReceiptFor(detail.id)
                    }}
                  >
                    <Icon name="Plus" size={15} />记 AA 回款
                  </button>
                )}
              </section>
            )}
          </div>
          <div className="modal-footer">
            <button className="button finance-delete" onClick={() => removeEntry(detail)}>
              <Icon name="Trash2" size={14} />
              删除账目
            </button>
            <span className="spacer" />
            <button className="button secondary" onClick={() => setDetailId(null)}>
              关闭
            </button>
            <button
              className="button primary"
              onClick={() => {
                setDetailId(null)
                setEditor({ entry: detail, editing: true })
              }}
            >
              <Icon name="Pencil" size={14} />
              编辑账目
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="finance-confirm-message">{confirm.message}</p>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              取消
            </button>
            <button
              className="button danger-button"
              onClick={() => {
                confirm.action()
                setConfirm(null)
              }}
            >
              确认删除
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
