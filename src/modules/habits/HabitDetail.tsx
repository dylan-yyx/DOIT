import { useState } from 'react'
import type { Habit } from '../../core/types'
import { monthGrid, moveMonth, parseDate, shortDate } from '../../core/dates'
import Icon from '../../components/Icon'
import {
  habitDone,
  habitFrequencyText,
  habitGoalText,
  habitIntensity,
  habitMonthStats,
  habitOccursOn,
  habitStreak,
  habitValue,
} from './logic'

export function IntensityLegend({ habit }: { habit: Habit }) {
  return (
    <div className="habit-intensity-legend">
      <span>未记录</span>
      {[0, 1, 2, 3, 4].map((n) => (
        <i key={n} className={`habit-cell intensity-${n}`} />
      ))}
      <span>更多投入</span>
    </div>
  )
}

export default function HabitDetail({
  habit,
  day,
  today,
  group,
  onDay,
  onRecord,
  onEdit,
  onDelete,
  onClose,
}: {
  habit: Habit
  day: string
  today: string
  group: string
  onDay: (day: string) => void
  onRecord: (habit: Habit, day: string, value: number) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [month, setMonth] = useState(day)
  const value = habitValue(habit, day)
  const [amount, setAmount] = useState(String(value || habit.goal.target))
  const [error, setError] = useState('')
  const stats = habitMonthStats(habit, month, today)
  const allowed = day <= today && habitOccursOn(habit, day)
  const done = habitDone(habit, day)
  const monthDate = parseDate(month)
  const firstOfMonth = month.slice(0, 7) + '-01'
  const calendarDays = monthGrid(month)
  const lastInMonth = calendarDays.reduce(
    (last, d, i) => (d.slice(0, 7) === month.slice(0, 7) ? i : last),
    0,
  )
  const displayDays = calendarDays.slice(0, Math.ceil((lastInMonth + 1) / 7) * 7)
  return (
    <aside
      className="habit-detail"
      style={{ '--habit-color': habit.color } as React.CSSProperties}
      aria-label={`${habit.name}详情`}
    >
      <div className="habit-detail-top">
        <span>习惯详情</span>
        <div>
          <button
            className="icon-button"
            onClick={onEdit}
            aria-label={`编辑习惯 ${habit.name}`}
            title="编辑习惯"
          >
            <Icon name="Pencil" size={15} />
          </button>
          <button className="icon-button" onClick={onClose} aria-label="关闭习惯详情">
            <Icon name="PanelRightClose" size={16} />
          </button>
        </div>
      </div>
      <div className="habit-detail-scroll">
        <div className="habit-detail-identity">
          <div className="habit-large-icon">
            <Icon name={habit.icon} size={26} />
          </div>
          <h2>{habit.name}</h2>
          <p>
            {group || '未分组'}
            <i />
            {habitFrequencyText(habit)}
          </p>
          {habit.example && <span className="habit-example-pill">示例习惯</span>}
        </div>
        <div className="habit-detail-goal">
          <Icon name="Target" size={14} />
          <span>{habitGoalText(habit)}</span>
          <button onClick={onEdit} aria-label="调整习惯目标">
            调整
            <Icon name="ChevronRight" size={12} />
          </button>
        </div>
        <div className="habit-detail-statistics">
          <div>
            <strong>
              {habitStreak(habit, today)}
              <small>次</small>
            </strong>
            <span>连续达标</span>
          </div>
          <div>
            <strong>
              {stats.done}
              <small>天</small>
            </strong>
            <span>本月达标</span>
          </div>
          <div>
            <strong>
              {stats.rate}
              <small>%</small>
            </strong>
            <span>本月完成率</span>
          </div>
        </div>
        <section className="habit-calendar-section">
          <div className="habit-section-title">
            <h3>坚持的足迹</h3>
            <div>
              <button
                className="icon-button"
                aria-label="上个月的打卡"
                onClick={() => setMonth(moveMonth(month, -1))}
              >
                <Icon name="ChevronLeft" size={13} />
              </button>
              <span>
                {monthDate.getFullYear()} 年 {monthDate.getMonth() + 1} 月
              </span>
              <button
                className="icon-button"
                aria-label="下个月的打卡"
                onClick={() => setMonth(moveMonth(month, 1))}
              >
                <Icon name="ChevronRight" size={13} />
              </button>
            </div>
          </div>
          <div className="habit-calendar">
            <div className="habit-calendar-weekdays">
              {['一', '二', '三', '四', '五', '六', '日'].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <div className="habit-calendar-grid">
              {displayDays.map((d) => {
                const inMonth = d.slice(0, 7) === firstOfMonth.slice(0, 7)
                const available = inMonth && d <= today && habitOccursOn(habit, d)
                return (
                  <button
                    key={d}
                    disabled={!available}
                    aria-label={`${d} ${habitValue(habit, d) ? (habit.goal.type === 'check' ? '已打卡' : `${habitValue(habit, d)} ${habit.goal.unit}`) : '未记录'}`}
                    aria-pressed={day === d}
                    className={`habit-cell intensity-${inMonth ? habitIntensity(habit, d) : 0} ${inMonth ? '' : 'outside'} ${d === today ? 'today' : ''} ${d === day ? 'selected' : ''} ${!habitOccursOn(habit, d) ? 'unscheduled' : ''}`}
                    onClick={() => onDay(d)}
                    title={
                      available ? '点击查看或修改当日记录' : d > today ? '还没到这一天' : '非计划日'
                    }
                  >
                    {inMonth ? parseDate(d).getDate() : ''}
                  </button>
                )
              })}
            </div>
          </div>
          <IntensityLegend habit={habit} />
          <p className="habit-calendar-note">点击日期，查看记录或补记过去的坚持。</p>
        </section>
        <section className="habit-record-section">
          <div className="habit-section-title">
            <h3>{day === today ? '今天的记录' : `${shortDate(day)}的记录`}</h3>
            <span className={`habit-record-state ${done ? 'done' : ''}`}>
              {done ? '已达标' : value ? '进行中' : '待打卡'}
            </span>
          </div>
          {habit.goal.type === 'quantity' ? (
            <>
              <div className="habit-amount-display">
                <strong>{value}</strong>
                <span>
                  / {habit.goal.target} {habit.goal.unit}
                </span>
                {value >= habit.goal.target * 2 && (
                  <span className="habit-extra-badge">
                    {Number((value / habit.goal.target).toFixed(1))} 倍目标
                  </span>
                )}
              </div>
              <div className="habit-amount-track">
                <i style={{ width: `${Math.min(value / habit.goal.target, 1) * 100}%` }} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const n = Number(amount)
                  if (!amount.trim() || !Number.isFinite(n) || n < 0)
                    return setError('请输入不小于 0 的数值。')
                  setError('')
                  onRecord(habit, day, n)
                }}
              >
                <div className="habit-record-input">
                  <label>
                    <input
                      aria-label={`${habit.name}当日总量`}
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={amount}
                      disabled={!allowed}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <span>{habit.goal.unit}</span>
                  </label>
                  <button className="button primary" disabled={!allowed} type="submit">
                    保存记录
                  </button>
                </div>
                <div className="habit-quick-amounts">
                  {[1, 2, 3].map((n) => (
                    <button
                      type="button"
                      disabled={!allowed}
                      key={n}
                      onClick={() => {
                        setAmount(String(Number((habit.goal.target * n).toFixed(2))))
                        onRecord(habit, day, Number((habit.goal.target * n).toFixed(2)))
                      }}
                    >
                      {Number((habit.goal.target * n).toFixed(2))} {habit.goal.unit}
                      <i className={`habit-cell intensity-${n + 1}`} />
                    </button>
                  ))}
                </div>
              </form>
              <p className="habit-record-note">填写当天累计总量，再次保存会更新原记录。</p>
            </>
          ) : (
            <>
              <div className={`habit-check-status ${done ? 'done' : ''}`}>
                <Icon name={done ? 'CircleCheck' : 'Circle'} size={29} />
                <p>{done ? '今天的小目标，完成了。' : '完成后，给今天留一个印记。'}</p>
              </div>
              <button
                className={`button ${done ? 'secondary' : 'primary'} full`}
                disabled={!allowed}
                onClick={() => onRecord(habit, day, done ? 0 : 1)}
              >
                <Icon name={done ? 'RefreshCw' : 'Check'} size={15} />
                {done ? '撤销打卡' : '完成打卡'}
              </button>
            </>
          )}
          {!allowed && (
            <p className="habit-record-note">
              {day > today
                ? '未来日期还不能打卡。'
                : day < habit.startDate
                  ? '这一天还未开始该习惯。'
                  : '这一天不在习惯计划中。'}
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
        </section>
      </div>
      <footer className="habit-detail-bottom">
        <span>
          <Icon name="CalendarDays" size={13} />
          开始于 {habit.startDate.replaceAll('-', '.')}
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={onDelete}
          aria-label={`删除习惯 ${habit.name}`}
          title="删除习惯"
        >
          <Icon name="Trash2" size={15} />
        </button>
      </footer>
    </aside>
  )
}
