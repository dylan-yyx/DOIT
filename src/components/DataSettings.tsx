import type { AppData } from '../core/types'
import Icon from './Icon'

export default function DataSettings({
  data,
  path,
  status,
  saveError,
  onExport,
  onImport,
}: {
  data: AppData
  path: string
  status: 'saving' | 'saved' | 'error'
  saveError: string
  onExport: () => void
  onImport: () => void
}) {
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
            { label: '投资产品', count: data.assets?.products.length || 0, icon: 'Landmark' },
          ].map((item) => (
            <div key={item.label}>
              <Icon name={item.icon} size={17} />
              <strong>{item.count}</strong>
              <span>{item.label}</span>
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
          安装版数据保存在用户目录，便携版数据保存在软件旁的 data 文件夹。建议定期导出备份，留存一份生活记录。
        </p>
      </section>
    </div>
  )
}
