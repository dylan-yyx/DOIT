import { useState } from 'react'
import type { AppData, Folder, TaskList, Tag } from '../core/types'
import Modal from './Modal'
import Icon, { colors } from './Icon'
import { ColorPicker, IconPicker } from './StylePicker'
import { tagNameKey } from '../modules/tasks/notes'
export type EntityKind = 'list' | 'folder' | 'tag'
export type Entity = TaskList | Folder | Tag
export type EntityDraft = { kind: EntityKind; initial?: Entity; folderId?: string }
export default function EntityEditor({
  kind: initialKind,
  initial,
  folderId: initialFolderId,
  data,
  onSave,
  onDelete,
  onClose,
}: EntityDraft & {
  data: AppData
  onSave: (kind: EntityKind, value: Entity) => void
  onDelete: (kind: EntityKind, value: Entity) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState(initialKind),
    [name, setName] = useState(initial?.name || ''),
    [icon, setIcon] = useState(initial && 'icon' in initial ? initial.icon : ''),
    [color, setColor] = useState(initial?.color || colors[0]),
    [folderId, setFolderId] = useState(
      initial && 'folderId' in initial ? initial.folderId || '' : initialFolderId || '',
    )
  const [groupId, setGroupId] = useState(
    initial && 'groupId' in initial ? initial.groupId || '' : '',
  )
  const [pinned, setPinned] = useState(
    initial && 'pinned' in initial
      ? !!initial.pinned
      : data.tags.filter((t) => t.pinned).length < 6,
  )
  const [error, setError] = useState('')
  const label = kind === 'list' ? '清单' : kind === 'folder' ? '文件夹' : '标签'
  const selectedIcon = icon || (kind === 'folder' ? 'Folder' : 'List')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (
      kind === 'tag' &&
      data.tags.some((t) => t.id !== initial?.id && tagNameKey(t.name) === tagNameKey(name.trim()))
    ) {
      setError('已有同名标签，请直接使用或编辑现有标签。')
      return
    }
    const value = {
      id: initial?.id || crypto.randomUUID(),
      name: name.trim(),
      color,
      ...(kind !== 'tag' ? { icon: selectedIcon } : {}),
      ...(kind === 'folder' && initial && 'collapsed' in initial
        ? { collapsed: initial.collapsed }
        : {}),
      ...(kind === 'list' && folderId ? { folderId } : {}),
      ...(kind === 'tag' ? { groupId, pinned } : {}),
    }
    onSave(kind, value)
  }
  return (
    <Modal
      title={`${initial ? '编辑' : '新建'}${label}`}
      subtitle={
        kind === 'tag' ? '用标签串联不同清单中的事项。' : '为生活的不同部分，留一个专属位置。'
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="task-form">
        {!initial && !initialFolderId && (
          <div className="kind-picker">
            {(['list', 'folder', 'tag'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? 'active' : ''}
                onClick={() => setKind(k)}
              >
                <Icon name={k === 'list' ? 'List' : k === 'folder' ? 'Folder' : 'Hash'} size={16} />
                {k === 'list' ? '清单' : k === 'folder' ? '文件夹' : '标签'}
              </button>
            ))}
          </div>
        )}
        <div className="entity-preview" style={{ background: `${color}10` }}>
          <Icon name={kind === 'tag' ? 'Hash' : selectedIcon} size={28} style={{ color }} />
          <span>{name || label + '名称'}</span>
        </div>
        <label>
          {label}名称
          <input
            value={name}
            maxLength={40}
            autoFocus
            required
            placeholder={`给${label}起个名字`}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {kind === 'list' && initial?.id !== 'inbox' && (
          <label>
            所在文件夹
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">不放入文件夹</option>
              {data.folders.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <ColorPicker value={color} onChange={setColor} />
        {kind === 'tag' && (
          <>
            <label>
              所属分组
              <select
                aria-label="所属分组"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">未分组</option>
                {data.tagGroups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="tag-checkbox">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              固定到左侧栏
            </label>
          </>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {kind !== 'tag' && (
          <IconPicker kind={kind} value={selectedIcon} color={color} onChange={setIcon} />
        )}
        <div className="modal-footer">
          {initial && initial.id !== 'inbox' && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => onDelete(kind, initial)}
            >
              <Icon name="Trash2" size={15} />
              删除{label}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            保存{label}
          </button>
        </div>
      </form>
    </Modal>
  )
}
