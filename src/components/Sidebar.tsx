import type { AppData, Filter } from '../core/types'
import { dateKey } from '../core/dates'
import { isCompleted, occursOn } from '../modules/tasks/logic'
import type { EntityKind, Entity } from './EntityEditor'
import Icon from './Icon'
export default function Sidebar({
  data,
  filter,
  onFilter,
  onEntity,
  onCollapse,
  onSettings,
}: {
  data: AppData
  filter: Filter
  onFilter: (f: Filter) => void
  onEntity: (kind: EntityKind, initial?: Entity) => void
  onCollapse: (id: string) => void
  onSettings: () => void
}) {
  const today = dateKey(),
    active = (kind: Filter['kind'], id: string) => filter.kind === kind && filter.id === id
  const pending = data.tasks.filter((t) => !isCompleted(t, today))
  const smart = [
    {
      id: 'today',
      name: '我的一天',
      icon: 'Sun',
      count: pending.filter(
        (t) => occursOn(t, today) || (t.repeat === 'none' && t.dueDate && t.dueDate < today),
      ).length,
    },
    { id: 'upcoming', name: '最近七天', icon: 'CalendarDays' },
    { id: 'all', name: '全部事项', icon: 'Layers', count: pending.length },
    {
      id: 'inbox',
      name: '收集箱',
      icon: 'Inbox',
      count: pending.filter((t) => t.listId === 'inbox').length,
    },
  ]
  const list = (l: AppData['lists'][number]) => (
    <div key={l.id} className={`side-row-wrap ${active('list', l.id) ? 'active' : ''}`}>
      <button className="side-row" onClick={() => onFilter({ kind: 'list', id: l.id })}>
        <Icon name={l.icon} size={17} style={{ color: l.color }} />
        <span>{l.name}</span>
        <small>{pending.filter((t) => t.listId === l.id).length || ''}</small>
      </button>
      <button
        className="row-edit icon-button"
        aria-label={`编辑清单 ${l.name}`}
        onClick={() => onEntity('list', l)}
      >
        <Icon name="MoreHorizontal" size={15} />
      </button>
    </div>
  )
  return (
    <aside className="sidebar">
      <div className="workspace-name">
        <div className="workspace-avatar">
          <Icon name="Leaf" size={17} />
        </div>
        <div>
          <strong>我的生活空间</strong>
          <span>一点一滴，井井有条</span>
        </div>
        <Icon name="ChevronDown" size={14} />
      </div>
      <nav className="smart-nav" aria-label="待办视图">
        {smart.map((s) => (
          <button
            key={s.id}
            className={`side-row ${active('smart', s.id) ? 'active' : ''}`}
            onClick={() => onFilter({ kind: 'smart', id: s.id as 'today' })}
          >
            <Icon name={s.icon} size={18} />
            <span>{s.name}</span>
            {s.count !== undefined && <small>{s.count}</small>}
          </button>
        ))}
      </nav>
      <div className="sidebar-scroll">
        <div className="sidebar-section-heading">
          <span>我的清单</span>
          <button
            className="icon-button"
            aria-label="新建清单或文件夹"
            title="新建清单或文件夹"
            onClick={() => onEntity('list')}
          >
            <Icon name="Plus" size={16} />
          </button>
        </div>
        <div className="list-tree">
          {data.lists.filter((l) => !l.folderId && l.id !== 'inbox').map(list)}
          {data.folders.map((folder) => (
            <div className="folder-group" key={folder.id}>
              <div className="folder-heading">
                <button onClick={() => onCollapse(folder.id)}>
                  <Icon name={folder.collapsed ? 'ChevronRight' : 'ChevronDown'} size={12} />
                  <Icon name={folder.icon} size={15} style={{ color: folder.color }} />
                  <span>{folder.name}</span>
                </button>
                <button
                  className="icon-button row-edit"
                  aria-label={`编辑文件夹 ${folder.name}`}
                  onClick={() => onEntity('folder', folder)}
                >
                  <Icon name="MoreHorizontal" size={14} />
                </button>
              </div>
              {!folder.collapsed && (
                <div className="folder-lists">
                  {data.lists.filter((l) => l.folderId === folder.id).map(list)}
                  {!data.lists.some((l) => l.folderId === folder.id) && (
                    <span className="empty-folder">还没有清单</span>
                  )}
                </div>
              )}
            </div>
          ))}
          {!data.folders.length && data.lists.length === 1 && (
            <div className="empty-folder">建立清单，整理你的日常。</div>
          )}
        </div>
        <div className="sidebar-section-heading tag-heading">
          <span>标签</span>
          <button
            className="icon-button"
            aria-label="新建标签"
            title="新建标签"
            onClick={() => onEntity('tag')}
          >
            <Icon name="Plus" size={16} />
          </button>
        </div>
        <div className="sidebar-tags">
          {data.tags.map((tag) => (
            <div key={tag.id} className={`side-row-wrap ${active('tag', tag.id) ? 'active' : ''}`}>
              <button className="side-row" onClick={() => onFilter({ kind: 'tag', id: tag.id })}>
                <Icon name="Hash" size={16} style={{ color: tag.color }} />
                <span>{tag.name}</span>
              </button>
              <button
                className="row-edit icon-button"
                aria-label={`编辑标签 ${tag.name}`}
                onClick={() => onEntity('tag', tag)}
              >
                <Icon name="MoreHorizontal" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="sidebar-bottom">
        <button
          className={`side-row ${active('smart', 'completed') ? 'active' : ''}`}
          onClick={() => onFilter({ kind: 'smart', id: 'completed' })}
        >
          <Icon name="CircleCheck" size={17} />
          <span>已完成</span>
        </button>
        <button className="side-row" onClick={onSettings}>
          <Icon name="Settings2" size={17} />
          <span>设置与数据</span>
        </button>
        <div className="local-indicator">
          <i />
          本地存储 · 专注你的生活
        </div>
      </div>
    </aside>
  )
}
