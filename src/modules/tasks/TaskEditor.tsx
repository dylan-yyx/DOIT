import { useState } from 'react'
import type { AppData, Task } from '../../core/types'
import { dateKey } from '../../core/dates'
import { repeatNames, spansMultipleDays, taskDateDraft, taskDateError } from './logic'
import TaskScheduleFields from './TaskScheduleFields'
import { parseNoteTags } from './notes'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import TagPicker from '../../components/TagPicker'
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
  const [task, setTask] = useState<Task>(() => ({
      ...structuredClone(initial),
      ...taskDateDraft(initial),
    })),
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
    const dateError = taskDateError(task)
    if (dateError) {
      setError(dateError)
      return
    }
    if (task.kind === 'progress' && (task.total <= 0 || !Number.isFinite(task.total))) {
      setError('请填写进度目标和完整的起止日期。')
      return
    }
    if (task.repeat === 'custom' && !task.repeatDays.length) {
      setError('请至少选择一个重复的星期。')
      return
    }
    if (task.entries.reduce((n, e) => n + e.amount, 0) > task.total && task.kind === 'progress') {
      setError('总目标不能小于已经记录的进度。')
      return
    }
    onSave({
      ...task,
      ...taskDateDraft(task),
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
            onClick={() =>
              setTask((old) =>
                old.kind === 'normal'
                  ? old
                  : {
                      ...old,
                      kind: 'normal',
                      dateMode: 'range',
                      timeMode: 'allday',
                    },
              )
            }
          >
            <Icon name="CircleCheck" />
            普通事项
          </button>
          <button
            type="button"
            className={task.kind === 'progress' ? 'active' : ''}
            onClick={() =>
              setTask((old) =>
                old.kind === 'progress'
                  ? old
                  : {
                      ...old,
                      kind: 'progress',
                      dateMode: undefined,
                      repeat: 'none',
                      timeMode: 'allday',
                      startDate: old.startDate || old.dueDate || dateKey(),
                      dueDate: old.dueDate || dateKey(),
                    },
              )
            }
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
        <TaskScheduleFields
          dates={task}
          kind={task.kind}
          repeat={task.repeat}
          onChange={(dates) => setTask((old) => ({ ...old, ...dates }))}
        />
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
            <div className="form-grid">
              <label>
                重复方式
                <select
                  value={task.repeat}
                  onChange={(e) => set('repeat', e.target.value as Task['repeat'])}
                >
                  {Object.entries(repeatNames).map(([id, name]) => (
                    <option key={id} value={id} disabled={id !== 'none' && spansMultipleDays(task)}>
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
        <div>
          <div className="field-label">
            标签<span className="field-hint">可跨清单分类</span>
          </div>
          <TagPicker data={data} selected={task.tagIds} onChange={(ids) => set('tagIds', ids)} />
        </div>
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
