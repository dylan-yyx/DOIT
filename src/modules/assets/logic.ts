import type {
  AppData,
  AssetProduct,
  AssetRecord,
  AssetRecordType,
  AssetsData,
} from '../../core/types'
import { dateKey, parseDate } from '../../core/dates'

export const assetCategories = {
  fund: { name: '基金', icon: 'Layers', color: '#738967' },
  stock: { name: '股票 / ETF', icon: 'ChartNoAxesCombined', color: '#6b8ca9' },
  wealth: { name: '银行理财', icon: 'Landmark', color: '#937caf' },
  bond: { name: '债券', icon: 'Archive', color: '#c3a05d' },
  gold: { name: '黄金', icon: 'Sparkles', color: '#b48c52' },
  other: { name: '其他投资', icon: 'Leaf', color: '#7d8a89' },
} as const
export const recordNames: Record<AssetRecordType, string> = {
  opening: '期初持仓',
  buy: '买入',
  sell: '卖出',
  dividend: '现金分红',
  reinvest: '分红再投',
  fee: '其他费用',
  valuation: '更新估值',
}
const MONEY_LIMIT = 100_000_000_000
const SCALE = 1_000_000
export const createAssetsData = (): AssetsData => ({ products: [], records: [] })
export const withAssetsData = (data: AppData): AppData =>
  data.assets ? data : { ...data, assets: createAssetsData() }
