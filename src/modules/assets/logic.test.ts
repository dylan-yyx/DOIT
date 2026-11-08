import { describe, expect, it } from 'vitest'
import type { AssetProduct, AssetRecord, AssetsData } from '../../core/types'
import { createSeed } from '../../core/seed'
import { validateData } from '../tasks/logic'
import {
  assetsError,
  assetState,
  newAssetRecord,
  parsePrecision,
  precisionInput,
  quoteValue,
  validateAssetsData,
  withAssetsData,
} from './logic'

const product = (mode: AssetProduct['mode'] = 'units'): AssetProduct => ({
  id: 'fund',
  name: '测试投资',
  code: '',
  category: 'fund',
  platform: '测试平台',
  mode,
  note: '',
  createdAt: '2026-01-01T00:00:00Z',
})
const cents = (n: number) => Math.round(n * 100)
const units = (n: number) => Math.round(n * 1_000_000)
let serial = 0
function record(type: AssetRecord['type'], patch: Partial<AssetRecord> = {}): AssetRecord {
  return { ...newAssetRecord('fund', type, '2026-01-01'), id: `record-${serial++}`, ...patch }
}
const unitOpening = () =>
  record('opening', { amount: cents(1000), quantity: units(100), price: units(11) })
const data = (records: AssetRecord[], mode: AssetProduct['mode'] = 'units'): AssetsData => ({
  products: [product(mode)],
  records,
})

