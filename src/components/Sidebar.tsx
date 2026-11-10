import { useId, useRef } from 'react'
import type { AppData, Filter } from '../core/types'
import { dateKey } from '../core/dates'
import { isCompleted, occursOn } from '../modules/tasks/logic'
import { moveSidebarEntry, sidebarRoots } from '../modules/tasks/order'
import { useReorderDrag } from '../modules/tasks/useReorderDrag'
import type { EntityDraft } from './EntityEditor'
import Icon from './Icon'
import WorkspaceName from './WorkspaceName'

function FolderActions({
  name,
  onEdit,
  onAdd,
}: {
  name: string
  onEdit: () => void
  onAdd: () => void
}) {
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  return (
    <>
      <button
        type="button"
        className="icon-button folder-menu-trigger"
        aria-label={`文件夹操作 ${name}`}
        title="文件夹操作"
        popoverTarget={id}
      >
        <Icon name="MoreHorizontal" size={15} />
      </button>
      <div
        className="folder-menu"
        id={id}
        ref={menu}
        popover="auto"
        role="group"
        aria-label={`${name}的操作`}
      >
        <button
          type="button"
          onClick={() => {
            menu.current?.hidePopover()
            onEdit()
          }}
        >
          <Icon name="Pencil" size={14} />
          编辑文件夹
        </button>
        <button
          type="button"
          onClick={() => {
            menu.current?.hidePopover()
            onAdd()
          }}
        >
          <Icon name="Plus" size={14} />
          添加新清单
        </button>
      </div>
    </>
  )
}

export default function Sidebar({
  data,
  width,
  filter,
  onFilter,
  onEntity,
  onCollapse,
  onSettings,
  onManageTags,
  onChange,
}: {
  data: AppData
  width: number
  filter: Filter
  onFilter: (f: Filter) => void
  onEntity: (draft: EntityDraft) => void
  onCollapse: (id: string) => void
  onSettings: () => void
  onManageTags: () => void
  onChange: (fn: (data: AppData) => AppData) => void
}) {
  const reorder = useReorderDrag((source, target, side) =>
    onChange((current) => moveSidebarEntry(current, source, target, side)),
  )
  const roots = sidebarRoots(data)
  const rootKeys = roots.map(({ kind, item }) => `${kind}:${item.id}`)
  const movingList = reorder.source.startsWith('list:')
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
  const list = (l: AppData['lists'][number], siblings: string[]) => (
    <div
      key={`list:${l.id}`}
      data-sidebar-key={`list:${l.id}`}
      className={`side-row-wrap sortable-sidebar-row ${active('list', l.id) ? 'active' : ''}`}
      {...reorder.target(`list:${l.id}`, { accepts: !l.folderId || movingList })}
    >
      <button
        type="button"
        className="sort-handle"
        aria-label={`排序清单 ${l.name}`}
        title="拖动排序 · Alt + ↑ / ↓"
        {...reorder.handle(`list:${l.id}`, siblings)}
      >
        <Icon name="GripVertical" size={12} />
      </button>
      <button className="side-row" onClick={() => onFilter({ kind: 'list', id: l.id })}>
        <Icon name={l.icon} size={17} style={{ color: l.color }} />
        <span>{l.name}</span>
        <small>{pending.filter((t) => t.listId === l.id).length || ''}</small>
      </button>
      <button
        className="row-edit icon-button"
        aria-label={`编辑清单 ${l.name}`}
        onClick={() => onEntity({ kind: 'list', initial: l })}
      >
        <Icon name="MoreHorizontal" size={15} />
      </button>
    </div>
  )
  return (
    <aside className="sidebar task-sidebar" style={{ width }}>
      <WorkspaceName
        name={data.preferences.name}
        subtitle="一点一滴，井井有条"
        onChange={onChange}
      />
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
            onClick={() => onEntity({ kind: 'list' })}
          >
            <Icon name="Plus" size={16} />
          </button>
        </div>
        <div className="list-tree">
          {roots.map(({ kind, item }) => {
            if (kind === 'list') return list(item, rootKeys)
            const folder = item
            const children = data.lists.filter((l) => l.folderId === folder.id)
            const childKeys = children.map((l) => `list:${l.id}`)
            return (
              <div className="folder-group" key={`folder:${folder.id}`}>
                <div
                  className="folder-heading"
                  data-sidebar-key={`folder:${folder.id}`}
                  {...reorder.target(`folder:${folder.id}`, { inside: movingList })}
                >
                  <button aria-expanded={!folder.collapsed} onClick={() => onCollapse(folder.id)}>
                    <Icon name={folder.collapsed ? 'ChevronRight' : 'ChevronDown'} size={12} />
                    <Icon name={folder.icon} size={15} style={{ color: folder.color }} />
                    <span>{folder.name}</span>
                  </button>
                  <button
                    type="button"
                    className="sort-handle"
                    aria-label={`排序文件夹 ${folder.name}`}
                    title="拖动排序 · Alt + ↑ / ↓"
                    {...reorder.handle(`folder:${folder.id}`, rootKeys)}
                  >
                    <Icon name="GripVertical" size={12} />
                  </button>
                  <FolderActions
                    name={folder.name}
                    onEdit={() => onEntity({ kind: 'folder', initial: folder })}
                    onAdd={() => onEntity({ kind: 'list', folderId: folder.id })}
                  />
                </div>
                {!folder.collapsed && (
                  <div className="folder-lists">
                    {children.map((l) => list(l, childKeys))}
                    {!children.length && <span className="empty-folder">还没有清单</span>}
                  </div>
                )}
              </div>
            )
          })}
          {movingList && (
            <div className="sidebar-root-drop" {...reorder.target('root', { append: true })}>
              拖到这里移至外层
            </div>
          )}
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
            onClick={() => onEntity({ kind: 'tag' })}
          >
            <Icon name="Plus" size={16} />
          </button>
        </div>
        <div className="sidebar-tags">
          {data.tags
            .filter((tag) => tag.pinned || active('tag', tag.id))
            .map((tag) => (
              <div
                key={tag.id}
                className={`side-row-wrap ${active('tag', tag.id) ? 'active' : ''}`}
              >
                <button className="side-row" onClick={() => onFilter({ kind: 'tag', id: tag.id })}>
                  <Icon name="Hash" size={16} style={{ color: tag.color }} />
                  <span>{tag.name}</span>
                  {!tag.pinned && <small title="当前筛选，未固定到侧栏">当前</small>}
                </button>
                <button
                  className="row-edit icon-button"
                  aria-label={`编辑标签 ${tag.name}`}
                  onClick={() => onEntity({ kind: 'tag', initial: tag })}
                >
                  <Icon name="MoreHorizontal" size={14} />
                </button>
              </div>
            ))}
          {!data.tags.some((tag) => tag.pinned || active('tag', tag.id)) && (
            <p className="sidebar-tag-hint">将常用标签固定在这里。</p>
          )}
          <button
            className="side-row manage-tags-entry"
            aria-label="管理标签"
            onClick={onManageTags}
          >
            <Icon name="Tags" size={16} />
            <span>管理标签</span>
            <small>{data.tags.length || ''}</small>
          </button>
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
