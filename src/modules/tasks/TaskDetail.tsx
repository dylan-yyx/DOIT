import { useState } from 'react'
import type { AppData, Task } from '../../core/types'
import {
  isCompleted,
  progressInfo,
  progressValue,
  repeatNames,
  spansMultipleDays,
  type TaskDates,
} from './logic'
import type { ChecklistEdit } from './checklist'
import TaskNotes from './TaskNotes'
import TaskChecklist from './TaskChecklist'
import TaskDateEditor from './TaskDateEditor'
import InlineTaskTitle from './InlineTaskTitle'
import { taskDateLabel } from './schedule-labels'
import { dateKey, shortDate } from '../../core/dates'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
export function number(n: number) {
  return Number(n.toFixed(1)).toLocaleString('zh-CN')
}
export default function TaskDetail({
  task,
  width,
  day,
  data,
  onClose,
  onEdit,
  onDelete,
  onChange,
  onToggle,
  onCheck,
  onNotesChange,
  onChecklistEdit,
  onDateChange,
  onRename,
}: {
  task: Task
  width: number
  day: string
  data: AppData
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onChange: (t: Task) => void
  onToggle: () => void
  onCheck: (id: string) => void
  onNotesChange: (notes: string, convertTags: boolean) => void
  onChecklistEdit: (edit: ChecklistEdit) => void
  onDateChange: (dates: TaskDates) => void
  onRename: (title: string) => void
}) {
  const [logging, setLogging] = useState(false),
    [amount, setAmount] = useState('1'),
    [logDate, setLogDate] = useState(dateKey()),
    [note, setNote] = useState(''),
    [logError, setLogError] = useState(''),
    [checkRequest, setCheckRequest] = useState(0)
  const [editingDates, setEditingDates] = useState(false)
  const list = data.lists.find((l) => l.id === task.listId)!,
    info = progressInfo(task),
    done = isCompleted(task, day)
  function log(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0 || n > task.total - progressValue(task)) {
      setLogError('请输入大于 0 且不超过剩余目标的进度。')
      return
    }
    if (logDate < task.startDate || logDate > dateKey()) {
      setLogError('记录日期需在开始日期和今天之间。')
      return
    }
    onChange({
      ...task,
      entries: [
        ...task.entries,
        { id: crypto.randomUUID(), date: logDate, amount: n, note: note.trim() },
      ],
    })
    setLogging(false)
    setAmount('1')
    setNote('')
    setLogError('')
  }
  return (
    <aside className="detail-panel" style={{ width }} aria-label="事项详情">
      <div className="detail-top">
        <span>
          <i className="small-dot" style={{ background: list.color }} />
          {list.name}
        </span>
        <div>
          <button className="icon-button" title="编辑事项" aria-label="编辑事项" onClick={onEdit}>
            <Icon name="Pencil" size={16} />
          </button>
          <button className="icon-button" title="关闭详情" aria-label="关闭详情" onClick={onClose}>
            <Icon name="PanelRightClose" size={17} />
          </button>
        </div>
      </div>
      <div className="detail-content">
        <div className="detail-type">
          <Icon name={task.kind === 'progress' ? 'ChartNoAxesCombined' : 'CircleCheck'} size={14} />
          {task.kind === 'progress' ? '进度事项' : '普通事项'}
          {done && <span className="completed-badge">已完成</span>}
        </div>
        <div className="detail-title-row">
          <h2 className={done ? 'completed-title' : ''}>
            <InlineTaskTitle title={task.title} onRename={onRename} />
          </h2>
          {task.kind === 'normal' && (
            <button
              className="icon-button add-checklist-shortcut"
              aria-label="添加检查事项"
              title="添加检查事项"
              onClick={() => setCheckRequest((n) => n + 1)}
            >
              <Icon name="CheckSquare2" size={18} />
            </button>
          )}
        </div>
        <div className="detail-tags">
          {task.tagIds.map((id) => {
            const tag = data.tags.find((t) => t.id === id)
            return tag ? (
              <span
                className="tag-pill"
                key={id}
                style={{ color: tag.color, background: `${tag.color}12` }}
              >
                # {tag.name}
              </span>
            ) : null
          })}
        </div>
        <div className="detail-metadata">
          <button
            type="button"
            className="detail-date-button"
            aria-label="设置事项日期"
            onClick={() => setEditingDates(true)}
          >
            <Icon name="CalendarDays" size={16} />
            <span>日期</span>
            <strong>
              {taskDateLabel(task, day)}
              {task.repeat !== 'none' ? ' · 本次' : ''}
            </strong>
            <Icon name="Pencil" size={13} />
          </button>
          {task.timeMode !== 'allday' && (
            <div>
              <Icon name="Clock3" size={16} />
              <span>时间</span>
              <strong>
                {task.kind === 'normal' && spansMultipleDays(task)
                  ? `${shortDate(task.startDate)} ${task.startTime} — ${shortDate(task.dueDate)} ${task.endTime}`
                  : task.startTime + (task.timeMode === 'range' ? ` — ${task.endTime}` : '')}
              </strong>
            </div>
          )}
          {task.repeat !== 'none' && (
            <div>
              <Icon name="Repeat2" size={16} />
              <span>重复</span>
              <strong>{repeatNames[task.repeat]}</strong>
            </div>
          )}
          {task.priority !== 'none' && (
            <div>
              <Icon name="Flag" size={16} />
              <span>优先级</span>
              <strong className={`priority-${task.priority}`}>
                {{ high: '高', medium: '中', low: '低' }[task.priority]}优先级
              </strong>
            </div>
          )}
        </div>
        {task.kind === 'progress' && (
          <section className="detail-progress">
            <div className="section-label">
              <span>目标进度</span>
              <span className="muted">共 {info.days} 天</span>
            </div>
            <div className="progress-numbers">
              <strong>
                {number(progressValue(task))}
                <small>
                  {' '}
                  / {task.total} {task.unit}
                </small>
              </strong>
              <span>
                {Math.round((progressValue(task) / task.total) * 100)}
                <small>%</small>
              </span>
            </div>
            <div className="progress-track large">
              <span style={{ width: `${(progressValue(task) / task.total) * 100}%` }} />
              <i
                style={{ left: `${Math.min(99, info.expectedRatio * 100)}%` }}
                title="截至今天的计划进度"
              />
            </div>
            <div className="progress-legend">
              <span>
                <i />
                实际进度
              </span>
              <span>
                <i />
                计划进度 {number(info.expected)} {task.unit}
              </span>
            </div>
            <div className={`pace-message ${info.delta < 0 && !done ? 'behind' : ''}`}>
              <Icon name={done ? 'CheckCheck' : info.delta < 0 ? 'Clock3' : 'Sparkles'} size={16} />
              <div>
                <strong>
                  {done
                    ? '目标已达成，做得很好'
                    : info.delta < 0
                      ? `比计划少 ${number(-info.delta)} ${task.unit}`
                      : info.delta > 0
                        ? `比计划多 ${number(info.delta)} ${task.unit}`
                        : '刚好跟上计划'}
                </strong>
                <p>
                  每天计划 {number(info.daily)} {task.unit} · 第 {info.elapsed} / {info.days} 天
                </p>
              </div>
            </div>
            <button
              className="button primary full"
              disabled={done}
              onClick={() => {
                setLogging(true)
                setLogDate(dateKey())
                setAmount(String(Math.min(1, task.total - progressValue(task))))
              }}
            >
              <Icon name={done ? 'Check' : 'Plus'} size={16} />
              {done ? '已完成目标' : '记录进度'}
            </button>
          </section>
        )}
        <TaskNotes notes={task.notes} onChange={onNotesChange} />
        {task.kind === 'normal' && (
          <TaskChecklist
            task={task}
            day={day}
            request={checkRequest}
            onEdit={onChecklistEdit}
            onCheck={onCheck}
          />
        )}
        {task.kind === 'progress' && (
          <section className="progress-history">
            <div className="section-label">
              <span>进度记录</span>
              <span className="muted">{task.entries.length} 条</span>
            </div>
            {[...task.entries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((entry) => (
                <div className="history-item" key={entry.id}>
                  <div className="history-dot" />
                  <div>
                    <div>
                      <strong>{shortDate(entry.date)}</strong>
                      <span>
                        +{number(entry.amount)} {task.unit}
                      </span>
                    </div>
                    {entry.note && <p>{entry.note}</p>}
                  </div>
                  <button
                    className="icon-button history-delete"
                    title="删除这条记录"
                    aria-label="删除进度记录"
                    onClick={() =>
                      onChange({ ...task, entries: task.entries.filter((e) => e.id !== entry.id) })
                    }
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
              ))}
            {!task.entries.length && (
              <p className="muted empty-history">每一步小进展，都值得被记录。</p>
            )}
          </section>
        )}
      </div>
      <div className="detail-footer">
        <button
          className="icon-button danger-hover"
          onClick={onDelete}
          aria-label="删除事项"
          title="删除事项"
        >
          <Icon name="Trash2" size={16} />
        </button>
        <span>创建于 {shortDate(task.createdAt.slice(0, 10))}</span>
        {task.kind === 'normal' && (
          <button className={`text-button ${done ? 'muted' : ''}`} onClick={onToggle}>
            <Icon name={done ? 'RefreshCw' : 'Check'} size={15} />
            {done ? '重新打开' : '完成事项'}
          </button>
        )}
      </div>
      {editingDates && (
        <TaskDateEditor
          task={task}
          onClose={() => setEditingDates(false)}
          onSave={(dates) => {
            onDateChange(dates)
            setEditingDates(false)
          }}
        />
      )}
      {logging && (
        <Modal
          title="记录一点进展"
          subtitle={`每一步，都在靠近目标。还剩 ${number(task.total - progressValue(task))} ${task.unit}。`}
          onClose={() => setLogging(false)}
        >
          <form onSubmit={log} className="task-form">
            <div className="form-grid">
              <label>
                本次完成（{task.unit}）
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  max={task.total - progressValue(task)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                记录日期
                <input
                  type="date"
                  value={logDate}
                  min={task.startDate}
                  max={dateKey()}
                  required
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </label>
            </div>
            <label>
              随手记（可选）
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="今天有什么收获？"
              />
            </label>
            {logError && (
              <p role="alert" className="error-text">
                {logError}
              </p>
            )}
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setLogging(false)}>
                取消
              </button>
              <button type="submit" className="button primary">
                保存进度
              </button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  )
}
