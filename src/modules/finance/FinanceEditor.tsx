import { useState } from 'react'
import type { FinanceData, FinanceEntry } from '../../core/types'
import { dateKey } from '../../core/dates'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import {
  accountLabel,
  builtInCategory,
  INVESTMENT_CATEGORY,
  moneyInput,
  parseMoney,
  personalExpense,
  RECONCILIATION_CATEGORY,
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
  const legacy = Boolean(initial.split)
  const [amount, setAmount] = useState(
    initial.amount ? moneyInput(legacy ? personalExpense(initial) : initial.amount) : '',
  )
  const [error, setError] = useState('')
  const patch = (value: Partial<FinanceEntry>) => setEntry((e) => ({ ...e, ...value }))
  const categories = finance.categories.filter(
    (c) =>
      c.type === entry.type &&
      (c.id !== 'other-income' || initial.categoryId === c.id || c.name !== '其他收入'),
  )
  const adjustment = entry.type === 'income' && entry.categoryId === RECONCILIATION_CATEGORY
  function switchType(type: 'expense' | 'income') {
    if (type === entry.type) return
    setError('')
    patch({ type, categoryId: finance.categories.find((c) => c.type === type)?.id || '' })
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = legacy ? initial.amount : parseMoney(amount)
    if (!entry.date || entry.date > dateKey()) return setError('请选择今天或之前的记账日期。')
    if (parsed === null || parsed === 0 || (!adjustment && parsed < 0))
      return setError(
        adjustment
          ? '请填写非零对账差额，最多保留两位小数。'
          : '请填写大于 0 的金额，最多保留两位小数。',
      )
    const saved: FinanceEntry = {
      ...entry,
      title:
        entry.title.trim() || categories.find((c) => c.id === entry.categoryId)?.name || '收支记录',
      note: entry.note.trim(),
      amount: parsed,
    }
    if (!validateFinanceData({ ...finance, entries: [saved] }))
      return setError('请检查账户、分类和日期。历史账目的日期须早于或等于已到账的回款日期。')
    onSave(saved)
  }
  const categoryButtons = (items: typeof categories, label: string) => (
    <div className="finance-category-picker" role="group" aria-label={label}>
      {items.map((c) => (
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
  )
  const custom = categories.filter((c) => !builtInCategory(c))
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
            ] as const
          ).map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={entry.type === t.id}
              className={entry.type === t.id ? `active ${t.id}` : ''}
              disabled={legacy && t.id === 'income'}
              onClick={() => switchType(t.id)}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
        <label className="finance-amount-input">
          <span>{entry.type === 'income' ? '收入金额' : '支出金额'}</span>
          <div>
            <b>¥</b>
            <input
              aria-label="金额"
              inputMode={adjustment ? 'text' : 'decimal'}
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              readOnly={legacy}
              maxLength={16}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {legacy && <small className="finance-hint">历史账目保留原付款金额和已到账回款。</small>}
        </label>
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
                  {accountLabel(a)}
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
        <section>
          <span className="finance-field-label">分类</span>
          {categoryButtons(categories.filter(builtInCategory), '常用分类')}
          {custom.length > 0 && (
            <div className="finance-custom-categories">
              <span className="finance-field-label">其他已保存的分类</span>
              {categoryButtons(custom, '其他已保存的分类')}
            </div>
          )}
          {entry.categoryId === INVESTMENT_CATEGORY && (
            <p className="finance-hint">这笔款项会从流动资金扣除，投资明细可在资产模块记录。</p>
          )}
          {adjustment && (
            <p className="finance-hint">手动填写本次对账差额，正数计入收入，负数冲减收入。</p>
          )}
        </section>
        <label>
          账目名称
          <input
            aria-label="账目名称"
            maxLength={60}
            placeholder={adjustment ? '比如：本周货币基金收益' : '比如：午餐、这个月的工资'}
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
