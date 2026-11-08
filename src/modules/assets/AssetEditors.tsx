import { useState } from 'react'
import type { AssetProduct, AssetRecord, AssetRecordType, AssetsData } from '../../core/types'
import { dateKey } from '../../core/dates'
import Modal from '../../components/Modal'
import { money, moneyInput, parseMoney } from '../finance/logic'
import {
  assetCategories,
  assetState,
  newAssetRecord,
  orderedRecords,
  parsePrecision,
  precision,
  precisionInput,
  quoteValue,
  recordNames,
  replaceAssetRecord,
} from './logic'

type Close = { onClose: () => void }
const zero = (value: string) => (value.trim() ? parseMoney(value) : 0)
export function AssetProductEditor({
  initial,
  assets,
  onSave,
  onClose,
}: Close & {
  initial: AssetProduct
  assets: AssetsData
  onSave: (product: AssetProduct, opening?: AssetRecord) => string
}) {
  const editing = assets.products.some((p) => p.id === initial.id)
  const locked = assets.records.some((r) => r.assetId === initial.id)
  const [product, setProduct] = useState(initial)
  const [opening, setOpening] = useState(!editing)
  const [day, setDay] = useState(dateKey())
  const [cost, setCost] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const patch = (v: Partial<AssetProduct>) => setProduct((p) => ({ ...p, ...v }))
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const p = {
      ...product,
      name: product.name.trim(),
      code: product.code.trim(),
      platform: product.platform.trim(),
      note: product.note.trim(),
    }
    let record: AssetRecord | undefined
    if (!editing && opening) {
      if (!day || day > dateKey()) return setError('请选择今天或之前的期初日期。')
      const c = parseMoney(cost),
        q = parsePrecision(quantity),
        pr = parsePrecision(price),
        v = parseMoney(value)
      if (
        c === null ||
        c < 0 ||
        (p.mode === 'units' ? q === null || q <= 0 || pr === null : v === null || v < 0)
      )
        return setError(
          '请填写有效的持仓成本、份额和价格，或当前市值。金额最多两位小数，份额和价格最多六位。',
        )
      record = {
        ...newAssetRecord(p.id, 'opening', day),
        amount: c,
        quantity: p.mode === 'units' ? q! : 0,
        price: p.mode === 'units' ? pr! : 0,
        value: p.mode === 'amount' ? v! : 0,
      }
    }
    const result = onSave(p, record)
    if (result) setError(result)
  }
  return (
    <Modal
      title={editing ? '编辑投资产品' : '新增投资'}
      subtitle="只记录投资持仓，日常流动资金不计入。"
      onClose={onClose}
    >
      <form className="asset-form" onSubmit={submit}>
        <div className="asset-form-grid">
          <label className="asset-span">
            产品名称
            <input
              aria-label="产品名称"
              required
              maxLength={120}
              value={product.name}
              placeholder="如：中证1000指数基金"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <label>
            投资类型
            <select
              aria-label="投资类型"
              value={product.category}
              onChange={(e) => {
                const category = e.target.value as AssetProduct['category']
                patch({
                  category,
                  ...(!locked
                    ? {
                        mode: ['fund', 'stock', 'gold'].includes(category)
                          ? ('units' as const)
                          : ('amount' as const),
                      }
                    : {}),
                })
              }}
            >
              {Object.entries(assetCategories).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            持有平台
            <input
              aria-label="持有平台"
              required
              maxLength={80}
              value={product.platform}
              placeholder="如：支付宝、证券账户"
              onChange={(e) => patch({ platform: e.target.value })}
              list="asset-platforms"
            />
            <datalist id="asset-platforms">
              {[...new Set(assets.products.map((p) => p.platform))].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            产品代码（选填）
            <input
              maxLength={40}
              value={product.code}
              onChange={(e) => patch({ code: e.target.value })}
            />
          </label>
          <label>
            记录方式
            <select
              aria-label="记录方式"
              value={product.mode}
              disabled={locked}
              onChange={(e) => patch({ mode: e.target.value as AssetProduct['mode'] })}
            >
              <option value="units">按份额和价格</option>
              <option value="amount">按金额</option>
            </select>
          </label>
        </div>
        {locked && <p className="asset-help">已有记录的产品保留原记录方式，避免影响历史核算。</p>}
        {!editing && (
          <>
            <label className="asset-checkbox">
              <input
                type="checkbox"
                checked={opening}
                onChange={(e) => setOpening(e.target.checked)}
              />
              录入已有持仓
            </label>
            {opening ? (
              <div className="asset-opening-fields">
                <p className="asset-help">
                  填写截至期初日期的持仓成本和估值；此前已卖出收益与已领取分红不会自动追溯。
                </p>
                <div className="asset-form-grid">
                  <label>
                    期初日期
                    <input
                      type="date"
                      aria-label="期初日期"
                      required
                      max={dateKey()}
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                    />
                  </label>
                  <label>
                    持仓成本（元）
                    <input
                      aria-label="持仓成本（元）"
                      inputMode="decimal"
                      required
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="包含历史交易费用"
                    />
                  </label>
                  {product.mode === 'units' ? (
                    <>
                      <label>
                        持有份额 / 数量
                        <input
                          aria-label="持有份额 / 数量"
                          inputMode="decimal"
                          required
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </label>
                      <label>
                        当前单位价格（元）
                        <input
                          aria-label="当前单位价格（元）"
                          inputMode="decimal"
                          required
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      当前市值（元）
                      <input
                        aria-label="当前市值（元）"
                        inputMode="decimal"
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <p className="asset-help">先建立产品，随后通过“记一笔投资”录入第一笔买入。</p>
            )}
          </>
        )}
        <label>
          产品备注
          <textarea
            maxLength={5000}
            rows={2}
            value={product.note}
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
            保存投资
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AssetRecordEditor({
  initial,
  assets,
  onSave,
  onClose,
}: Close & {
  initial: AssetRecord
  assets: AssetsData
  onSave: (record: AssetRecord) => string
}) {
  const editing = assets.records.some((r) => r.id === initial.id)
  const [assetId, setAssetId] = useState(initial.assetId)
  const [type, setType] = useState(initial.type)
  const [day, setDay] = useState(initial.date)
  const [amount, setAmount] = useState(editing || initial.amount ? moneyInput(initial.amount) : '')
  const [fee, setFee] = useState(moneyInput(initial.fee))
  const [quantity, setQuantity] = useState(initial.quantity ? precisionInput(initial.quantity) : '')
  const [price, setPrice] = useState(
    editing || initial.type === 'valuation' || initial.price ? precisionInput(initial.price) : '',
  )
  const [value, setValue] = useState(editing || initial.value ? moneyInput(initial.value) : '')
  const [basis, setBasis] = useState(editing || initial.basis ? moneyInput(initial.basis) : '')
  const [full, setFull] = useState(false)
  const [note, setNote] = useState(initial.note)
  const [error, setError] = useState('')
  const product = assets.products.find((p) => p.id === assetId)!
  const unit = product.mode === 'units'
  const candidate = { ...initial, assetId, type, date: day }
  const sequence = orderedRecords(
    replaceAssetRecord(assets, candidate).records.filter((r) => r.assetId === assetId),
  )
  const preceding = sequence.slice(
    0,
    sequence.findIndex((r) => r.id === initial.id),
  )
  let baseline = assetState(product, [])
  try {
    baseline = assetState(product, preceding)
  } catch {
    /* Full timeline is checked before saving. */
  }
  const q = full && type === 'sell' && unit ? baseline.quantity : parsePrecision(quantity)
  const pr = parsePrecision(price)
  const parsedFee = zero(fee)
  const trade = type === 'buy' || type === 'sell' || type === 'reinvest'
  let gross: number | null = parseMoney(amount)
  try {
    if (trade && unit) gross = q !== null && pr !== null ? quoteValue(q, pr) : null
  } catch {
    gross = null
  }
  const choices = (Object.keys(recordNames) as AssetRecordType[]).filter(
    (t) =>
      t !== 'opening' || !assets.records.some((r) => r.assetId === assetId && r.id !== initial.id),
  )
  function changeProduct(id: string) {
    setAssetId(id)
    setFull(false)
    setQuantity('')
    setPrice('')
    setValue('')
    setBasis('')
    setAmount('')
    if (type === 'opening' && assets.records.some((r) => r.assetId === id)) setType('buy')
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!day || day > dateKey()) return setError('请选择今天或之前的记录日期。')
    const r: AssetRecord = {
      ...candidate,
      amount: 0,
      fee: 0,
      quantity: 0,
      price: 0,
      value: 0,
      basis: 0,
      note: note.trim(),
    }
    if (type === 'opening' || trade || type === 'dividend' || type === 'fee') {
      if (gross === null || gross < 0)
        return setError('请填写有效金额或份额和单价。金额最多两位小数，份额和价格最多六位。')
      r.amount = gross
    }
    if (trade || type === 'dividend') {
      if (parsedFee === null || parsedFee < 0) return setError('手续费应为非负金额，最多两位小数。')
      r.fee = parsedFee
    }
    if (unit && (type === 'opening' || trade || type === 'valuation')) {
      if (pr === null || (type !== 'valuation' && (q === null || q <= 0)))
        return setError('请填写有效的份额和价格，最多六位小数。')
      r.price = pr
      if (type !== 'valuation') r.quantity = q!
    }
    if (!unit && (type === 'opening' || type === 'valuation' || type === 'sell')) {
      const v = full && type === 'sell' ? 0 : parseMoney(value)
      if (v === null || v < 0) return setError('请填写非负市值，最多两位小数。')
      r.value = v
      if (type === 'sell') {
        const b = full ? baseline.cost : parseMoney(basis)
        if (b === null || b < 0) return setError('请填写本次赎回对应的持仓成本。')
        r.basis = b
      }
    }
    const result = onSave(r)
    if (result) setError(result)
  }
  return (
    <Modal
      title={editing ? '编辑投资记录' : '记一笔投资'}
      subtitle="按实际发生日期记录；同一天按录入顺序核算。"
      onClose={onClose}
    >
      <form className="asset-form" onSubmit={submit}>
        <label>
          投资产品
          <select
            aria-label="投资产品"
            value={assetId}
            disabled={editing}
            onChange={(e) => changeProduct(e.target.value)}
          >
            {assets.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.platform}
              </option>
            ))}
          </select>
        </label>
        <div className="asset-record-types">
          {choices.map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? 'active' : ''}
              aria-pressed={type === t}
              onClick={() => {
                setType(t)
                setFull(false)
                setError('')
              }}
            >
              {recordNames[t]}
            </button>
          ))}
        </div>
        <div className="asset-form-grid">
          <label>
            记录日期
            <input
              type="date"
              aria-label="记录日期"
              required
              max={dateKey()}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <div className="asset-baseline">
            <span>此记录之前的持仓</span>
            <strong>
              {unit ? `${precision(baseline.quantity)} 份` : `成本 ¥${money(baseline.cost)}`}
            </strong>
          </div>
          {type === 'opening' && (
            <label>
              持仓成本（元）
              <input
                aria-label="持仓成本（元）"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          {type === 'sell' && (
            <label className="asset-checkbox asset-span">
              <input
                type="checkbox"
                aria-label="全部卖出"
                checked={full}
                onChange={(e) => setFull(e.target.checked)}
              />
              全部卖出 / 赎回
            </label>
          )}
          {unit && (trade || type === 'opening') && (
            <label>
              {type === 'sell' ? '卖出份额' : type === 'opening' ? '持有份额' : '买入份额'}
              <input
                aria-label="交易份额"
                inputMode="decimal"
                required
                disabled={full && type === 'sell'}
                value={full && type === 'sell' ? precisionInput(baseline.quantity) : quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
          )}
          {unit && (trade || type === 'opening' || type === 'valuation') && (
            <label>
              {type === 'valuation' || type === 'opening' ? '单位价格（元）' : '成交单价（元）'}
              <input
                aria-label="单位价格（元）"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          )}
          {((trade && !unit) || type === 'dividend' || type === 'fee') && (
            <label>
              {type === 'fee'
                ? '费用金额（元）'
                : type === 'dividend'
                  ? '分红金额（元）'
                  : type === 'sell'
                    ? '卖出金额（不含手续费）'
                    : '买入 / 再投金额（不含手续费）'}
              <input
                aria-label="交易金额（元）"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          {!unit && (type === 'opening' || type === 'sell' || type === 'valuation') && (
            <label>
              {type === 'sell' ? '赎回后剩余市值（元）' : '当前市值（元）'}
              <input
                aria-label="当前市值（元）"
                inputMode="decimal"
                required
                disabled={full && type === 'sell'}
                value={full && type === 'sell' ? '0.00' : value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
          )}
          {!unit && type === 'sell' && (
            <label>
              本次赎回对应成本（元）
              <input
                aria-label="本次赎回对应成本（元）"
                inputMode="decimal"
                required
                disabled={full}
                value={full ? moneyInput(baseline.cost) : basis}
                onChange={(e) => setBasis(e.target.value)}
              />
            </label>
          )}
          {(trade || type === 'dividend') && (
            <label>
              手续费（元）
              <input
                aria-label="手续费（元）"
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </label>
          )}
        </div>
        {trade && gross !== null && parsedFee !== null && (
          <div className="asset-trade-preview">
            <span>
              {type === 'sell'
                ? '卖出净到账'
                : type === 'reinvest'
                  ? '分红再投总额（含手续费）'
                  : '本次投入（含手续费）'}
            </span>
            <strong>¥{money(type === 'sell' ? gross - parsedFee : gross + parsedFee)}</strong>
          </div>
        )}
        {type === 'sell' && !unit && (
          <p className="asset-help">
            部分赎回请填写这部分对应的原持仓成本，以及平台显示的剩余市值；全额赎回可直接勾选“全部卖出”。
          </p>
        )}
        {type === 'reinvest' && (
          <p className="asset-help">
            再投总额计入分红收益，同时增加持仓成本；不会记为外部追加投入。
          </p>
        )}
        {type === 'valuation' && (
          <p className="asset-help">只更新估值，不改变投入、持仓成本或已实现收益。</p>
        )}
        {type === 'fee' && (
          <p className="asset-help">记录尚未包含在买卖或分红中的费用，避免重复扣除。</p>
        )}
        <label>
          记录备注
          <textarea
            maxLength={5000}
            rows={2}
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
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            保存记录
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AssetValuationEditor({
  assets,
  products,
  onSave,
  onClose,
}: Close & {
  assets: AssetsData
  products: AssetProduct[]
  onSave: (records: AssetRecord[]) => string
}) {
  const [day, setDay] = useState(dateKey())
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => {
        const s = assetState(p, assets.records)
        return [p.id, p.mode === 'units' ? precisionInput(s.price) : moneyInput(s.value)]
      }),
    ),
  )
  const [checked, setChecked] = useState<string[]>([])
  const [error, setError] = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!day || day > dateKey()) return setError('请选择今天或之前的估值日期。')
    const records: AssetRecord[] = []
    for (const p of products.filter((p) => checked.includes(p.id))) {
      const v = p.mode === 'units' ? parsePrecision(values[p.id]) : parseMoney(values[p.id])
      if (v === null || v < 0)
        return setError(
          `${p.name}：请填写有效的${p.mode === 'units' ? '单位价格（最多六位小数）' : '市值（最多两位小数）'}。`,
        )
      records.push({
        ...newAssetRecord(p.id, 'valuation', day),
        price: p.mode === 'units' ? v : 0,
        value: p.mode === 'amount' ? v : 0,
      })
    }
    if (!records.length) return setError('请勾选需要更新的投资产品。')
    const result = onSave(records)
    if (result) setError(result)
  }
  return (
    <Modal
      title="批量更新估值"
      subtitle="勾选要更新的产品，按平台显示的单位价格或市值填写。"
      wide
      onClose={onClose}
    >
      <form className="asset-form" onSubmit={submit}>
        <label>
          估值日期
          <input
            type="date"
            aria-label="估值日期"
            required
            max={dateKey()}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <div className="asset-valuation-list">
          {products.map((p) => (
            <div key={p.id} className="asset-valuation-row">
              <label className="asset-checkbox">
                <input
                  type="checkbox"
                  checked={checked.includes(p.id)}
                  onChange={(e) =>
                    setChecked((ids) =>
                      e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                    )
                  }
                />
                <span>
                  {p.name}
                  <small>
                    {p.platform} · {p.mode === 'units' ? '单位价格' : '总市值'}（元）
                  </small>
                </span>
              </label>
              <input
                aria-label={`${p.name}的${p.mode === 'units' ? '单位价格' : '市值'}`}
                inputMode="decimal"
                value={values[p.id]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [p.id]: e.target.value }))
                  setChecked((ids) => (ids.includes(p.id) ? ids : [...ids, p.id]))
                }}
              />
            </div>
          ))}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit" disabled={!checked.length}>
            保存 {checked.length} 项估值
          </button>
        </div>
      </form>
    </Modal>
  )
}
