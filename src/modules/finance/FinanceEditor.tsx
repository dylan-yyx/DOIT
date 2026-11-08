import { useEffect, useState } from 'react'
import type { FinanceData, FinanceEntry } from '../../core/types'
import { dateKey } from '../../core/dates'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import {
  accountBalance,
  money,
  moneyInput,
  parseMoney,
  reimbursed,
  validateFinanceData,
} from './logic'

export default function FinanceEditor({
  initial,
  finance,
  editing,
  onSave,
  onClose,
}: {
  initial: FinanceEntry
  finance: FinanceData
  editing: boolean
  onSave: (entry: FinanceEntry) => void
  onClose: () => void
}) {
  const [entry, setEntry] = useState(initial)
  const [amount, setAmount] = useState(initial.amount ? moneyInput(Math.abs(initial.amount)) : '')
  const [aa, setAA] = useState(!!initial.split)
  const [people, setPeople] = useState(String(initial.split?.people || 4))
  const [own, setOwn] = useState(initial.split ? moneyInput(initial.split.personalAmount) : '')
  const [customOwn, setCustomOwn] = useState(editing && !!initial.split)
  const [actual, setActual] = useState('')
  const [error, setError] = useState('')
  const patch = (value: Partial<FinanceEntry>) => setEntry((e) => ({ ...e, ...value }))
  const total = parseMoney(amount) || 0
  const count = Number(people)
  const personal = customOwn ? parseMoney(own) : count >= 2 ? Math.floor(total / count) : 0
  const baseline = accountBalance(finance, entry.accountId, entry.date, editing ? entry.id : '')
  const difference = (parseMoney(actual) ?? baseline) - baseline
  useEffect(() => {
    setActual(
      moneyInput(baseline + (editing && initial.type === 'adjustment' ? initial.amount : 0)),
    )
  }, [baseline, entry.accountId, entry.date, editing, initial])
  const categories = finance.categories.filter((c) => c.type === entry.type)
  const hasReceipts = !!initial.split?.reimbursements.length
  function switchType(type: FinanceEntry['type']) {
    if (hasReceipts && type !== 'expense') {
      setError('这笔 AA 已有回款。请先在详情中删除回款，再切换收支类型。')
      return
    }
    setError('')
    patch({
      type,
      categoryId:
        type === 'adjustment' ? '' : finance.categories.find((c) => c.type === type)?.id || '',
    })
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseMoney(amount)
    if (!entry.date || entry.date > dateKey()) return setError('请选择今天或之前的记账日期。')
    if (
      entry.type === 'adjustment'
        ? parseMoney(actual) === null || difference === 0
        : parsed === null || parsed <= 0
    )
      return setError(
        entry.type === 'adjustment'
          ? '请填写有效的实际余额，且与账面余额不同。'
          : '请填写大于 0 的金额，最多保留两位小数。',
      )
    if (
      aa &&
      entry.type === 'expense' &&
      (!Number.isInteger(count) ||
        count < 2 ||
        count > 100 ||
        personal === null ||
        personal < 0 ||
        personal > total)
    )
      return setError('AA 人数需为 2～100；我的承担应在 0 和总金额之间。')
    if (hasReceipts && (!aa || (personal ?? 0) + reimbursed(initial) > total))
      return setError('已有回款不能超过应收金额；请先在详情中修改回款记录。')
    const saved: FinanceEntry = {
      ...entry,
      title:
        entry.title.trim() ||
        (entry.type === 'adjustment'
          ? '对账调整'
          : finance.categories.find((c) => c.id === entry.categoryId)?.name || '收支记录'),
      note: entry.note.trim(),
      amount: entry.type === 'adjustment' ? difference : parsed!,
      split:
        aa && entry.type === 'expense'
          ? {
              people: count,
              personalAmount: personal!,
              reimbursements: initial.split?.reimbursements || [],
            }
          : undefined,
    }
    if (!validateFinanceData({ ...finance, entries: [saved] }))
      return setError('请检查账户、分类、日期及 AA 回款是否完整。')
    onSave(saved)
  }
  return (
    <Modal
      title={editing ? '编辑账目' : '记一笔'}
      subtitle="把日常花销，记得清清楚楚。"
      onClose={onClose}
    >
      <form className="finance-form" onSubmit={submit}>
        <div className="finance-type-picker" aria-label="收支类型">
          {(
            [
              { id: 'expense', label: '支出', icon: 'ArrowUpRight' },
              { id: 'income', label: '收入', icon: 'Plus' },
              { id: 'adjustment', label: '对账调整', icon: 'RefreshCw' },
            ] as const
          ).map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={entry.type === t.id}
              className={entry.type === t.id ? `active ${t.id}` : ''}
              onClick={() => switchType(t.id)}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
        {entry.type !== 'adjustment' && (
          <label className="finance-amount-input">
            <span>
              {entry.type === 'income' ? '收入金额' : aa ? '我实际代付的总额' : '支出金额'}
            </span>
            <div>
              <b>¥</b>
              <input
                aria-label="金额"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                maxLength={16}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </label>
        )}
        <div className="finance-form-row">
          <label>
            使用账户
            <select
              aria-label="使用账户"
              value={entry.accountId}
              onChange={(e) => patch({ accountId: e.target.value })}
            >
              {finance.accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            记账日期
            <input
              aria-label="记账日期"
              type="date"
              required
              max={dateKey()}
              value={entry.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </label>
        </div>
        {entry.type === 'adjustment' ? (
          <div className="finance-adjust-config">
            <p>将收益、红包等零星变动合并对账。差额单独展示，不计入日常收支。</p>
            <div className="finance-adjust-baseline">
              <span>当日账面余额{editing ? '（不含本笔调整）' : ''}</span>
              <strong>¥{money(baseline)}</strong>
            </div>
            <label>
              当前实际余额
              <input
                aria-label="当前实际余额"
                inputMode="decimal"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </label>
            <div className="finance-adjust-baseline">
              <span>本次调整</span>
              <strong className="adjustment">
                {difference >= 0 ? '+' : '−'}¥{money(Math.abs(difference))}
              </strong>
            </div>
          </div>
        ) : (
          <section>
            <span className="finance-field-label">分类</span>
            <div className="finance-category-picker">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={entry.categoryId === c.id ? 'active' : ''}
                  aria-pressed={entry.categoryId === c.id}
                  onClick={() => patch({ categoryId: c.id })}
                >
                  <Icon name={c.icon} style={{ color: c.color }} size={18} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {entry.type === 'expense' && (
          <section className={`finance-aa-config ${aa ? 'enabled' : ''}`}>
            <label className="finance-aa-toggle">
              <span>
                <Icon name="Users" size={17} />
                <b>AA 均摊</b>
                <small>我先付，只统计自己承担的部分</small>
              </span>
              <input
                aria-label="AA 均摊"
                type="checkbox"
                checked={aa}
                onChange={(e) => setAA(e.target.checked)}
              />
            </label>
            {aa && (
              <>
                <div className="finance-form-row">
                  <label>
                    均摊人数（含我）
                    <input
                      aria-label="均摊人数（含我）"
                      type="number"
                      min="2"
                      max="100"
                      step="1"
                      value={people}
                      onChange={(e) => setPeople(e.target.value)}
                    />
                  </label>
                  <label>
                    我的承担（元）
                    <input
                      aria-label="我的承担（元）"
                      inputMode="decimal"
                      value={customOwn ? own : moneyInput(personal ?? 0)}
                      onChange={(e) => {
                        setCustomOwn(true)
                        setOwn(e.target.value)
                      }}
                    />
                  </label>
                </div>
                <div className="finance-aa-preview">
                  <span>
                    消费统计 <strong>¥{money(personal ?? 0)}</strong>
                  </span>
                  <span>
                    应收他人 <strong>¥{money(total - (personal ?? 0))}</strong>
                  </span>
                  <button type="button" onClick={() => setCustomOwn(false)}>
                    恢复均分
                  </button>
                </div>
                <p className="finance-hint">
                  账户按实际付款扣除；收回垫款后再记回款。不能整除的分币留在他人应还中，也可手动修改我的承担。
                </p>
              </>
            )}
          </section>
        )}
        <label>
          账目名称
          <input
            aria-label="账目名称"
            maxLength={60}
            placeholder={
              entry.type === 'adjustment'
                ? '比如：本周余额宝收益与红包'
                : '比如：午餐、这个月的工资'
            }
            value={entry.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label>
          备注
          <textarea
            aria-label="账目备注"
            rows={2}
            maxLength={500}
            placeholder="留下一点补充（选填）"
            value={entry.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            <Icon name="Check" size={15} />
            {editing ? '保存修改' : '保存账目'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
