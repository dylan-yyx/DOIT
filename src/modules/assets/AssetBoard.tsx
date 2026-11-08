import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppData,
  AssetCategory,
  AssetProduct,
  AssetRecord,
  AssetsData,
} from '../../core/types'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { money } from '../finance/logic'
import { AssetProductEditor, AssetRecordEditor, AssetValuationEditor } from './AssetEditors'
import {
  assetCategories,
  assetsError,
  assetState,
  newAsset,
  newAssetRecord,
  orderedRecords,
  precision,
  recordNames,
  replaceAssetRecord,
  type AssetState,
} from './logic'
import './assets.css'

type Props = {
  data: AppData
  today: string
  status: 'saving' | 'saved' | 'error'
  saveError: string
  onChange: (fn: (data: AppData) => AppData) => void
  onSettings: () => void
  notify: (message: string, undo?: () => void) => void
}
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`
const gainClass = (n: number) => (n > 0 ? 'asset-gain' : n < 0 ? 'asset-loss' : '')
type Position = { product: AssetProduct; state: AssetState }
export default function AssetBoard({
  data,
  today,
  status,
  saveError,
  onChange,
  onSettings,
  notify,
}: Props) {
  const assets = data.assets!
  const current = useRef(assets)
  current.current = assets
  const [view, setView] = useState<'overview' | 'positions' | 'history'>('overview')
  const [category, setCategory] = useState<AssetCategory | 'all'>('all')
  const [platform, setPlatform] = useState('all')
  const [search, setSearch] = useState('')
  const [holding, setHolding] = useState('active')
  const [historyType, setHistoryType] = useState('all')
  const [month, setMonth] = useState('')
  const [productEditor, setProductEditor] = useState<AssetProduct | null>(null)
  const [recordEditor, setRecordEditor] = useState<AssetRecord | null>(null)
  const [batch, setBatch] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    action: () => void
  } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const positions = useMemo(
    () =>
      assets.products.map((product) => ({ product, state: assetState(product, assets.records) })),
    [assets],
  )
  const filtered = positions.filter(
    ({ product: p }) =>
      (category === 'all' || p.category === category) &&
      (platform === 'all' || p.platform === platform) &&
      (!search.trim() ||
        [
          p.name,
          p.code,
          p.platform,
          p.note,
          ...assets.records.filter((r) => r.assetId === p.id).map((r) => r.note),
        ]
          .join('\n')
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())),
  )
  const active = filtered.filter((p) => p.state.active)
  const totals = filtered.reduce(
    (t, { state: s }) => ({
      value: t.value + s.value,
      cost: t.cost + s.cost,
      profit: t.profit + s.profit,
      unrealized: t.unrealized + s.unrealized,
      realized: t.realized + s.realized,
      dividends: t.dividends + s.cashDividends + s.reinvestedDividends,
    }),
    { value: 0, cost: 0, profit: 0, unrealized: 0, realized: 0, dividends: 0 },
  )
  const visiblePositions =
    view === 'overview'
      ? active
      : filtered.filter(
          (p) => holding === 'all' || (holding === 'active' ? p.state.active : !p.state.active),
        )
  const ids = new Set(filtered.map((p) => p.product.id))
  const records = orderedRecords(
    assets.records.filter(
      (r) =>
        ids.has(r.assetId) &&
        (historyType === 'all' || r.type === historyType) &&
        (!month || r.date.startsWith(month)),
    ),
  ).reverse()
  const detail = positions.find((p) => p.product.id === detailId)
  const platformNames = [...new Set(assets.products.map((p) => p.platform))]
  function commit(fn: (a: AssetsData) => AssetsData): string {
    const next = fn(current.current)
    const error = assetsError(next)
    if (error) return error
    current.current = next
    onChange((d) => ({ ...d, assets: next }))
    return ''
  }
  function saveProduct(p: AssetProduct, opening?: AssetRecord) {
    const error = commit((a) => ({
      products: a.products.some((x) => x.id === p.id)
        ? a.products.map((x) => (x.id === p.id ? p : x))
        : [...a.products, p],
      records: opening ? [...a.records, opening] : a.records,
    }))
    if (!error) {
      setProductEditor(null)
      notify('投资已保存')
    }
    return error
  }
  function saveRecord(record: AssetRecord) {
    if (record.date > today) return '记录日期不能晚于今天。'
    const error = commit((a) => replaceAssetRecord(a, record))
    if (!error) {
      setRecordEditor(null)
      notify('投资记录已保存')
    }
    return error
  }
  function createRecord(assetId?: string, type: AssetRecord['type'] = 'buy') {
    const p =
      assets.products.find((x) => x.id === assetId) || active[0]?.product || assets.products[0]
    if (!p) {
      setProductEditor(newAsset())
      return
    }
    const r = newAssetRecord(p.id, type, today)
    if (type === 'valuation') r.price = assetState(p, assets.records).price
    setRecordEditor(r)
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || document.querySelector('[role="dialog"]')) return
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setProductEditor(newAsset())
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  function deleteRecord(r: AssetRecord) {
    setConfirm({
      title: '删除这笔投资记录？',
      message: '删除后会重新计算该产品的全部持仓与收益。如果影响后续卖出，需先修改相关记录。',
      action: () => {
        const index = current.current.records.findIndex((x) => x.id === r.id)
        const error = commit((a) => ({ ...a, records: a.records.filter((x) => x.id !== r.id) }))
        if (error) {
          notify(`无法删除：${error}`)
          return
        }
        notify('投资记录已删除', () => {
          const error = commit((a) => {
            if (a.records.some((x) => x.id === r.id)) return a
            const records = [...a.records]
            records.splice(index, 0, r)
            return { ...a, records }
          })
          if (error) notify(`无法撤销：${error}`)
        })
      },
    })
  }
  function deleteProduct(p: AssetProduct) {
    setConfirm({
      title: `删除“${p.name}”？`,
      message: '将删除这个平台下的投资产品及其全部投资记录。若只是已卖出，请记录卖出并保留历史。',
      action: () => {
        const previous = current.current
        const removed = previous.records
          .map((r, index) => ({ r, index }))
          .filter((x) => x.r.assetId === p.id)
        const error = commit((a) => ({
          products: a.products.filter((x) => x.id !== p.id),
          records: a.records.filter((x) => x.assetId !== p.id),
        }))
        if (error) {
          notify(error)
          return
        }
        setDetailId(null)
        notify('投资产品及记录已删除', () => {
          const error = commit((a) => {
            if (a.products.some((x) => x.id === p.id)) return a
            const records = [...a.records]
            for (const { r, index } of removed)
              if (!records.some((x) => x.id === r.id)) records.splice(index, 0, r)
            const products = [...a.products]
            products.splice(
              previous.products.findIndex((x) => x.id === p.id),
              0,
              p,
            )
            return { products, records }
          })
          if (error) notify(`无法撤销：${error}`)
        })
      },
    })
  }
  function recordTable(list: AssetRecord[], showProduct = true) {
    return (
      <div className="asset-table-wrap">
        <table className="asset-table asset-record-table">
          <thead>
            <tr>
              <th>日期 / 类型</th>
              {showProduct && <th>投资产品</th>}
              <th>金额 / 估值</th>
              <th>备注</th>
              <th>
                <span className="asset-sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const p = assets.products.find((p) => p.id === r.assetId)!
              const value =
                r.type === 'valuation' || r.type === 'opening'
                  ? p.mode === 'units'
                    ? `单价 ${precision(r.price)}`
                    : `市值 ${money(r.value)}`
                  : money(r.amount)
              return (
                <tr key={r.id}>
                  <td>
                    <span>{r.date}</span>
                    <small>{recordNames[r.type]}</small>
                  </td>
                  {showProduct && (
                    <td>
                      <button className="asset-text-button" onClick={() => setDetailId(p.id)}>
                        {p.name}
                      </button>
                      <small>{p.platform}</small>
                    </td>
                  )}
                  <td className="asset-number">
                    {value}
                    <small>
                      {r.quantity > 0
                        ? `${precision(r.quantity)} 份`
                        : r.type === 'opening'
                          ? `成本 ${money(r.amount)}`
                          : ''}
                      {r.fee > 0 && ` · 手续费 ${money(r.fee)}`}
                    </small>
                  </td>
                  <td className="asset-record-note">{r.note || '—'}</td>
                  <td>
                    <div className="asset-row-actions">
                      <button
                        className="icon-button"
                        aria-label={`编辑投资记录 ${r.id}`}
                        title="编辑记录"
                        onClick={() => setRecordEditor(r)}
                      >
                        <Icon name="Pencil" size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`删除投资记录 ${r.id}`}
                        title="删除记录"
                        onClick={() => deleteRecord(r)}
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }
  function positionTable(list: Position[]) {
    return (
      <div className="asset-table-wrap">
        <table className="asset-table">
          <thead>
            <tr>
              <th>投资产品 / 平台</th>
              <th className="asset-number">当前市值</th>
              <th className="asset-number">持仓成本</th>
              <th className="asset-number">持仓盈亏</th>
              <th>估值日期</th>
              <th>
                <span className="asset-sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ product: p, state: s }) => (
              <tr key={p.id}>
                <td>
                  <button className="asset-product-link" onClick={() => setDetailId(p.id)}>
                    <i
                      style={{
                        color: assetCategories[p.category].color,
                        background: `${assetCategories[p.category].color}14`,
                      }}
                    >
                      <Icon name={assetCategories[p.category].icon} size={19} />
                    </i>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.platform} · {assetCategories[p.category].name}
                        {p.code && ` · ${p.code}`}
                      </small>
                    </span>
                  </button>
                </td>
                <td className="asset-number">
                  <strong>¥{money(s.value)}</strong>
                  <small>
                    {s.active
                      ? p.mode === 'units'
                        ? `${precision(s.quantity)} 份`
                        : '按金额管理'
                      : s.count
                        ? '已清仓'
                        : '尚未录入持仓'}
                  </small>
                </td>
                <td className="asset-number">{money(s.cost)}</td>
                <td className={`asset-number ${gainClass(s.unrealized)}`}>
                  {signed(s.unrealized)}
                  <small>
                    {s.cost > 0
                      ? `${s.unrealized >= 0 ? '+' : '−'}${((Math.abs(s.unrealized) / s.cost) * 100).toFixed(2)}%`
                      : '—'}
                  </small>
                </td>
                <td>
                  <span>{s.marketDate || '—'}</span>
                  <small>
                    {s.marketSource === 'trade'
                      ? '成交参考'
                      : s.marketSource === 'opening'
                        ? '期初估值'
                        : s.marketSource === 'valuation'
                          ? '手动估值'
                          : '等待录入'}
                  </small>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`查看投资 ${p.name} ${p.platform}`}
                    onClick={() => setDetailId(p.id)}
                  >
                    <Icon name="ChevronRight" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <>
      <aside className="sidebar asset-sidebar">
        <div className="workspace-name">
          <div className="workspace-avatar">
            <Icon name="Leaf" size={17} />
          </div>
          <div>
            <strong>我的生活空间</strong>
            <span>看见积累，记录变化</span>
          </div>
        </div>
        <nav className="smart-nav" aria-label="投资导航">
          {(
            [
              ['overview', '投资总览', 'Landmark'],
              ['positions', '全部持仓', 'Layers'],
              ['history', '投资记录', 'Clock3'],
            ] as const
          ).map(([id, name, icon]) => (
            <button
              key={id}
              className={`side-row ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon name={icon} size={18} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-scroll">
          <div className="sidebar-section-heading">
            <span>投资类型</span>
          </div>
          <button
            className={`side-row ${category === 'all' ? 'active' : ''}`}
            onClick={() => setCategory('all')}
          >
            <Icon name="Layers" size={17} />
            <span>全部投资</span>
            <small>{positions.length}</small>
          </button>
          {Object.entries(assetCategories).map(([id, c]) => (
            <button
              key={id}
              className={`side-row ${category === id ? 'active' : ''}`}
              onClick={() => setCategory(id as AssetCategory)}
            >
              <Icon name={c.icon} size={17} style={{ color: c.color }} />
              <span>{c.name}</span>
              <small>
                {positions.filter((p) => p.product.category === id && p.state.active).length}
              </small>
            </button>
          ))}
          <div className="asset-sidebar-note">
            <Icon name="CircleHelp" size={16} />
            <p>仅统计投资持仓。现金、银行卡余额及证券账户可用资金留在投资统计之外。</p>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="side-row" onClick={onSettings}>
            <Icon name="Settings2" size={17} />
            <span>设置与数据</span>
          </button>
          <div className="local-indicator">
            <i />
            本地投资台账 · 自动保存
          </div>
        </div>
      </aside>
      <main className="asset-main">
        <div className="main-topline">
          <div className="breadcrumb">
            <Icon name="Landmark" size={14} />
            资产<span>/</span>我的投资
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
            <div className="asset-search">
              <Icon name="Search" size={14} />
              <input
                ref={searchRef}
                aria-label="搜索投资"
                placeholder="搜索产品、平台或备注"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button aria-label="清空投资搜索" onClick={() => setSearch('')}>
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="asset-scroll">
          <header className="asset-heading">
            <div>
              <span className="asset-eyebrow">A LITTLE GROWTH, WELL RECORDED</span>
              <h1>
                我的投资 <Icon name="Sprout" size={24} />
              </h1>
              <p>记录持有，也记录每一次变化。</p>
            </div>
            <div className="asset-heading-actions">
              <button
                className="button secondary"
                disabled={!assets.products.length}
                onClick={() => createRecord()}
              >
                <Icon name="Plus" size={16} />
                记一笔投资
              </button>
              <button className="button primary" onClick={() => setProductEditor(newAsset())}>
                <Icon name="Plus" size={16} />
                新增投资
              </button>
            </div>
          </header>
          <div className="asset-filterbar">
            <span>
              {category === 'all' ? '全部类型' : assetCategories[category].name} · {filtered.length}{' '}
              项产品
            </span>
            <label>
              持有平台
              <select
                aria-label="筛选持有平台"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="all">全部平台</option>
                {platformNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <section className="asset-summary" aria-label="投资合计">
            <div data-testid="assets-value">
              <span>投资市值</span>
              <strong>¥{money(totals.value)}</strong>
              <small>各持仓最近一次估值的合计</small>
            </div>
            <div data-testid="assets-cost">
              <span>当前持仓成本</span>
              <strong>¥{money(totals.cost)}</strong>
              <small>已扣除卖出部分的成本</small>
            </div>
            <div data-testid="assets-profit">
              <span>累计收益</span>
              <strong className={gainClass(totals.profit)}>{signed(totals.profit)}</strong>
              <small>含当前筛选范围内的已清仓收益</small>
            </div>
          </section>
          <div className="asset-profit-breakdown">
            <span>收益构成</span>
            <span>
              持仓盈亏 <b className={gainClass(totals.unrealized)}>{signed(totals.unrealized)}</b>
            </span>
            <span>
              已实现盈亏（含其他费用）{' '}
              <b className={gainClass(totals.realized)}>{signed(totals.realized)}</b>
            </span>
            <span>
              分红（含再投）{' '}
              <b className={gainClass(totals.dividends)}>{signed(totals.dividends)}</b>
            </span>
          </div>
          {!assets.products.length ? (
            <div className="asset-empty">
              <div className="asset-empty-icon">
                <Icon name="Landmark" size={34} />
              </div>
              <h2>从第一项投资开始</h2>
              <p>
                已有投资可直接录入当前持仓；
                <br />
                也可以建立产品后，开始记录每次买入。
              </p>
              <button className="button primary" onClick={() => setProductEditor(newAsset())}>
                <Icon name="Plus" size={16} />
                录入我的第一项投资
              </button>
              <span>投资台账从空白开始，不会生成示例交易。</span>
            </div>
          ) : (
            <>
              <div className="asset-section-heading">
                <h2>
                  {view === 'overview'
                    ? '正在持有'
                    : view === 'positions'
                      ? '全部持仓'
                      : '投资记录'}{' '}
                  <span>
                    {view === 'history' ? `${records.length} 笔` : `${visiblePositions.length} 项`}
                  </span>
                </h2>
                <div className="asset-section-actions">
                  {view === 'positions' && (
                    <select
                      aria-label="持仓状态"
                      value={holding}
                      onChange={(e) => setHolding(e.target.value)}
                    >
                      <option value="active">正在持有</option>
                      <option value="closed">已清仓 / 空仓</option>
                      <option value="all">全部产品</option>
                    </select>
                  )}
                  {view === 'history' ? (
                    <>
                      <select
                        aria-label="投资记录类型"
                        value={historyType}
                        onChange={(e) => setHistoryType(e.target.value)}
                      >
                        <option value="all">全部记录类型</option>
                        {Object.entries(recordNames).map(([id, n]) => (
                          <option key={id} value={id}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="投资记录月份"
                        type="month"
                        value={month}
                        max={today.slice(0, 7)}
                        onChange={(e) => setMonth(e.target.value)}
                      />
                      {month && (
                        <button className="asset-text-button" onClick={() => setMonth('')}>
                          全部日期
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      className="button secondary"
                      disabled={!active.length}
                      onClick={() => setBatch(true)}
                    >
                      <Icon name="RefreshCw" size={14} />
                      批量更新估值
                    </button>
                  )}
                </div>
              </div>
              {view === 'history' ? (
                records.length ? (
                  recordTable(records)
                ) : (
                  <p className="asset-no-results">当前筛选下没有投资记录。</p>
                )
              ) : visiblePositions.length ? (
                positionTable(visiblePositions)
              ) : (
                <div className="asset-no-results">
                  <p>
                    {view === 'overview'
                      ? '当前筛选下没有正在持有的投资。'
                      : '当前筛选下没有持仓。'}
                  </p>
                  <button
                    className="asset-text-button"
                    onClick={() => {
                      setView('positions')
                      setHolding('all')
                    }}
                  >
                    查看全部产品与已清仓历史
                  </button>
                </div>
              )}
              {view === 'overview' && (
                <section className="asset-allocation">
                  <div className="asset-section-heading">
                    <h2>持仓分布</h2>
                    <span>按当前投资市值</span>
                  </div>
                  {Object.entries(assetCategories).map(([id, c]) => {
                    const value = active
                      .filter((p) => p.product.category === id)
                      .reduce((sum, p) => sum + p.state.value, 0)
                    if (!value) return null
                    const pct = totals.value ? (value / totals.value) * 100 : 0
                    return (
                      <div className="asset-allocation-row" key={id}>
                        <span>
                          <i style={{ background: c.color }} />
                          {c.name}
                        </span>
                        <div
                          className="asset-allocation-track"
                          role="meter"
                          aria-label={`${c.name}占比`}
                          aria-valuenow={Number(pct.toFixed(1))}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <i style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                        <span>{pct.toFixed(1)}%</span>
                        <strong>¥{money(value)}</strong>
                      </div>
                    )
                  })}
                  {!totals.value && <p className="asset-help">录入市值后展示各类投资的占比。</p>}
                </section>
              )}
            </>
          )}
          <p className="asset-footnote">
            人民币计价 · 手动估值，以每项产品显示的日期为准 ·
            投资记录独立保存，暂不自动改变记账账户余额
          </p>
        </div>
      </main>
      {productEditor && (
        <AssetProductEditor
          initial={productEditor}
          assets={assets}
          onSave={saveProduct}
          onClose={() => setProductEditor(null)}
        />
      )}
      {recordEditor && (
        <AssetRecordEditor
          initial={recordEditor}
          assets={assets}
          onSave={saveRecord}
          onClose={() => setRecordEditor(null)}
        />
      )}
      {batch && (
        <AssetValuationEditor
          assets={assets}
          products={active.map((p) => p.product)}
          onClose={() => setBatch(false)}
          onSave={(records) => {
            const error = commit((a) => ({ ...a, records: [...a.records, ...records] }))
            if (!error) {
              setBatch(false)
              notify(`已更新 ${records.length} 项估值`)
            }
            return error
          }}
        />
      )}
      {detail && !productEditor && !recordEditor && !batch && !confirm && (
        <Modal
          title="投资详情"
          subtitle={`${detail.product.name} · ${detail.product.platform}`}
          wide
          onClose={() => setDetailId(null)}
        >
          <div className="asset-detail">
            <div className="asset-detail-heading">
              <span className="asset-type-label">
                {assetCategories[detail.product.category].name}
                {detail.product.code && ` · ${detail.product.code}`} ·{' '}
                {detail.state.active ? '正在持有' : detail.state.count ? '已清仓' : '等待录入'}
              </span>
              <button
                className="asset-text-button"
                onClick={() => setProductEditor(detail.product)}
              >
                <Icon name="Pencil" size={13} />
                编辑产品
              </button>
            </div>
            <div className="asset-detail-stats">
              <div>
                <span>当前市值</span>
                <strong>¥{money(detail.state.value)}</strong>
              </div>
              <div>
                <span>持仓成本</span>
                <strong>¥{money(detail.state.cost)}</strong>
              </div>
              <div>
                <span>累计收益</span>
                <strong className={gainClass(detail.state.profit)}>
                  {signed(detail.state.profit)}
                </strong>
              </div>
            </div>
            <dl className="asset-detail-grid">
              <div>
                <dt>持有数量</dt>
                <dd>
                  {detail.product.mode === 'units'
                    ? `${precision(detail.state.quantity)} 份`
                    : '按金额管理'}
                </dd>
              </div>
              <div>
                <dt>持仓盈亏</dt>
                <dd className={gainClass(detail.state.unrealized)}>
                  {signed(detail.state.unrealized)}
                </dd>
              </div>
              <div>
                <dt>已实现盈亏（含其他费用）</dt>
                <dd>{signed(detail.state.realized)}</dd>
              </div>
              <div>
                <dt>现金分红（净额） / 再投分红</dt>
                <dd>
                  {money(detail.state.cashDividends)} / {money(detail.state.reinvestedDividends)}
                </dd>
              </div>
              <div>
                <dt>累计外部投入（含期初成本）</dt>
                <dd>¥{money(detail.state.invested)}</dd>
              </div>
              <div>
                <dt>累计净回款（扣除其他费用）</dt>
                <dd>¥{money(detail.state.withdrawn)}</dd>
              </div>
              <div>
                <dt>已计入核算的全部费用</dt>
                <dd>¥{money(detail.state.fees)}</dd>
              </div>
              <div>
                <dt>记录起点 / 最近估值</dt>
                <dd>
                  {detail.state.startDate || '—'} / {detail.state.marketDate || '—'}
                </dd>
              </div>
            </dl>
            {detail.product.note && <p className="asset-detail-note">{detail.product.note}</p>}
            <div className="asset-detail-actions">
              <button className="button primary" onClick={() => createRecord(detail.product.id)}>
                <Icon name="Plus" size={14} />
                记录买卖 / 分红
              </button>
              <button
                className="button secondary"
                disabled={!detail.state.active}
                onClick={() => createRecord(detail.product.id, 'valuation')}
              >
                <Icon name="RefreshCw" size={14} />
                更新这项估值
              </button>
            </div>
            <div className="asset-section-heading">
              <h2>全部投资记录</h2>
              <small>同日按录入顺序执行</small>
            </div>
            {detail.state.count ? (
              recordTable(
                orderedRecords(assets.records.filter((r) => r.assetId === detailId)).reverse(),
                false,
              )
            ) : (
              <p className="asset-no-results">尚未录入投资记录。</p>
            )}
            <p className="asset-help">
              累计收益从现有期初成本及已录入记录核算，不自动追溯录入前的已卖出收益与分红。买卖手续费已计入成本或卖出净额。
            </p>
            <div className="modal-footer">
              <button
                className="asset-delete-product"
                onClick={() => deleteProduct(detail.product)}
              >
                <Icon name="Trash2" size={14} />
                删除投资产品
              </button>
              <button className="button secondary" onClick={() => setDetailId(null)}>
                关闭详情
              </button>
            </div>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="confirm-message">{confirm.message}</p>
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
