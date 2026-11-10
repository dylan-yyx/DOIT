import { useState } from 'react'
import type { AppData } from '../core/types'
import { modules, type ModuleId } from '../modules/registry'
import Icon from './Icon'
import { assetState, countHoldings } from '../modules/assets/logic'

const clearDetails: Record<ModuleId, string> = {
  tasks: '清空事项、清单、文件夹和标签，重建收集箱。',
  habits: '清空习惯、分组和打卡记录。',
  finance: '清空账目、回款和自定义账户与分类，恢复默认账户及分类，期初余额归零。',
  assets: '清空投资产品、交易和估值记录。',
}

export default function DataSettings({
  data,
  path,
  status,
  saveError,
  onExport,
  onImport,
  onRequestClear,
  clearBackup,
}: {
  data: AppData
  path: string
  status: 'saving' | 'saved' | 'error'
  saveError: string
  onExport: () => void
  onImport: () => void
  onRequestClear: (selected: ModuleId[]) => void
  clearBackup: string
}) {
  const [selected, setSelected] = useState<ModuleId[]>([])
  const assets = data.assets
  const assetCounts = countHoldings(
    assets ? assets.products.map((p) => assetState(p, assets.records)) : [],
  )
  const assetBreakdown = [
    `持有 ${assetCounts.active}`,
    assetCounts.pending ? `未建仓 ${assetCounts.pending}` : '',
    assetCounts.closed ? `已清仓 ${assetCounts.closed}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="data-settings">
      <section aria-labelledby="data-overview-heading">
        <h3 id="data-overview-heading" className="settings-section-title">
          我的记录
        </h3>
        <div className="data-overview">
          {[
            { label: '待办事项', count: data.tasks.length, icon: 'CheckCheck' },
            { label: '习惯', count: data.habits?.length || 0, icon: 'Flame' },
            { label: '账目', count: data.finance?.entries.length || 0, icon: 'Wallet' },
            {
              label: '投资档案',
              count: data.assets?.products.length || 0,
              icon: 'Landmark',
              breakdown: assetBreakdown,
            },
          ].map((item) => (
            <div key={item.label}>
              <Icon name={item.icon} size={17} />
              <strong>{item.count}</strong>
              <span>{item.label}</span>
              {item.breakdown && <small>{item.breakdown}</small>}
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="data-backup-heading">
        <h3 id="data-backup-heading" className="settings-section-title">
          备份与恢复
        </h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-copy">
              <Icon name="Download" size={19} />
              <div>
                <strong>导出数据备份</strong>
                <p>保存全部模块数据、外观偏好与自定义背景图片。</p>
              </div>
            </div>
            <button className="button secondary" onClick={onExport}>
              <Icon name="Download" size={14} />
              导出
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <Icon name="Upload" size={19} />
              <div>
                <strong>从备份导入</strong>
                <p>导入前可预览数量，确认后替换当前数据。</p>
              </div>
            </div>
            <button className="button secondary" onClick={onImport}>
              <Icon name="Upload" size={14} />
              导入
            </button>
          </div>
        </div>
      </section>
      <section aria-labelledby="data-clear-heading">
        <h3 id="data-clear-heading" className="settings-section-title">
          清空模块数据
        </h3>
        <div className="settings-card clear-data-card">
          <fieldset aria-label="选择要清空的模块">
            {modules.map(({ id, name }) => (
              <label key={id} className="clear-data-option">
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  aria-label={`清空${name}数据`}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, id]
                        : selected.filter((value) => value !== id),
                    )
                  }
                />
                <span>
                  <strong>{name}</strong>
                  <small>{clearDetails[id]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="clear-data-actions">
            <p className="clear-data-note">
              {status === 'error' ? '请先解决保存错误。' : '可勾选一个或多个模块，验证后一次清空。'}
            </p>
            <button
              className="button danger-button"
              disabled={!selected.length || status !== 'saved'}
              onClick={() => onRequestClear(selected)}
            >
              清空所选模块
            </button>
          </div>
          {clearBackup && (
            <p className="clear-data-note clear-backup-location">
              清空前的备份<code>{clearBackup}</code>
            </p>
          )}
        </div>
      </section>
      <section aria-labelledby="data-storage-heading">
        <h3 id="data-storage-heading" className="settings-section-title">
          本地存储
        </h3>
        <div className="settings-card local-storage-card">
          <div className="data-location">
            <Icon name="Folder" size={19} />
            <div>
              <span>数据位置</span>
              <code>{path || '当前浏览器的本地存储'}</code>
            </div>
          </div>
          <div className={`data-save-state ${status === 'error' ? 'has-error' : ''}`} role="status">
            <Icon
              name={
                status === 'error'
                  ? 'CircleHelp'
                  : status === 'saving'
                    ? 'RefreshCw'
                    : 'CheckCircle2'
              }
              size={15}
            />
            {status === 'error'
              ? `保存失败：${saveError}。请先导出备份。`
              : status === 'saving'
                ? '正在保存…'
                : '所有更改已保存到本机'}
          </div>
        </div>
        <p className="data-storage-hint">
          安装版数据保存在用户目录，便携版数据保存在软件旁的 data
          文件夹。建议定期导出备份，留存一份生活记录。
        </p>
      </section>
    </div>
  )
}
