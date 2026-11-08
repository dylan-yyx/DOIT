import { useState } from 'react'
import type { AppData, Task } from '../../core/types'
import { dateKey, friendlyDate } from '../../core/dates'
import { checksFor, isCompleted, progressInfo, progressValue } from './logic'
import Icon from '../../components/Icon'
import { number } from './TaskDetail'
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
  onCreate,
  onQuickCreate,
  showCompleted,
  searching,
  heading,
}: {
  rows: TaskRow[]
  data: AppData
  selectedId: string | null
  onSelect: (id: string, day: string) => void
  onToggle: (task: Task, day: string) => void
  onCreate: () => void
  onQuickCreate: (title: string) => void
  showCompleted: boolean
  searching: boolean
  heading: string
}) {
  const [quick, setQuick] = useState(''),
    [expanded, setExpanded] = useState(true),
    today = dateKey()
  const pending = rows.filter((r) => !isCompleted(r.task, r.day)),
    completed = rows.filter((r) => isCompleted(r.task, r.day)),
    overdue = pending.filter(
      (r) => r.task.repeat === 'none' && r.task.dueDate && r.task.dueDate < today,
    ),
    progress = pending.filter((r) => !overdue.includes(r) && r.task.kind === 'progress'),
    normal = pending.filter((r) => !overdue.includes(r) && r.task.kind !== 'progress')
  function row({ task, day }: TaskRow) {
    const list = data.lists.find((l) => l.id === task.listId)!,
      done = isCompleted(task, day),
      info = progressInfo(task),
      checks = checksFor(task, day)
    return (
      <div
        key={`${task.id}-${day}`}
        data-task-id={task.id}
        className={`task-row ${selectedId === task.id ? 'selected' : ''} ${done ? 'task-done' : ''} ${task.kind === 'progress' ? 'progress-task-row' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(task.id, day)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onSelect(task.id, day)
          }
        }}
      >
        <button
          className={`task-checkbox ${done ? 'checked' : ''} ${task.kind === 'progress' ? 'progress-checkbox' : ''}`}
          aria-label={
            task.kind === 'progress'
              ? `查看进度 ${task.title}`
              : `${done ? '重新打开' : '完成'} ${task.title}`
          }
          onClick={(e) => {
            e.stopPropagation()
            task.kind === 'progress' ? onSelect(task.id, day) : onToggle(task, day)
          }}
        >
          {done ? (
            <Icon name="Check" size={13} />
          ) : task.kind === 'progress' ? (
            <Icon name="ChartNoAxesCombined" size={13} />
          ) : null}
        </button>
        <div className="task-row-content">
          <div className="task-row-title">
            <span>{task.title}</span>
            {task.priority !== 'none' && (
              <Icon name="Flag" size={13} className={`priority-${task.priority}`} />
            )}
            <button
              className="icon-button task-row-more"
              aria-label={`查看 ${task.title}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(task.id, day)
              }}
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
          <div className="task-row-meta">
            <span className="task-list-label">
              <Icon name={list.icon} size={12} style={{ color: list.color }} />
              {list.name}
            </span>
            {task.timeMode !== 'allday' && (
              <span>
                <Icon name="Clock3" size={12} />
                {task.startTime}
                {task.timeMode === 'range' ? ` – ${task.endTime}` : ''}
              </span>
            )}
            {task.repeat !== 'none' && (
              <span title="重复事项">
                <Icon name="Repeat2" size={12} />
              </span>
            )}
            {task.checklist.length > 0 && (
              <span>
                <Icon name="CheckSquare2" size={12} />
                {checks.length}/{task.checklist.length}
              </span>
            )}
            {task.tagIds.slice(0, 2).map((id) => {
              const tag = data.tags.find((t) => t.id === id)
              return tag ? (
                <span className="row-tag" style={{ color: tag.color }} key={id}>
                  # {tag.name}
                </span>
              ) : null
            })}
            {day !== today && (
              <span className={day < today && !done ? 'overdue-label' : ''}>
                {friendlyDate(day)}
              </span>
            )}
          </div>
          {task.kind === 'progress' && (
            <div className="row-progress">
              <div>
                <div className="progress-track">
                  <span style={{ width: `${(progressValue(task) / task.total) * 100}%` }} />
                  <i style={{ left: `${Math.min(99, info.expectedRatio * 100)}%` }} />
                </div>
                <span>
                  {number(progressValue(task))} / {task.total} {task.unit}
                </span>
              </div>
              <small className={info.delta < 0 ? 'behind-text' : 'on-track-text'}>
                <i />
                {done
                  ? '目标已完成'
                  : info.delta < 0
                    ? `落后计划 ${number(-info.delta)} ${task.unit}`
                    : info.delta > 0
                      ? `超前计划 ${number(info.delta)} ${task.unit}`
                      : '与计划一致'}
              </small>
            </div>
          )}
        </div>
      </div>
    )
  }
  function group(title: string, items: TaskRow[], className = '') {
    return (
      items.length > 0 && (
        <section className={`task-group ${className}`}>
          <div className="task-group-heading">
            <h3>
              {title}
              <span>{items.length}</span>
            </h3>
            {title === '持续推进' && <span className="group-hint">每天一点，离目标近一点</span>}
          </div>
          {items.map(row)}
        </section>
      )
    )
  }
  return (
    <div className="task-list-view">
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
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
          onChange={(e) => setQuick(e.target.value)}
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
      {group('已逾期', overdue, 'overdue-group')}
      {group('持续推进', progress)}
      {group(heading, normal)}
      {!pending.length && !completed.length && (
        <div className="empty-state">
          <div className="empty-illustration">
            <Icon name={searching ? 'Search' : 'Leaf'} size={34} />
            <i />
            <i />
          </div>
          <h3>{searching ? '没有找到相关事项' : '给今天，留一点期待'}</h3>
          <p>
            {searching ? '试试其他关键词，或查看全部事项。' : '从一件小事开始，让想法慢慢落地。'}
          </p>
          {!searching && (
            <button className="button secondary" onClick={onCreate}>
              <Icon name="Plus" size={15} />
              新建第一个事项
            </button>
          )}
        </div>
      )}
      {showCompleted && completed.length > 0 && (
        <section className="task-group completed-group">
          <button className="completed-heading" onClick={() => setExpanded(!expanded)}>
            <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={14} />
            <h3>
              已完成<span>{completed.length}</span>
            </h3>
            <span className="completed-note">每一件小事，都算数</span>
          </button>
          {expanded && completed.map(row)}
        </section>
      )}
      {pending.length > 0 && (
        <div className="list-end">
          <span />
          按自己的节奏，慢慢来
          <span />
        </div>
      )}
    </div>
  )
}
