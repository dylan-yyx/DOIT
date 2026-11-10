import { useState, type CSSProperties } from 'react'
import type { AppData, Task } from '../../core/types'
import { dateKey } from '../../core/dates'
import { checksFor, isCompleted, progressInfo, progressValue, repeatNames } from './logic'
import { taskScheduleLabel } from './schedule-labels'
import Icon from '../../components/Icon'
import InlineTaskTitle from './InlineTaskTitle'
import { number } from './TaskDetail'
import { useReorderDrag } from './useReorderDrag'
import type { DropSide } from './order'

export interface TaskRow {
  task: Task
  day: string
}

export default function TaskListView({
  rows,
  data,
  selectedId,
  onSelect,
  onToggle,
  onRename,
  onCreate,
  onQuickCreate,
  showCompleted,
  searching,
  groupByList,
  onReorder,
}: {
  rows: TaskRow[]
  data: AppData
  selectedId: string | null
  onSelect: (id: string, day: string) => void
  onToggle: (task: Task, day: string) => void
  onRename: (id: string, title: string) => void
  onCreate: () => void
  onQuickCreate: (title: string) => void
  showCompleted: boolean
  searching: boolean
  groupByList: boolean
  onReorder?: (source: string, target: string, side: DropSide) => void
}) {
  const [quick, setQuick] = useState('')
  const today = dateKey()
  const visible = showCompleted ? rows : rows.filter(({ task, day }) => !isCompleted(task, day))
  const reorder = useReorderDrag((source, target, side) => onReorder?.(source, target, side))
  const rowOrder = onReorder ? [...new Set(visible.map(({ task }) => task.id))] : []
  const groups = new Map<string, TaskRow[]>()
  if (groupByList) {
    for (const item of visible) {
      const group = groups.get(item.task.listId)
      if (group) group.push(item)
      else groups.set(item.task.listId, [item])
    }
  }

  function row({ task, day }: TaskRow) {
    const done = isCompleted(task, day)
    const progress = task.kind === 'progress'
    const overdue = !done && task.repeat === 'none' && task.dueDate && task.dueDate < today
    const actual = progress ? progressValue(task) : 0
    const delta = progress ? progressInfo(task, today).delta : 0
    const pace = done || Math.abs(delta) < 1e-9 ? '持平' : delta < 0 ? '落后' : '领先'
    const schedule = taskScheduleLabel(task, day)
    const tags = data.tags.filter((tag) => task.tagIds.includes(tag.id)).map((tag) => tag.name)

    return (
      <div
        key={`${task.id}-${day}`}
        data-task-id={task.id}
        className={`task-row ${selectedId === task.id ? 'selected' : ''} ${done ? 'task-done' : ''} ${progress ? 'progress-task-row' : ''}`}
        style={
          progress
            ? ({ '--row-progress': `${(actual / task.total) * 100}%` } as CSSProperties)
            : undefined
        }
        onClick={() => onSelect(task.id, day)}
        {...(onReorder && reorder.target(task.id))}
      >
        {onReorder && (
          <button
            type="button"
            className="sort-handle"
            aria-label={`排序事项 ${task.title}`}
            title="拖动排序 · Alt + ↑ / ↓"
            {...reorder.handle(task.id, rowOrder)}
          >
            <Icon name="GripVertical" size={13} />
          </button>
        )}
        <button
          className={`task-checkbox ${done ? 'checked' : ''} ${progress ? 'progress-checkbox' : ''}`}
          aria-label={
            progress ? `查看进度 ${task.title}` : `${done ? '重新打开' : '完成'} ${task.title}`
          }
          onClick={(event) => {
            event.stopPropagation()
            onSelect(task.id, day)
            if (!progress) onToggle(task, day)
          }}
        >
          {done ? (
            <Icon name="Check" size={13} />
          ) : progress ? (
            <Icon name="ChartNoAxesCombined" size={13} />
          ) : null}
        </button>
        <div className="task-row-title">
          <InlineTaskTitle
            title={task.title}
            onRename={(title) => onRename(task.id, title)}
            onOpen={() => onSelect(task.id, day)}
          />
        </div>
        <div className="task-row-meta">
          {task.priority !== 'none' && (
            <span title={`${{ high: '高', medium: '中', low: '低' }[task.priority]}优先级`}>
              <Icon name="Flag" size={12} className={`priority-${task.priority}`} />
            </span>
          )}
          {task.repeat !== 'none' && (
            <span title={repeatNames[task.repeat]}>
              <Icon name="Repeat2" size={12} />
            </span>
          )}
          {tags.length > 0 && (
            <span title={tags.join('、')}>
              <Icon name="Hash" size={12} />
            </span>
          )}
          {progress ? (
            <>
              <span
                className="task-row-count"
                title={`${number(actual)}/${number(task.total)} ${task.unit}`}
              >
                {number(actual)}/{number(task.total)}
                {task.unit}
              </span>
              {!done && (
                <span className={pace === '落后' ? 'behind-text' : 'on-track-text'}>{pace}</span>
              )}
            </>
          ) : (
            task.checklist.length > 0 && (
              <span className="task-row-count" title="检查事项完成度">
                {checksFor(task, day).length}/{task.checklist.length}
              </span>
            )
          )}
          <span className={`task-row-schedule ${overdue ? 'overdue-label' : ''}`} title={schedule}>
            {schedule}
          </span>
        </div>
        <button
          className="icon-button task-row-more"
          aria-label={`查看 ${task.title}`}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(task.id, day)
          }}
        >
          <Icon name="ChevronRight" size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="task-list-view">
      <form
        className="quick-add"
        onSubmit={(event) => {
          event.preventDefault()
          if (quick.trim()) {
            onQuickCreate(quick.trim())
            setQuick('')
          }
        }}
      >
        <Icon name="Plus" size={18} />
        <input
          aria-label="快速添加事项"
          placeholder="添加一个待办，开启有序的一天"
          value={quick}
          onChange={(event) => setQuick(event.target.value)}
          maxLength={200}
        />
        {quick ? (
          <button type="submit" className="quick-submit" title="添加事项">
            <Icon name="ArrowUpRight" size={17} />
          </button>
        ) : (
          <kbd>Enter ↵</kbd>
        )}
      </form>
      {groupByList
        ? data.lists.map((list) => {
            const group = groups.get(list.id)
            return (
              group && (
                <section className="task-group" key={list.id} aria-label={list.name}>
                  <div className="task-group-heading">
                    <h3 className="task-list-label">
                      <Icon name={list.icon} size={13} style={{ color: list.color }} />
                      {list.name}
                      <span>{group.length}</span>
                    </h3>
                  </div>
                  {group.map(row)}
                </section>
              )
            )
          })
        : visible.map(row)}
      {!visible.length && (
        <div className="empty-state">
          <div className="empty-illustration">
            <Icon name={searching ? 'Search' : 'Leaf'} size={34} />
            <i />
            <i />
          </div>
          <h3>
            {searching ? '没有找到相关事项' : rows.length ? '已完成事项已隐藏' : '这里还没有事项'}
          </h3>
          <p>{searching ? '试试其他关键词。' : '可以快速添加，或新建事项设置日期与时间。'}</p>
          {!searching && (
            <button className="button secondary" onClick={onCreate}>
              <Icon name="Plus" size={15} />
              新建事项
            </button>
          )}
        </div>
      )}
    </div>
  )
}
