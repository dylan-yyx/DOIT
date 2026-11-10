import { useMemo, useState } from 'react'
import type { AppData, Tag, TagGroup } from '../core/types'
import { deleteTagGroup, deleteTags, patchTags, saveTag, saveTagGroup } from '../modules/tasks/tags'
import Icon, { colors } from './Icon'
import { ColorPicker } from './StylePicker'

export default function TagManager({
  data,
  onChange,
  onViewTag,
}: {
  data: AppData
  onChange: (fn: (data: AppData) => AppData) => void
  onViewTag: (id: string) => void
}) {
  const groups = data.tagGroups || []
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('__all')
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<Tag | null>(null)
  const [manageGroups, setManageGroups] = useState(false)
  const [groupDraft, setGroupDraft] = useState<TagGroup | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<{ kind: 'tags' | 'group'; ids: string[] } | null>(null)
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const task of data.tasks) for (const id of task.tagIds) result[id] = (result[id] || 0) + 1
    return result
  }, [data.tasks])
  const filtered = data.tags.filter(
    (tag) =>
      tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (groupFilter === '__all' || (tag.groupId || '') === groupFilter) &&
      (!pinnedOnly || tag.pinned),
  )
  const selectedIds = selected.filter((id) => data.tags.some((tag) => tag.id === id))
  function apply(fn: (data: AppData) => AppData) {
    try {
      fn(data)
      onChange(fn)
      setError('')
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  function beginTag(tag?: Tag) {
    setEditing(
      tag
        ? { ...tag }
        : {
            id: crypto.randomUUID(),
            name: '',
            color: colors[0],
            groupId: groupFilter === '__all' ? '' : groupFilter,
            pinned: false,
          },
    )
    setError('')
    setConfirm(null)
  }
  return (
    <div className="tag-manager">
      <div className="tag-manager-heading">
        <div>
          <h3>
            标签管理{' '}
            <small>
              {data.tags.length} 个标签 · {groups.length} 个分组
            </small>
          </h3>
          <p>用分组整理标签，只把常用标签固定到左侧栏。</p>
        </div>
        <div className="tag-heading-actions">
          <button
            className="button secondary"
            aria-expanded={manageGroups}
            onClick={() => {
              setManageGroups(!manageGroups)
              setError('')
            }}
          >
            <Icon name="Folder" size={14} />
            管理分组
          </button>
          <button className="button primary" onClick={() => beginTag()}>
            <Icon name="Plus" size={14} />
            新建标签
          </button>
        </div>
      </div>
      {manageGroups && (
        <section className="tag-group-manager" aria-label="管理标签分组">
          <div className="tag-group-heading">
            <strong>标签分组</strong>
            <button
              className="text-button"
              onClick={() => {
                setGroupDraft({ id: crypto.randomUUID(), name: '' })
                setError('')
              }}
            >
              <Icon name="Plus" size={13} />
              新建分组
            </button>
          </div>
          {groups.length ? (
            <div className="tag-group-chips">
              {groups.map((group) => (
                <div key={group.id}>
                  <Icon name="Folder" size={14} />
                  <span>{group.name}</span>
                  <small>{data.tags.filter((t) => t.groupId === group.id).length}</small>
                  <button
                    aria-label={`编辑分组 ${group.name}`}
                    onClick={() => {
                      setGroupDraft({ ...group })
                      setError('')
                    }}
                  >
                    <Icon name="Pencil" size={12} />
                  </button>
                  <button
                    aria-label={`删除分组 ${group.name}`}
                    onClick={() => setConfirm({ kind: 'group', ids: [group.id] })}
                  >
                    <Icon name="Trash2" size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="tag-help">还没有分组。可以创建“书籍”“影视”等分组，再把标签放进去。</p>
          )}
          {groupDraft && (
            <form
              className="tag-group-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (apply((d) => saveTagGroup(d, groupDraft))) setGroupDraft(null)
              }}
            >
              <input
                aria-label="分组名称"
                placeholder="例如：书籍"
                maxLength={30}
                autoFocus
                required
                value={groupDraft.name}
                onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })}
              />
              <button className="button primary" type="submit">
                保存分组
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setGroupDraft(null)
                  setError('')
                }}
              >
                取消
              </button>
            </form>
          )}
        </section>
      )}
      {editing && (
        <form
          className="tag-edit-form task-form"
          aria-label="标签编辑"
          onSubmit={(e) => {
            e.preventDefault()
            if (apply((d) => saveTag(d, editing))) setEditing(null)
          }}
        >
          <div className="tag-edit-heading">
            <strong>{data.tags.some((t) => t.id === editing.id) ? '编辑标签' : '新建标签'}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="取消编辑标签"
              onClick={() => {
                setEditing(null)
                setError('')
              }}
            >
              <Icon name="X" size={16} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              标签名称
              <input
                required
                autoFocus
                maxLength={40}
                placeholder="例如：文学"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              所属分组
              <select
                aria-label="所属分组"
                value={editing.groupId || ''}
                onChange={(e) => setEditing({ ...editing, groupId: e.target.value })}
              >
                <option value="">未分组</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ColorPicker
            label="标签颜色"
            value={editing.color}
            onChange={(color) => setEditing({ ...editing, color })}
          />
          <div className="tag-edit-options">
            <label className="tag-checkbox">
              <input
                type="checkbox"
                checked={!!editing.pinned}
                onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
              />
              固定到左侧栏
            </label>
            <button className="button primary" type="submit">
              保存标签
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {confirm && (
        <div className="tag-confirm" role="alert">
          <div>
            <strong>
              {confirm.kind === 'tags' ? `删除 ${confirm.ids.length} 个标签？` : '删除这个分组？'}
            </strong>
            <p>
              {confirm.kind === 'tags'
                ? '事项会保留，只移除这些标签及其关联。'
                : '标签会保留并移至“未分组”。'}
            </p>
          </div>
          <button className="button secondary" onClick={() => setConfirm(null)}>
            取消
          </button>
          <button
            className="button danger-button"
            onClick={() => {
              if (confirm.kind === 'tags') {
                onChange((d) => deleteTags(d, confirm.ids))
                setSelected((ids) => ids.filter((id) => !confirm.ids.includes(id)))
                if (editing && confirm.ids.includes(editing.id)) setEditing(null)
              } else {
                onChange((d) => deleteTagGroup(d, confirm.ids[0]))
                if (groupFilter === confirm.ids[0]) setGroupFilter('__all')
                if (editing?.groupId === confirm.ids[0]) setEditing({ ...editing, groupId: '' })
                if (groupDraft?.id === confirm.ids[0]) setGroupDraft(null)
              }
              setConfirm(null)
              setError('')
            }}
          >
            确认删除
          </button>
        </div>
      )}
      <div className="tag-manager-filters">
        <div className="tag-search">
          <Icon name="Search" size={15} />
          <input
            aria-label="搜索标签"
            placeholder="搜索标签名称"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="清空标签搜索" onClick={() => setQuery('')}>
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
        <select
          aria-label="按标签分组筛选"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="__all">全部分组</option>
          <option value="">未分组</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <label className="tag-checkbox">
          <input
            type="checkbox"
            checked={pinnedOnly}
            onChange={(e) => setPinnedOnly(e.target.checked)}
          />
          仅看固定
        </label>
      </div>
      {selectedIds.length > 0 && (
        <div className="tag-batch" aria-label="批量管理标签">
          <strong>已选 {selectedIds.length} 个</strong>
          <select
            aria-label="批量移至分组"
            value="__choose"
            onChange={(e) =>
              onChange((d) => patchTags(d, selectedIds, { groupId: e.target.value }))
            }
          >
            <option disabled value="__choose">
              移至分组…
            </option>
            <option value="">未分组</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button onClick={() => onChange((d) => patchTags(d, selectedIds, { pinned: true }))}>
            固定到侧栏
          </button>
          <button onClick={() => onChange((d) => patchTags(d, selectedIds, { pinned: false }))}>
            取消固定
          </button>
          <button className="danger" onClick={() => setConfirm({ kind: 'tags', ids: selectedIds })}>
            删除所选
          </button>
          <button onClick={() => setSelected([])}>取消选择</button>
        </div>
      )}
      <div className="tag-table-wrap">
        <table className="tag-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="选择当前筛选的全部标签"
                  checked={filtered.length > 0 && filtered.every((t) => selectedIds.includes(t.id))}
                  disabled={!filtered.length}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...new Set([...selectedIds, ...filtered.map((t) => t.id)])]
                        : selectedIds.filter((id) => !filtered.some((t) => t.id === id)),
                    )
                  }
                />
              </th>
              <th>标签</th>
              <th>分组</th>
              <th>事项</th>
              <th>侧栏</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tag) => (
              <tr key={tag.id} data-testid={`tag-row-${tag.id}`}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`选择标签 ${tag.name}`}
                    checked={selectedIds.includes(tag.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selectedIds, tag.id]
                          : selectedIds.filter((id) => id !== tag.id),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    className="tag-name-link"
                    title="查看关联事项"
                    onClick={() => onViewTag(tag.id)}
                  >
                    <Icon name="Hash" size={15} style={{ color: tag.color }} />
                    <span>{tag.name}</span>
                  </button>
                </td>
                <td>
                  <select
                    aria-label={`${tag.name}的分组`}
                    value={tag.groupId || ''}
                    onChange={(e) =>
                      onChange((d) => patchTags(d, [tag.id], { groupId: e.target.value }))
                    }
                  >
                    <option value="">未分组</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className="tag-task-count">{counts[tag.id] || 0}</span>
                </td>
                <td>
                  <button
                    className={`tag-pin ${tag.pinned ? 'pinned' : ''}`}
                    aria-label={`${tag.pinned ? '取消固定' : '固定'}标签 ${tag.name}`}
                    aria-pressed={!!tag.pinned}
                    onClick={() => onChange((d) => patchTags(d, [tag.id], { pinned: !tag.pinned }))}
                  >
                    <Icon name="Pin" size={15} />
                  </button>
                </td>
                <td>
                  <div className="tag-row-actions">
                    <button
                      className="icon-button"
                      aria-label={`编辑标签 ${tag.name}`}
                      onClick={() => beginTag(tag)}
                    >
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`删除标签 ${tag.name}`}
                      onClick={() => setConfirm({ kind: 'tags', ids: [tag.id] })}
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="tag-empty">
            <Icon name="Tags" size={30} />
            <h4>{data.tags.length ? '没有找到匹配的标签' : '从第一个标签开始'}</h4>
            <p>
              {data.tags.length
                ? '试试其他关键词或分组。'
                : '建立书籍、影视等分组，再添加文学、科幻等标签。'}
            </p>
            {!data.tags.length && (
              <button className="button secondary" onClick={() => beginTag()}>
                添加第一个标签
              </button>
            )}
          </div>
        )}
      </div>
      <p className="tag-help">
        <Icon name="Pin" size={12} />
        固定的标签显示在左侧栏；其余标签可在这里搜索，也可在新建事项时选择。
      </p>
    </div>
  )
}
