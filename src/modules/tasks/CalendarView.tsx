import type { AppData, Task } from '../../core/types'
import { addDays, dateKey, monthGrid, parseDate, startOfWeek, weekdays } from '../../core/dates'
import { isCompleted, occursOn } from './logic'
import Icon from '../../components/Icon'
export default function CalendarView({
  view,
  anchor,
  tasks,
  data,
  selectedId,
  onSelect,
  onCreate,
  completedOnly = false,
}: {
  view: 'week' | 'month'
  anchor: string
  tasks: Task[]
  data: AppData
  selectedId: string | null
  onSelect: (id: string, day: string) => void
  onCreate: (day: string) => void
  completedOnly?: boolean
}) {
  const today = dateKey(),
    days =
      view === 'month'
        ? monthGrid(anchor)
        : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
  const sorted = (day: string) =>
    tasks
      .filter(
        (t) =>
          occursOn(t, day) &&
          (completedOnly
            ? isCompleted(t, day)
            : data.preferences.showCompleted || !isCompleted(t, day)),
      )
      .sort(
        (a, b) =>
          Number(isCompleted(a, day)) - Number(isCompleted(b, day)) ||
          a.startTime.localeCompare(b.startTime),
      )
  return (
    <div className={`calendar-view ${view}`}>
      <div className="calendar-weekdays">
        {[1, 2, 3, 4, 5, 6, 0].map((n) => (
          <span key={n} className={n === 0 || n === 6 ? 'weekend' : ''}>
            周{weekdays[n]}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => (
          <div
            key={day}
            data-date={day}
            className={`calendar-day ${day === today ? 'is-today' : ''} ${day.slice(0, 7) !== anchor.slice(0, 7) && view === 'month' ? 'other-month' : ''}`}
          >
            <div className="calendar-date">
              <button onClick={() => onCreate(day)} title={`${day} 新建事项`}>
                <span>{parseDate(day).getDate()}</span>
                {day === today && <small>今天</small>}
              </button>
              <button
                className="icon-button"
                onClick={() => onCreate(day)}
                aria-label={`${day} 添加事项`}
              >
                <Icon name="Plus" size={13} />
              </button>
            </div>
            <div className="calendar-events">
              {sorted(day).map((task) => {
                const list = data.lists.find((l) => l.id === task.listId)!
                const done = isCompleted(task, day)
                return (
                  <button
                    key={task.id}
                    data-task-id={task.id}
                    className={`calendar-event ${selectedId === task.id ? 'selected' : ''} ${done ? 'event-done' : ''}`}
                    style={{ '--event-color': list.color } as React.CSSProperties}
                    onClick={() => onSelect(task.id, day)}
                  >
                    <span className="calendar-event-title">
                      {done ? (
                        <Icon name="Check" size={11} />
                      ) : task.kind === 'progress' ? (
                        <Icon name="ChartNoAxesCombined" size={11} />
                      ) : (
                        <i />
                      )}
                      {task.title}
                    </span>
                    {task.timeMode !== 'allday' && (
                      <small>
                        {task.startTime}
                        {task.timeMode === 'range' ? `–${task.endTime}` : ''}
                      </small>
                    )}
                    {view === 'week' && task.kind === 'progress' && (
                      <div className="calendar-progress-track">
                        <span
                          style={{
                            width: `${Math.min(100, (task.entries.reduce((n, e) => n + e.amount, 0) / task.total) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
              {!sorted(day).length && view === 'week' && (
                <button className="calendar-empty" onClick={() => onCreate(day)}>
                  留一点空白
                  <br />
                  <span>也很好</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="calendar-caption">
        <Icon name="CircleHelp" size={14} />
        点击日期添加事项，点击事项查看详情。<span>未安排日期的事项可在列表中查看</span>
      </div>
    </div>
  )
}
