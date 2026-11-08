import { useState } from 'react'
import type { AppData, Task } from '../../core/types'
import { dateKey } from '../../core/dates'
import { repeatNames } from './logic'
import { parseNoteTags } from './notes'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
export default function TaskEditor({
  initial,
  data,
  onSave,
  onClose,
}: {
  initial: Task
  data: AppData
  onSave: (task: Task) => void
  onClose: () => void
}) {
  const [task, setTask] = useState<Task>(structuredClone(initial)),
    [error, setError] = useState('')
  const set = <K extends keyof Task>(key: K, value: Task[K]) =>
    setTask((old) => ({ ...old, [key]: value }))
  const noteTags = parseNoteTags(task.notes).names
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!task.title.trim()) {
      setError('先给事项起一个名字吧。')
      return
    }
    if (task.startDate && task.dueDate && task.startDate > task.dueDate) {
      setError('结束日期需要晚于或等于开始日期。')
      return
    }
    if (
      task.kind === 'progress' &&
      (!task.startDate || !task.dueDate || task.total <= 0 || !Number.isFinite(task.total))
    ) {
      setError('请填写进度目标和完整的起止日期。')
      return
    }
    if (task.repeat !== 'none' && !task.dueDate) {
      setError('重复事项需要设置开始日期。')
      return
    }
    if (task.repeat === 'custom' && !task.repeatDays.length) {
      setError('请至少选择一个重复的星期。')
      return
    }
    if (task.repeatUntil && task.repeatUntil < (task.startDate || task.dueDate)) {
      setError('重复截止日期不能早于开始日期。')
      return
    }
    if (task.timeMode === 'range' && task.endTime <= task.startTime) {
      setError('结束时间需晚于开始时间；跨天事项请分开安排。')
      return
    }
    if (task.entries.reduce((n, e) => n + e.amount, 0) > task.total && task.kind === 'progress') {
      setError('总目标不能小于已经记录的进度。')
      return
    }
    onSave({
      ...task,
      title: task.title.trim(),
      checklist: task.checklist
        .filter((c) => c.title.trim())
        .map((c) => ({ ...c, title: c.title.trim() })),
      repeat: task.kind === 'progress' ? 'none' : task.repeat,
      completed: task.kind !== initial.kind ? false : task.completed,
    })
  }
  return (
    <Modal
      title={data.tasks.some((t) => t.id === task.id) ? '编辑事项' : '新建事项'}
      subtitle="把想做的事，变成有迹可循的小计划。"
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="task-form">
        <input
          className="task-name-input"
          aria-label="事项名称"
          placeholder="准备做些什么？"
          value={task.title}
          maxLength={200}
          onChange={(e) => set('title', e.target.value)}
          autoFocus
          required
        />
        <div className="kind-picker">
          <button
            type="button"
            className={task.kind === 'normal' ? 'active' : ''}
            onClick={() => set('kind', 'normal')}
          >
            <Icon name="CircleCheck" />
            普通事项
          </button>
          <button
            type="button"
            className={task.kind === 'progress' ? 'active' : ''}
            onClick={() => {
              set('kind', 'progress')
              set('repeat', 'none')
              if (!task.dueDate) {
                set('dueDate', dateKey())
                set('startDate', dateKey())
              }
            }}
          >
            <Icon name="ChartNoAxesCombined" />
            进度事项
          </button>
        </div>
        <div className="form-grid">
          <label>
            所属清单
            <select value={task.listId} onChange={(e) => set('listId', e.target.value)}>
              {data.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            优先级
            <select
              value={task.priority}
              onChange={(e) => set('priority', e.target.value as Task['priority'])}
            >
              <option value="none">无优先级</option>
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          {task.kind === 'progress' && (
            <label>
              开始日期
              <input
                type="date"
                value={task.startDate}
                required
                onChange={(e) => set('startDate', e.target.value)}
              />
            </label>
          )}
          <label>
            {task.kind === 'progress' ? '结束日期' : '日期'}
            <input
              type="date"
              value={task.dueDate}
              onChange={(e) => {
                set('dueDate', e.target.value)
                if (task.kind === 'normal') set('startDate', e.target.value)
              }}
            />
          </label>
          {task.kind === 'normal' && (
            <label>
              时间方式
              <select
                value={task.timeMode}
                onChange={(e) => set('timeMode', e.target.value as Task['timeMode'])}
              >
                <option value="allday">全天 / 不指定时间</option>
                <option value="point">具体时间点</option>
                <option value="range">时间段</option>
              </select>
            </label>
          )}
        </div>
        {task.kind === 'progress' ? (
          <div className="progress-editor">
            <div className="form-grid">
              <label>
                总目标
                <input
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="any"
                  value={task.total}
                  onChange={(e) => set('total', Number(e.target.value))}
                  required
                />
              </label>
              <label>
                单位
                <input
                  value={task.unit}
                  maxLength={12}
                  placeholder="章 / 页 / 次 / 小时"
                  onChange={(e) => set('unit', e.target.value)}
                />
              </label>
            </div>
            <span>
              <Icon name="Sparkles" size={14} /> 根据起止日期，自动计算每天的计划进度。
            </span>
          </div>
        ) : (
          <>
            {task.timeMode !== 'allday' && (
              <div className="form-grid">
                <label>
                  开始时间
                  <input
                    type="time"
                    value={task.startTime}
                    required
                    onChange={(e) => set('startTime', e.target.value)}
                  />
                </label>
                {task.timeMode === 'range' && (
                  <label>
                    结束时间
                    <input
                      type="time"
                      value={task.endTime}
                      required
                      onChange={(e) => set('endTime', e.target.value)}
                    />
                  </label>
                )}
              </div>
            )}
            <div className="form-grid">
              <label>
                重复方式
                <select
                  value={task.repeat}
                  onChange={(e) => set('repeat', e.target.value as Task['repeat'])}
                >
                  {Object.entries(repeatNames).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {task.repeat !== 'none' && (
                <label>
                  重复截止（可选）
                  <input
                    type="date"
                    value={task.repeatUntil}
                    onChange={(e) => set('repeatUntil', e.target.value)}
                  />
                </label>
              )}
            </div>
            {task.repeat === 'custom' && (
              <div className="weekday-picker">
                {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={task.repeatDays.includes(n) ? 'active' : ''}
                    onClick={() =>
                      set(
                        'repeatDays',
                        task.repeatDays.includes(n)
                          ? task.repeatDays.filter((x) => x !== n)
                          : [...task.repeatDays, n],
                      )
                    }
                  >
                    {['日', '一', '二', '三', '四', '五', '六'][n]}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <label>
          标签<span className="field-hint">可跨清单分类</span>
          <div className="tag-picker">
            {data.tags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={task.tagIds.includes(tag.id) ? 'tag-option selected' : 'tag-option'}
                style={{ '--tag-color': tag.color } as React.CSSProperties}
                onClick={() =>
                  set(
                    'tagIds',
                    task.tagIds.includes(tag.id)
                      ? task.tagIds.filter((id) => id !== tag.id)
                      : [...task.tagIds, tag.id],
                  )
                }
              >
                <Icon name="Hash" size={13} />
                {tag.name}
                {task.tagIds.includes(tag.id) && <Icon name="Check" size={12} />}
              </button>
            ))}
            {!data.tags.length && <span className="muted">可在侧边栏添加标签</span>}
          </div>
        </label>
        <label>
          备注
          <textarea
            aria-label="备注"
            rows={3}
            placeholder="补充说明、想法……输入 #标签 可直接添加标签"
            value={task.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
        {noteTags.length > 0 && (
          <div className="note-tag-preview" aria-label="从备注识别的标签">
            <span>
              <Icon name="Tag" size={12} />
              保存时转为标签
            </span>
            {noteTags.map((name) => (
              <span className="tag-pill" key={name}>
                # {name}
              </span>
            ))}
          </div>
        )}
        {task.kind === 'normal' && (
          <div className="editor-checklist">
            <div className="field-label">
              检查事项<span className="field-hint">全部勾选后自动完成</span>
            </div>
            {task.checklist.map((c, i) => (
              <div className="check-edit" key={c.id}>
                <Icon name="Square" size={16} />
                <input
                  aria-label={`子任务 ${i + 1}`}
                  value={c.title}
                  placeholder="一个可以执行的小步骤"
                  onChange={(e) =>
                    set(
                      'checklist',
                      task.checklist.map((x) =>
                        x.id === c.id ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="移除子任务"
                  onClick={() =>
                    set(
                      'checklist',
                      task.checklist.filter((x) => x.id !== c.id),
                    )
                  }
                >
                  <Icon name="X" size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                set('checklist', [...task.checklist, { id: crypto.randomUUID(), title: '' }])
              }
            >
              <Icon name="Plus" size={15} />
              添加检查事项
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="button primary">
            <Icon name="Check" size={16} />
            保存事项
          </button>
        </div>
      </form>
    </Modal>
  )
}
