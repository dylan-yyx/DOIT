import { useState } from 'react'
import type { AppData, Folder, TaskList, Tag } from '../core/types'
import Modal from './Modal'
import Icon, { colors, editableIcons } from './Icon'
export type EntityKind = 'list' | 'folder' | 'tag'
export type Entity = TaskList | Folder | Tag
export default function EntityEditor({
  kind: initialKind,
  initial,
  data,
  onSave,
  onDelete,
  onClose,
}: {
  kind: EntityKind
  initial?: Entity
  data: AppData
  onSave: (kind: EntityKind, value: Entity) => void
  onDelete: (kind: EntityKind, value: Entity) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState(initialKind),
    [name, setName] = useState(initial?.name || ''),
    [icon, setIcon] = useState(initial && 'icon' in initial ? initial.icon : 'List'),
    [color, setColor] = useState(initial?.color || colors[0]),
    [folderId, setFolderId] = useState(
      initial && 'folderId' in initial ? initial.folderId || '' : '',
    )
  const label = kind === 'list' ? '清单' : kind === 'folder' ? '文件夹' : '标签'
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const value = {
      id: initial?.id || crypto.randomUUID(),
      name: name.trim(),
      color,
      ...(kind !== 'tag' ? { icon } : {}),
      ...(kind === 'list' && folderId ? { folderId } : {}),
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
        {!initial && (
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
        <div className="entity-preview" style={{ color, background: `${color}10` }}>
          <Icon name={kind === 'tag' ? 'Hash' : icon} size={28} />
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
        <div>
          <div className="field-label">颜色</div>
          <div className="color-picker">
            {colors.map((c) => (
              <button
                type="button"
                key={c}
                style={{ background: c }}
                className={c === color ? 'selected' : ''}
                aria-label={`颜色 ${c}`}
                onClick={() => setColor(c)}
              >
                {c === color && <Icon name="Check" size={15} />}
              </button>
            ))}
          </div>
        </div>
        {kind !== 'tag' && (
          <div>
            <div className="field-label">图标</div>
            <div className="icon-picker">
              {editableIcons.map((i) => (
                <button
                  type="button"
                  key={i}
                  className={i === icon ? 'selected' : ''}
                  aria-label={`图标 ${i}`}
                  onClick={() => setIcon(i)}
                  style={i === icon ? { color, background: `${color}15` } : undefined}
                >
                  <Icon name={i} size={21} />
                </button>
              ))}
            </div>
          </div>
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
