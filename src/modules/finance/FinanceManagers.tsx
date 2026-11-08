import { useState } from 'react'
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceData,
  FinanceEntry,
  Reimbursement,
} from '../../core/types'
import { dateKey } from '../../core/dates'
import Modal from '../../components/Modal'
import Icon, { colors, editableIcons } from '../../components/Icon'
import { accountBalance, money, moneyInput, parseMoney, pendingReimbursement } from './logic'

export function AccountManager({
  finance,
  onSave,
  onClose,
}: {
  finance: FinanceData
  onSave: (account: FinanceAccount) => void
  onClose: () => void
}) {
  const fresh = (): FinanceAccount => ({
    id: crypto.randomUUID(),
    name: '',
    icon: 'Wallet',
    color: colors[0],
    openingBalance: 0,
  })
  const [account, setAccount] = useState<FinanceAccount>(fresh)
  const [opening, setOpening] = useState('0.00')
  const [error, setError] = useState('')
  const existing = finance.accounts.some((a) => a.id === account.id)
  function choose(a: FinanceAccount) {
    setAccount({ ...a })
    setOpening(moneyInput(a.openingBalance))
    setError('')
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const balance = parseMoney(opening)
    if (!account.name.trim() || balance === null)
      return setError('请填写账户名称和有效余额（最多两位小数）。')
    if (finance.accounts.some((a) => a.id !== account.id && a.name === account.name.trim()))
      return setError('已有同名账户，请换一个名称。')
    onSave({ ...account, name: account.name.trim(), openingBalance: balance })
    setAccount(fresh())
    setOpening('0.00')
    setError('')
  }
  return (
    <Modal title="账户管理" subtitle="余额 = 初始余额 + 实际流入 − 实际流出" onClose={onClose}>
      <div className="finance-manage-list">
        {finance.accounts.map((a) => (
          <button
            key={a.id}
            className={a.id === account.id ? 'active' : ''}
            onClick={() => choose(a)}
          >
            <i style={{ color: a.color, background: `${a.color}15` }}>
              <Icon name={a.icon} size={18} />
            </i>
            <span>
              {a.name}
              <small>初始 ¥{money(a.openingBalance)}</small>
            </span>
            <strong>¥{money(accountBalance(finance, a.id, dateKey()))}</strong>
            <Icon name="Pencil" size={13} />
          </button>
        ))}
      </div>
      <form className="finance-form finance-manage-form" onSubmit={submit}>
        <div className="finance-section-title">
          <h3>
            {existing
              ? `编辑 · ${finance.accounts.find((a) => a.id === account.id)?.name}`
              : '添加账户'}
          </h3>
          {existing && (
            <button
              type="button"
              onClick={() => {
                setAccount(fresh())
                setOpening('0.00')
                setError('')
              }}
            >
              ＋ 添加新账户
            </button>
          )}
        </div>
        <div className="finance-form-row">
          <label>
            账户名称
            <input
              aria-label="账户名称"
              required
              maxLength={20}
              placeholder="比如：招商储蓄卡"
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
            />
          </label>
          <label>
            初始余额（元）
            <input
              aria-label="初始余额（元）"
              inputMode="decimal"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
        </div>
        <p className="finance-hint">
          初始余额指开始记账前的余额。日后的零星变化请用“对账调整”记录。
        </p>
        <ColorPicker
          value={account.color}
          onChange={(color) => setAccount({ ...account, color })}
        />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            完成
          </button>
          <button className="button primary" type="submit">
            {existing ? '保存账户' : '添加账户'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function CategoryManager({
  finance,
  onSave,
  onClose,
}: {
  finance: FinanceData
  onSave: (category: FinanceCategory) => void
  onClose: () => void
}) {
  const fresh = (type: FinanceCategory['type'] = 'expense'): FinanceCategory => ({
    id: crypto.randomUUID(),
    name: '',
    type,
    icon: 'Tag',
    color: colors[0],
  })
  const [category, setCategory] = useState<FinanceCategory>(fresh)
  const [error, setError] = useState('')
  const existing = finance.categories.some((c) => c.id === category.id)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!category.name.trim()) return setError('请填写分类名称。')
    if (
      finance.categories.some(
        (c) => c.id !== category.id && c.type === category.type && c.name === category.name.trim(),
      )
    )
      return setError('已有同名分类。')
    onSave({ ...category, name: category.name.trim() })
    setCategory(fresh(category.type))
    setError('')
  }
  return (
    <Modal title="分类管理" subtitle="保留生活里的习惯，也可以添加自己的分类。" onClose={onClose}>
      <div className="finance-type-picker">
        {(['expense', 'income'] as const).map((type) => (
          <button
            key={type}
            className={category.type === type ? 'active' : ''}
            onClick={() => {
              setCategory(fresh(type))
              setError('')
            }}
          >
            {type === 'expense' ? '支出分类' : '收入分类'}
          </button>
        ))}
      </div>
      <div className="finance-category-picker finance-manage-categories">
        {finance.categories
          .filter((c) => c.type === category.type)
          .map((c) => (
            <button
              key={c.id}
              className={c.id === category.id ? 'active' : ''}
              onClick={() => {
                setCategory({ ...c })
                setError('')
              }}
            >
              <Icon name={c.icon} size={18} style={{ color: c.color }} />
              <span>{c.name}</span>
            </button>
          ))}
      </div>
      <form className="finance-form finance-manage-form" onSubmit={submit}>
        <div className="finance-section-title">
          <h3>{existing ? '编辑分类' : '添加分类'}</h3>
          {existing && (
            <button type="button" onClick={() => setCategory(fresh(category.type))}>
              ＋ 添加新分类
            </button>
          )}
        </div>
        <label>
          分类名称
          <input
            aria-label="分类名称"
            required
            maxLength={16}
            placeholder="比如：宠物、旅行"
            value={category.name}
            onChange={(e) => setCategory({ ...category, name: e.target.value })}
          />
        </label>
        <div className="finance-icon-picker">
          {editableIcons.map((icon) => (
            <button
              type="button"
              key={icon}
              aria-label={`分类图标 ${icon}`}
              className={category.icon === icon ? 'active' : ''}
              onClick={() => setCategory({ ...category, icon })}
            >
              <Icon name={icon} size={18} />
            </button>
          ))}
        </div>
        <ColorPicker
          value={category.color}
          onChange={(color) => setCategory({ ...category, color })}
        />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            完成
          </button>
          <button className="button primary" type="submit">
            {existing ? '保存分类' : '添加分类'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="finance-colors" aria-label="标记颜色">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          style={{ background: color }}
          aria-label={`颜色 ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        >
          {value === color && <Icon name="Check" size={13} />}
        </button>
      ))}
    </div>
  )
}
export function ReimbursementEditor({
  entry,
  finance,
  onSave,
  onClose,
}: {
  entry: FinanceEntry
  finance: FinanceData
  onSave: (r: Reimbursement) => void
  onClose: () => void
}) {
  const pending = pendingReimbursement(entry)
  const [amount, setAmount] = useState(moneyInput(pending))
  const [account, setAccount] = useState(entry.accountId)
  const [date, setDate] = useState(dateKey())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal
      title="记 AA 回款"
      subtitle={`${entry.title} · 还可收回 ¥${money(pending)}`}
      onClose={onClose}
    >
      <form
        className="finance-form"
        onSubmit={(e) => {
          e.preventDefault()
          const cents = parseMoney(amount)
          if (cents === null || cents <= 0 || cents > pending)
            return setError('回款金额应大于 0，且不能超过待收金额。')
          if (!date || date < entry.date || date > dateKey())
            return setError('回款日期应在付款日期和今天之间。')
          onSave({
            id: crypto.randomUUID(),
            amount: cents,
            accountId: account,
            date,
            note: note.trim(),
          })
        }}
      >
        <div className="finance-callout">
          <Icon name="Users" size={19} />
          <p>可分多次收回，也可收到其他账户。回款只增加账户余额，不计为收入。</p>
        </div>
        <label>
          回款金额（元）
          <input
            aria-label="回款金额（元）"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="finance-form-row">
          <label>
            收款账户
            <select
              aria-label="收款账户"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              {finance.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            回款日期
            <input
              aria-label="回款日期"
              type="date"
              required
              min={entry.date}
              max={dateKey()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <label>
          回款备注
          <input
            aria-label="回款备注"
            maxLength={120}
            placeholder="比如：小王还款"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            保存回款
          </button>
        </div>
      </form>
    </Modal>
  )
}
