import type { AppData, Task } from '../../core/types'
import { addDays, dateKey, monthGrid, parseDate, startOfWeek, weekdays } from '../../core/dates'
import { isCompleted, occursOn } from './logic'
import { taskCalendarTime } from './schedule-labels'
import Icon from '../../components/Icon'
import InlineTaskTitle from './InlineTaskTitle'
export default function CalendarView({
  view,
  anchor,
  tasks,
  data,
  selectedId,
  onSelect,
  onCreate,
  onRename,
}: {
  view: 'day' | 'week' | 'month'
  anchor: string
  tasks: Task[]
  data: AppData
  selectedId: string | null
  onSelect: (id: string, day: string) => void
  onCreate: (day: string) => void
  onRename: (id: string, title: string) => void
}) {
  const today = dateKey(),
    days =
      view === 'month'
        ? monthGrid(anchor)
        : view === 'week'
          ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
          : [anchor]
  const sorted = (day: string) =>
    tasks
      .filter((t) => occursOn(t, day) && (data.preferences.showCompleted || !isCompleted(t, day)))
      .sort(
        (a, b) =>
          Number(isCompleted(a, day)) - Number(isCompleted(b, day)) ||
          taskCalendarTime(a, day).localeCompare(taskCalendarTime(b, day)),
      )
  return (
    <div className={`calendar-view ${view}`}>
      {view !== 'day' && (
        <div className="calendar-weekdays">
          {[1, 2, 3, 4, 5, 6, 0].map((n) => (
            <span key={n} className={n === 0 || n === 6 ? 'weekend' : ''}>
              周{weekdays[n]}
            </span>
          ))}
        </div>
      )}
      <div className="calendar-grid">
        {days.map((day) => {
          const events = sorted(day)
          return (
            <div
              key={day}
              data-date={day}
              className={`calendar-day ${day === today ? 'is-today' : ''} ${day.slice(0, 7) !== anchor.slice(0, 7) && view === 'month' ? 'other-month' : ''}`}
            >
              <div className="calendar-date">
                <button onClick={() => onCreate(day)} title={`${day} 新建事项`}>
                  <span>{parseDate(day).getDate()}</span>
                  {view === 'day' && (
                    <strong>
                      {parseDate(day).getMonth() + 1} 月 · 星期{weekdays[parseDate(day).getDay()]}
                    </strong>
                  )}
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
                {events.map((task) => {
                  const list = data.lists.find((l) => l.id === task.listId)!
                  const done = isCompleted(task, day)
                  const time = taskCalendarTime(task, day)
                  return (
                    <div
                      key={task.id}
                      data-task-id={task.id}
                      className={`calendar-event ${selectedId === task.id ? 'selected' : ''} ${done ? 'event-done' : ''}`}
                      style={{ '--event-color': list.color } as React.CSSProperties}
                      onClick={() => onSelect(task.id, day)}
                    >
                      <div className="calendar-event-title">
                        {done ? (
                          <Icon name="Check" size={11} />
                        ) : task.kind === 'progress' ? (
                          <Icon name="ChartNoAxesCombined" size={11} />
                        ) : (
                          <i />
                        )}
                        <InlineTaskTitle
                          title={task.title}
                          onOpen={() => onSelect(task.id, day)}
                          onRename={(title) => onRename(task.id, title)}
                        />
                      </div>
                      {view === 'day' && <small className="calendar-event-list">{list.name}</small>}
                      {time && <small>{time}</small>}
                      {view === 'week' && task.kind === 'progress' && (
                        <div className="calendar-progress-track">
                          <span
                            style={{
                              width: `${Math.min(100, (task.entries.reduce((n, e) => n + e.amount, 0) / task.total) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
                {!events.length && view !== 'month' && (
                  <button className="calendar-empty" onClick={() => onCreate(day)}>
                    留一点空白
                    <br />
                    <span>也很好</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="calendar-caption">
        <Icon name="CircleHelp" size={14} />
        点击日期添加事项，点击事项查看详情。
        <span>未安排日期的事项可在所属清单或搜索结果中查看</span>
      </div>
    </div>
  )
}
