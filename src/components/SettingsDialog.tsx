import { useRef, useState, type ReactNode } from 'react'
import type { AppData, Appearance } from '../core/types'
import { version } from '../../package.json'
import Modal from './Modal'
import Icon from './Icon'
import AppearanceSettings from './AppearanceSettings'
import DataSettings from './DataSettings'

// Add a navigation entry and its corresponding panel to extend the settings.
const sections = [
  {
    id: 'appearance',
    label: '外观',
    icon: 'Palette',
    description: '选择喜欢的背景与字体，让工作台更像你。',
  },
  {
    id: 'data',
    label: '数据管理',
    icon: 'Database',
    description: '管理本地记录，备份与恢复你的生活数据。',
  },
] as const
type SectionId = (typeof sections)[number]['id']

export default function SettingsDialog({
  data,
  path,
  status,
  saveError,
  onAppearanceChange,
  onExport,
  onImport,
  onClose,
}: {
  data: AppData
  path: string
  status: 'saving' | 'saved' | 'error'
  saveError: string
  onAppearanceChange: (appearance: Appearance) => void
  onExport: () => void
  onImport: () => void
  onClose: () => void
}) {
  const [active, setActive] = useState<SectionId>('appearance')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const section = sections.find((item) => item.id === active)!
  const panels: Record<SectionId, ReactNode> = {
    appearance: (
      <AppearanceSettings value={data.preferences.appearance} onChange={onAppearanceChange} />
    ),
    data: (
      <DataSettings
        data={data}
        path={path}
        status={status}
        saveError={saveError}
        onExport={onExport}
        onImport={onImport}
      />
    ),
  }
  return (
    <Modal title="设置与数据" onClose={onClose} className="settings-modal" hideHeading>
      <div className="settings-layout">
        <aside className="settings-navigation">
          <div className="settings-nav-heading">
            <h2>设置</h2>
            <p>打理你的工作台</p>
          </div>
          <div
            role="tablist"
            aria-label="设置分类"
            aria-orientation="vertical"
            className="settings-tabs"
          >
            {sections.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => {
                  tabs.current[index] = element
                }}
                id={`settings-tab-${item.id}`}
                role="tab"
                aria-selected={active === item.id}
                aria-controls={`settings-panel-${item.id}`}
                tabIndex={active === item.id ? 0 : -1}
                className={active === item.id ? 'active' : ''}
                onClick={() => setActive(item.id)}
                onKeyDown={(event) => {
                  let next = index
                  if (event.key === 'ArrowDown') next = (index + 1) % sections.length
                  else if (event.key === 'ArrowUp')
                    next = (index + sections.length - 1) % sections.length
                  else if (event.key === 'Home') next = 0
                  else if (event.key === 'End') next = sections.length - 1
                  else return
                  event.preventDefault()
                  setActive(sections[next].id)
                  tabs.current[next]?.focus()
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                <Icon name="ChevronRight" size={13} />
              </button>
            ))}
          </div>
          <div className="settings-nav-footer">
            <div className="settings-app-brand">
              <div className="brand-logo">
                d<span>.</span>
              </div>
              <div>
                <strong>DOIT 拾序</strong>
                <span>v{version}</span>
              </div>
            </div>
            <p>
              <i />
              本地优先 · 自动保存
            </p>
          </div>
        </aside>
        <div className="settings-main">
          <header className="settings-page-header">
            <div>
              <h2>{section.label}</h2>
              <p>{section.description}</p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="关闭弹窗">
              <Icon name="X" size={20} />
            </button>
          </header>
          {sections.map((item) => (
            <section
              key={item.id}
              role="tabpanel"
              id={`settings-panel-${item.id}`}
              aria-labelledby={`settings-tab-${item.id}`}
              hidden={active !== item.id}
              tabIndex={0}
              className="settings-panel"
            >
              {panels[item.id]}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  )
}