export function newAsset(): AssetProduct {
  return {
    id: crypto.randomUUID(),
    name: '',
    code: '',
    category: 'fund',
    platform: '',
    mode: 'units',
    note: '',
    createdAt: new Date().toISOString(),
  }
}
export function newAssetRecord(
  assetId: string,
  type: AssetRecordType,
  date = dateKey(),
): AssetRecord {
  return {
    id: crypto.randomUUID(),
    assetId,
    type,
    date,
    amount: 0,
    fee: 0,
    quantity: 0,
    price: 0,
    value: 0,
    basis: 0,
    note: '',
    createdAt: new Date().toISOString(),
  }
}
export function parsePrecision(value: string): number | null {
  if (!/^\d+(\.\d{1,6})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const result = Number(whole) * SCALE + Number(fraction.padEnd(6, '0'))
  return Number.isSafeInteger(result) && result <= 1_000_000_000_000_000 ? result : null
}
export const precisionInput = (value: number) =>
  (value / SCALE).toFixed(6).replace(/\.?0+$/, '') || '0'
export const precision = (value: number) =>
  (value / SCALE).toLocaleString('zh-CN', { maximumFractionDigits: 6 })
function ratio(a: number, b: number, denominator: number): number {
  const result = (BigInt(a) * BigInt(b) + BigInt(denominator) / 2n) / BigInt(denominator)
  const n = Number(result)
  if (!Number.isSafeInteger(n)) throw new Error('计算金额超出可保存范围。')
  return n
}
export const quoteValue = (quantity: number, price: number) =>
  ratio(quantity, price, 10_000_000_000)
export function orderedRecords(records: AssetRecord[]) {
  // Array order is the persisted execution order for multiple records on the same date.
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => a.record.date.localeCompare(b.record.date) || a.index - b.index)
    .map((item) => item.record)
}
export interface AssetState {
  quantity: number
  cost: number
  value: number
  realized: number
  cashDividends: number
  reinvestedDividends: number
  fees: number
  invested: number
  withdrawn: number
  unrealized: number
  profit: number
  active: boolean
  price: number
  marketDate: string
  marketSource: 'opening' | 'trade' | 'valuation' | ''
  startDate: string
  count: number
}
export function holdingStatus(state: Pick<AssetState, 'active' | 'count'>) {
  if (state.active) return 'active'
  return state.count ? 'closed' : 'pending'
}
export function countHoldings(states: AssetState[]) {
  const counts = { active: 0, closed: 0, pending: 0 }
  for (const state of states) counts[holdingStatus(state)]++
  return counts
}
export function assetState(product: AssetProduct, records: AssetRecord[]): AssetState {
  const list = orderedRecords(records.filter((r) => r.assetId === product.id))
  const s: AssetState = {
    quantity: 0,
    cost: 0,
    value: 0,
    realized: 0,
    cashDividends: 0,
    reinvestedDividends: 0,
    fees: 0,
    invested: 0,
    withdrawn: 0,
    unrealized: 0,
    profit: 0,
    active: false,
    price: 0,
    marketDate: '',
    marketSource: '',
    startDate: list[0]?.date || '',
    count: list.length,
  }
  let everHeld = false
  const unitMode = product.mode === 'units'
  for (const [index, r] of list.entries()) {
    const fail = (message: string): never => {
      throw new Error(`${product.name} · ${r.date} ${recordNames[r.type]}：${message}`)
    }
    const isTrade = r.type === 'buy' || r.type === 'sell' || r.type === 'reinvest'
    if (unitMode && (r.value !== 0 || r.basis !== 0))
      fail('按份额管理不能填写金额模式的市值或赎回成本。')
    if (!unitMode && (r.quantity !== 0 || r.price !== 0)) fail('按金额管理不能填写份额或单位价格。')
    if (r.type === 'opening') {
      if (index !== 0) fail('期初持仓只能有一笔，且必须位于其他记录之前。')
      if (r.fee || r.basis) fail('期初成本应直接包含历史费用。')
      if (unitMode ? r.quantity <= 0 : r.amount === 0 && r.value === 0)
        fail('请填写有效的期初持仓。')
      s.quantity = r.quantity
      s.cost = r.amount
      s.value = unitMode ? quoteValue(r.quantity, r.price) : r.value
      s.price = r.price
      s.invested += r.amount
      everHeld = true
    } else if (isTrade) {
      if (r.type !== 'sell' && r.amount <= 0) fail('交易金额需大于 0。')
      if (unitMode && (r.quantity <= 0 || r.amount !== quoteValue(r.quantity, r.price)))
        fail('份额、价格和成交金额不一致。')
      if (r.type !== 'sell' && (r.value !== 0 || r.basis !== 0))
        fail('买入不能填写赎回后的市值或成本。')
      if (r.type === 'reinvest' && !everHeld) fail('请先录入期初持仓或买入记录。')
      if (r.type === 'sell') {
        if (!s.active) fail('没有可卖出的持仓。')
        if (unitMode && r.quantity > s.quantity) fail('卖出份额不能超过当时的持仓。')
        if (!unitMode && r.basis > s.cost) fail('赎回对应成本不能超过当时的持仓成本。')
        const basis = unitMode
          ? r.quantity === s.quantity
            ? s.cost
            : ratio(s.cost, r.quantity, s.quantity)
          : r.basis
        s.realized += r.amount - r.fee - basis
        s.cost -= basis
        s.quantity -= r.quantity
        s.withdrawn += r.amount - r.fee
        s.value = unitMode ? quoteValue(s.quantity, r.price) : r.value
      } else {
        s.quantity += r.quantity
        s.cost += r.amount + r.fee
        s.value = unitMode ? quoteValue(s.quantity, r.price) : s.value + r.amount
        if (r.type === 'reinvest') s.reinvestedDividends += r.amount + r.fee
        else s.invested += r.amount + r.fee
        everHeld = true
      }
      s.price = r.price
      s.fees += r.fee
    } else if (r.type === 'valuation') {
      if (!s.active) fail('空仓不能更新估值，请先录入持仓。')
      if (r.amount || r.fee || r.quantity || r.basis) fail('估值不能包含交易金额或份额。')
      s.value = unitMode ? quoteValue(s.quantity, r.price) : r.value
      s.price = r.price
    } else {
      if (!everHeld) fail('请先录入期初持仓或买入记录。')
      if (r.amount <= 0 || r.quantity || r.price || r.value || r.basis)
        fail('请填写有效的分红或费用金额。')
      if (r.type === 'dividend') {
        if (r.fee > r.amount) fail('分红手续费不能大于分红金额。')
        s.cashDividends += r.amount - r.fee
        s.withdrawn += r.amount - r.fee
        s.fees += r.fee
      } else {
        if (r.fee !== 0) fail('其他费用直接填写总金额即可。')
        s.realized -= r.amount
        s.fees += r.amount
        s.withdrawn -= r.amount
      }
    }
    if (r.type === 'opening' || isTrade || r.type === 'valuation') {
      s.marketDate = r.date
      s.marketSource =
        r.type === 'opening' ? 'opening' : r.type === 'valuation' ? 'valuation' : 'trade'
    }
    s.active = unitMode ? s.quantity > 0 : s.cost > 0 || s.value > 0
    for (const key of [
      'quantity',
      'cost',
      'value',
      'fees',
      'invested',
      'withdrawn',
      'realized',
      'cashDividends',
      'reinvestedDividends',
    ] as const)
      if (!Number.isSafeInteger(s[key])) fail('累计数值超出可保存范围。')
    if (s.cost > MONEY_LIMIT || s.value > MONEY_LIMIT || s.quantity > 1_000_000_000_000_000)
      fail('持仓超过可保存范围。')
  }
  s.unrealized = s.value - s.cost
  s.profit = s.unrealized + s.realized + s.cashDividends + s.reinvestedDividends
  return s
}
export function assetsError(value: unknown): string {
  if (value === undefined) return '' // Legacy backups do not contain this module.
  try {
    if (!value || typeof value !== 'object') return '资产数据格式不完整。'
    const d = value as AssetsData
    if (!Array.isArray(d.products) || !Array.isArray(d.records)) return '资产产品或记录格式不完整。'
    const text = (v: unknown, max = 5000): v is string => typeof v === 'string' && v.length <= max
    const integer = (v: unknown, max = MONEY_LIMIT) =>
      Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max
    if (
      !d.products.every(
        (p) =>
          p &&
          text(p.id, 128) &&
          p.id &&
          text(p.name, 120) &&
          p.name.trim() &&
          text(p.code, 40) &&
          text(p.platform, 80) &&
          p.platform.trim() &&
          text(p.note) &&
          text(p.createdAt, 80) &&
          Object.hasOwn(assetCategories, p.category) &&
          ['units', 'amount'].includes(p.mode),
      )
    )
      return '投资产品信息不完整。'
    if (new Set(d.products.map((p) => p.id)).size !== d.products.length) return '投资产品标识重复。'
    if (new Set(d.records.map((r) => r?.id)).size !== d.records.length) return '投资记录标识重复。'
    const ids = new Set(d.products.map((p) => p.id))
    if (
      !d.records.every(
        (r) =>
          r &&
          text(r.id, 128) &&
          r.id &&
          ids.has(r.assetId) &&
          Object.hasOwn(recordNames, r.type) &&
          text(r.date, 10) &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
          dateKey(parseDate(r.date)) === r.date &&
          text(r.note) &&
          text(r.createdAt, 80) &&
          integer(r.amount) &&
          integer(r.fee) &&
          integer(r.value) &&
          integer(r.basis) &&
          integer(r.quantity, 1_000_000_000_000_000) &&
          integer(r.price, 1_000_000_000_000),
      )
    )
      return '投资记录的日期、金额、数量或关联产品不正确。'
    const totals = { value: 0, cost: 0, profit: 0 }
    for (const product of d.products) {
      const s = assetState(product, d.records)
      totals.value += s.value
      totals.cost += s.cost
      totals.profit += s.profit
    }
    if (Object.values(totals).some((n) => !Number.isSafeInteger(n)))
      return '投资合计超出可保存范围。'
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : '资产数据无法计算。'
  }
}
export const validateAssetsData = (value: unknown): value is AssetsData | undefined =>
  !assetsError(value)
export function replaceAssetRecord(data: AssetsData, record: AssetRecord): AssetsData {
  return {
    ...data,
    records: data.records.some((r) => r.id === record.id)
      ? data.records.map((r) => (r.id === record.id ? record : r))
      : [...data.records, record],
  }
}
