import type { Task } from '../../core/types'
import { dateKey } from '../../core/dates'
import type { TaskDates } from './logic'

export default function TaskScheduleFields({
  dates,
  kind,
  repeat,
  onChange,
}: {
  dates: TaskDates
  kind: Task['kind']
  repeat: Task['repeat']
  onChange: (dates: TaskDates) => void
}) {
  const normal = kind === 'normal'
  const range = kind === 'progress' || dates.dateMode === 'range'
  const dateRange = range && (kind === 'progress' || repeat === 'none')
  const timed = dates.timeMode !== 'allday'
  function selectMode(mode: 'single' | 'range') {
    const start = dates.startDate || dates.dueDate || dateKey()
    onChange({
      ...dates,
      dateMode: mode,
      startDate: mode === 'range' ? start : dates.dueDate,
      dueDate: mode === 'range' ? dates.dueDate || start : dates.dueDate,
      timeMode: timed ? (mode === 'range' ? 'range' : 'point') : 'allday',
    })
  }
  return (
    <>
      {normal && (
        <div className="form-grid">
          <label>
            安排类型
            <select
              aria-label="安排类型"
              value={dates.dateMode || 'single'}
              onChange={(event) => selectMode(event.target.value as 'single' | 'range')}
            >
              <option value="single">日期</option>
              <option value="range">时间段</option>
            </select>
          </label>
          <label className="schedule-time-choice">
            <input
              type="checkbox"
              checked={timed}
              onChange={(event) =>
                onChange({
                  ...dates,
                  timeMode: event.target.checked ? (range ? 'range' : 'point') : 'allday',
                })
              }
            />
            设置时间
          </label>
        </div>
      )}
      <div className="form-grid">
        {dateRange && (
          <label>
            开始日期
            <input
              type="date"
              value={dates.startDate}
              required
              onChange={(event) => onChange({ ...dates, startDate: event.target.value })}
            />
          </label>
        )}
        <label>
          {dateRange ? '结束日期' : repeat !== 'none' ? '重复开始日期' : '日期'}
          <input
            type="date"
            value={dates.dueDate}
            required={range || timed || repeat !== 'none'}
            onChange={(event) =>
              onChange({
                ...dates,
                dueDate: event.target.value,
                startDate: dateRange ? dates.startDate : event.target.value,
              })
            }
          />
        </label>
      </div>
      {normal && timed && (
        <div className="form-grid">
          <label>
            {range ? '开始时间' : '时间'}
            <input
              type="time"
              value={dates.startTime}
              required
              onChange={(event) => onChange({ ...dates, startTime: event.target.value })}
            />
          </label>
          {range && (
            <label>
              结束时间
              <input
                type="time"
                value={dates.endTime}
                required
                onChange={(event) => onChange({ ...dates, endTime: event.target.value })}
              />
            </label>
          )}
        </div>
      )}
    </>
  )
}
