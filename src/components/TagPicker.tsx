import { useState } from 'react'
import type { AppData } from '../core/types'
import Icon from './Icon'

export default function TagPicker({
  data,
  selected,
  onChange,
}: {
  data: AppData
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('__all')
  const filtered = data.tags.filter(
    (t) =>
      t.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (group === '__all' || (t.groupId || '') === group),
  )
  return (
    <div className="task-tag-picker">
      {(data.tags.length > 6 || !!data.tagGroups?.length) && (
        <div className="task-tag-filters">
          <input
            aria-label="搜索可选标签"
            placeholder="搜索标签"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="可选标签分组"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="__all">全部分组</option>
            <option value="">未分组</option>
            {data.tagGroups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {selected.length > 0 && <p className="task-tag-count">已选 {selected.length} 个标签</p>}
      <div className="tag-picker">
        {filtered.map((tag) => (
          <button
            type="button"
            key={tag.id}
            className={selected.includes(tag.id) ? 'tag-option selected' : 'tag-option'}
            aria-pressed={selected.includes(tag.id)}
            style={{ '--tag-color': tag.color } as React.CSSProperties}
            onClick={() =>
              onChange(
                selected.includes(tag.id)
                  ? selected.filter((id) => id !== tag.id)
                  : [...selected, tag.id],
              )
            }
          >
            <Icon name="Hash" size={13} />
            {tag.name}
            {selected.includes(tag.id) && <Icon name="Check" size={12} />}
          </button>
        ))}
        {!filtered.length && (
          <span className="muted">
            {data.tags.length ? '没有匹配的标签' : '可在侧边栏或待办设置中添加标签'}
          </span>
        )}
      </div>
    </div>
  )
}
