import { useState } from 'react'
import type { Task } from '../../core/types'
import Modal from '../../components/Modal'
import { taskDateDraft, taskDateError, type TaskDates } from './logic'
import TaskScheduleFields from './TaskScheduleFields'

export default function TaskDateEditor({
  task,
  onSave,
  onClose,
}: {
  task: Task
  onSave: (dates: TaskDates) => void
  onClose: () => void
}) {
  const progress = task.kind === 'progress'
  const repeating = task.repeat !== 'none'
  const [dates, setDates] = useState(() => taskDateDraft(task))
  const [error, setError] = useState('')

  function save(next: TaskDates) {
    const message = taskDateError({ ...next, kind: task.kind, repeat: task.repeat })
    if (message) setError(message)
    else onSave(taskDateDraft({ ...task, ...next }))
  }

  return (
    <Modal
      title="设置事项日期"
      subtitle={repeating ? '调整整组重复事项的日期，已有完成记录仍按原日期保留。' : undefined}
      onClose={onClose}
    >
      <form
        className="task-form"
        onSubmit={(event) => {
          event.preventDefault()
          save(dates)
        }}
      >
        <TaskScheduleFields
          dates={dates}
          kind={task.kind}
          repeat={task.repeat}
          onChange={setDates}
        />
        {repeating && (
          <label>
            重复截止日期（可选）
            <input
              type="date"
              value={dates.repeatUntil}
              onChange={(event) => setDates({ ...dates, repeatUntil: event.target.value })}
            />
          </label>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          {!progress && !repeating && dates.dueDate && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                save({
                  ...dates,
                  dateMode: 'single',
                  startDate: '',
                  dueDate: '',
                  timeMode: 'allday',
                })
              }
            >
              取消安排
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="button primary">
            保存日期
          </button>
        </div>
      </form>
    </Modal>
  )
}