describe('投资金额、数量与价格精度', () => {
  it('保留六位数量精度，按分四舍五入交易金额', () => {
    expect(parsePrecision('0.123456')).toBe(123456)
    expect(precisionInput(1000000000)).toBe('1000')
    expect(precisionInput(1234500)).toBe('1.2345')
    expect(parsePrecision('1.1234567')).toBeNull()
    expect(parsePrecision('-1')).toBeNull()
    expect(parsePrecision('1e8')).toBeNull()
    expect(quoteValue(123456, 12345678)).toBe(152)
    expect(quoteValue(units(1), units(0.005))).toBe(1)
  })
})
describe('按份额核算持仓和收益', () => {
  it('追加投入只增加成本，按成交价计算市值', () => {
    const rs = [
      unitOpening(),
      record('buy', { amount: cents(600), quantity: units(50), price: units(12), fee: cents(5) }),
    ]
    const s = assetState(product(), rs)
    expect(s).toMatchObject({
      quantity: units(150),
      cost: cents(1605),
      value: cents(1800),
      profit: cents(195),
      invested: cents(1605),
    })
    expect(validateAssetsData(data(rs))).toBe(true)
  })
  it('部分卖出按移动平均成本结转，卖出回款不等于盈利', () => {
    const rs = [
      unitOpening(),
      record('buy', { amount: cents(600), quantity: units(50), price: units(12), fee: cents(5) }),
      record('sell', { amount: cents(780), quantity: units(60), price: units(13), fee: cents(3) }),
    ]
    expect(assetState(product(), rs)).toMatchObject({
      quantity: units(90),
      cost: cents(963),
      value: cents(1170),
      realized: cents(135),
      unrealized: cents(207),
      profit: cents(342),
    })
  })
  it('现金分红、分红再投及独立费用没有重复计入；清仓仍保留收益', () => {
    const rs = [
      unitOpening(),
      record('buy', { amount: cents(600), quantity: units(50), price: units(12), fee: cents(5) }),
      record('sell', { amount: cents(780), quantity: units(60), price: units(13), fee: cents(3) }),
      record('dividend', { amount: cents(30), fee: cents(2) }),
      record('reinvest', {
        amount: cents(100),
        quantity: units(10),
        price: units(10),
        fee: cents(1),
      }),
      record('fee', { amount: cents(4) }),
      record('sell', {
        amount: cents(1100),
        quantity: units(100),
        price: units(11),
        fee: cents(3),
      }),
    ]
    for (let i = 1; i <= rs.length; i++) {
      const s = assetState(product(), rs.slice(0, i))
      expect(s.profit).toBe(s.value + s.withdrawn - s.invested)
    }
    expect(assetState(product(), rs)).toMatchObject({
      cost: 0,
      value: 0,
      quantity: 0,
      active: false,
      realized: cents(164),
      cashDividends: cents(28),
      reinvestedDividends: cents(101),
      fees: cents(18),
      profit: cents(293),
    })
    expect(validateAssetsData(data(rs))).toBe(true)
  })
  it('全额卖出结转舍入尾差，重新买入时沿用历史已实现收益', () => {
    const rs = [
      record('opening', { amount: 100, quantity: units(3), price: units(1) }),
      record('sell', { amount: 100, quantity: units(1), price: units(1) }),
      record('sell', { amount: 200, quantity: units(2), price: units(1) }),
    ]
    expect(assetState(product(), rs)).toMatchObject({ cost: 0, profit: 200, active: false })
    rs.push(record('buy', { amount: 200, quantity: units(1), price: units(2) }))
    expect(assetState(product(), rs)).toMatchObject({
      cost: 200,
      value: 200,
      profit: 200,
      active: true,
    })
  })
  it('估值不改变成本或已实现收益，可记录零价格', () => {
    const rs = [unitOpening(), record('valuation', { price: 0 })]
    expect(assetState(product(), rs)).toMatchObject({
      value: 0,
      cost: cents(1000),
      realized: 0,
      active: true,
      profit: cents(-1000),
    })
  })
  it('清仓后到账的现金分红仍可记录，空仓估值被拒绝', () => {
    const rs = [
      unitOpening(),
      record('sell', { amount: cents(1200), quantity: units(100), price: units(12) }),
      record('dividend', { amount: cents(10) }),
    ]
    expect(assetState(product(), rs)).toMatchObject({ profit: cents(210), active: false })
    expect(assetsError(data([...rs, record('valuation', { price: units(12) })]))).toContain(
      '空仓不能更新估值',
    )
  })
})
describe('按金额核算理财与赎回', () => {
  it('部分赎回显式使用对应成本和剩余市值，完整赎回后成本归零', () => {
    const rs = [
      record('opening', { amount: cents(10000), value: cents(10500) }),
      record('buy', { amount: cents(2000), fee: cents(10) }),
      record('sell', {
        amount: cents(3300),
        fee: cents(20),
        basis: cents(3000),
        value: cents(9300),
      }),
    ]
    expect(assetState(product('amount'), rs)).toMatchObject({
      cost: cents(9010),
      value: cents(9300),
      realized: cents(280),
      profit: cents(570),
    })
    rs.push(record('sell', { amount: cents(9200), fee: cents(10), basis: cents(9010), value: 0 }))
    expect(assetState(product('amount'), rs)).toMatchObject({
      cost: 0,
      value: 0,
      profit: cents(460),
      active: false,
    })
    expect(validateAssetsData(data(rs, 'amount'))).toBe(true)
  })
  it('零成本持仓及按金额的分红再投可以核算', () => {
    const rs = [
      record('opening', { amount: 0, value: cents(100) }),
      record('reinvest', { amount: cents(10), fee: cents(1) }),
    ]
    const s = assetState(product('amount'), rs)
    expect(s).toMatchObject({
      cost: cents(11),
      value: cents(110),
      reinvestedDividends: cents(11),
      invested: 0,
      profit: cents(110),
    })
  })
})
describe('修改历史、备份校验与旧数据兼容', () => {
  it('按日期及同日录入顺序重算，历史修改导致超卖时拒绝保存', () => {
    const opening = { ...unitOpening(), date: '2026-01-01' }
    const sell = record('sell', {
      date: '2026-01-03',
      amount: cents(1100),
      quantity: units(100),
      price: units(11),
    })
    const valuation = record('valuation', { date: '2026-01-02', price: units(12) })
    expect(assetState(product(), [opening, sell, valuation])).toMatchObject({
      active: false,
      profit: cents(100),
    })
    expect(assetsError(data([{ ...opening, quantity: units(99) }, sell, valuation]))).toContain(
      '不能超过当时的持仓',
    )
    expect(assetsError(data([sell]))).toContain('没有可卖出的持仓')
    expect(assetsError(data([opening, { ...opening, id: 'another' }]))).toContain(
      '期初持仓只能有一笔',
    )
  })
  it('拒绝无效金额、日期、模式、重复标识和孤立记录', () => {
    const d = data([unitOpening()])
    for (const patch of [
      { amount: -1 },
      { price: NaN },
      { date: '2026-02-30' },
      { assetId: 'missing' },
      { quantity: 1.2 },
      { value: 100 },
    ])
      expect(validateAssetsData({ ...d, records: [{ ...d.records[0], ...patch }] })).toBe(false)
    expect(validateAssetsData({ ...d, records: [null] })).toBe(false)
    expect(validateAssetsData({ ...d, products: [null] })).toBe(false)
    expect(validateAssetsData({ ...d, products: [...d.products, ...d.products] })).toBe(false)
    expect(validateAssetsData({ ...d, records: [...d.records, ...d.records] })).toBe(false)
    expect(validateAssetsData({ ...d, products: [{ ...d.products[0], mode: 'amount' }] })).toBe(
      false,
    )
    expect(validateAssetsData(null)).toBe(false)
  })
  it('旧备份补齐空资产结构，完整备份包含投资并在坏数据时拒绝导入', () => {
    const original = createSeed()
    delete original.assets
    expect(validateData(original)).toBe(true)
    const upgraded = withAssetsData(original)
    expect(upgraded.assets).toEqual({ products: [], records: [] })
    expect(upgraded.tasks).toBe(original.tasks)
    expect(upgraded.finance).toBe(original.finance)
    const backup = JSON.parse(JSON.stringify({ ...upgraded, assets: data([unitOpening()]) }))
    expect(validateData(backup)).toBe(true)
    backup.assets.records[0].amount = -1
    expect(validateData(backup)).toBe(false)
  })
})
