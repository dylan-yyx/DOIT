import { useEffect, useState } from 'react'
import type { AppData, Habit, HabitGroup } from '../../core/types'
import { addDays, dateKey, parseDate, shortDate, startOfWeek } from '../../core/dates'
import Icon from '../../components/Icon'
import CompletionSummary from '../../components/CompletionSummary'
import Modal from '../../components/Modal'
import WorkspaceName from '../../components/WorkspaceName'
import HabitEditor from './HabitEditor'
import HabitDetail from './HabitDetail'
import {
  habitDone,
  habitGoalText,
  habitIntensity,
  habitOccursOn,
  habitPresets,
  habitStreak,
  habitValue,
  newHabit,
  recordHabit,
} from './logic'
import './habits.css'

type Props = {
  data: AppData
  today: string
  status: 'saving' | 'saved' | 'error'
  saveError: string
  onChange: (fn: (data: AppData) => AppData) => void
  onSettings: () => void
  notify: (message: string, undo?: () => void) => void
}
export default function HabitBoard({
  data,
  today,
  status,
  saveError,
  onChange,
  onSettings,
  notify,
}: Props) {
  const habits = data.habits || [],
    groups = data.habitGroups || []
  const [day, setDay] = useState(today)
  const [filter, setFilter] = useState('today')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'cards' | 'overview'>('cards')
  const [selected, setSelected] = useState<string | null>(habits[0]?.id || null)
  const [editor, setEditor] = useState<{ habit: Habit; editing: boolean } | null>(null)
  const [deleting, setDeleting] = useState<Habit | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<HabitGroup | null>(null)
  const [recording, setRecording] = useState<{ id: string; day: string; amount: string } | null>(
    null,
  )
  const [showDetails, setShowDetails] = useState(true)
  useEffect(() => {
    setDay((current) => (current === addDays(today, -1) ? today : current))
  }, [today])
  const scheduled = habits.filter((h) => habitOccursOn(h, day))
  const done = scheduled.filter((h) => habitDone(h, day)).length
  const selectedHabit = habits.find((h) => h.id === selected)
  const recordingHabit = habits.find((h) => h.id === recording?.id)
  const visible = habits.filter(
    (h) =>
      (filter === 'today'
        ? habitOccursOn(h, day)
        : filter === 'done'
          ? habitDone(h, day)
          : filter === 'all'
            ? true
            : h.groupId === (filter === 'ungrouped' ? '' : filter)) &&
      h.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const weekStart = startOfWeek(day)
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const overviewDays = Array.from({ length: 28 }, (_, i) => addDays(day, i - 27))
  function create(preset?: (typeof habitPresets)[number]) {
    const habit = newHabit(today)
    if (preset)
      Object.assign(habit, {
        name: preset.name,
        icon: preset.icon,
        color: preset.color,
        goal: { type: preset.type, target: preset.target, unit: preset.unit },
      })
    setEditor({ habit, editing: false })
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'n' &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault()
        setEditor({ habit: newHabit(dateKey()), editing: false })
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  function saveHabit(habit: Habit, group?: HabitGroup) {
    onChange((d) => ({
      ...d,
      habitGroups: group ? [...(d.habitGroups || []), group] : d.habitGroups,
      habits: d.habits?.some((h) => h.id === habit.id)
        ? d.habits.map((h) => (h.id === habit.id ? habit : h))
        : [...(d.habits || []), habit],
    }))
    setSelected(habit.id)
    setShowDetails(true)
    setEditor(null)
    setFilter('all')
    setSearch('')
    notify(editor?.editing ? '习惯已更新' : '新习惯已加入，慢慢开始吧。')
  }
  function removeGroup(id: string) {
    onChange((d) => ({
      ...d,
      habitGroups: d.habitGroups?.filter((g) => g.id !== id),
      habits: d.habits?.map((h) => (h.groupId === id ? { ...h, groupId: '' } : h)),
    }))
    if (filter === id) setFilter('ungrouped')
    setDeletingGroup(null)
    notify('分组已删除')
  }
  function record(habit: Habit, recordDay: string, value: number) {
    if (
      recordDay > today ||
      !habitOccursOn(habit, recordDay) ||
      !Number.isFinite(value) ||
      value < 0
    )
      return
    onChange((d) => ({
      ...d,
      habits: d.habits?.map((h) =>
        h.id === habit.id ? recordHabit(h, recordDay, value, today) : h,
      ),
    }))
    notify(
      value === 0
        ? '已撤销这一天的记录'
        : value >= habit.goal.target
          ? `${habit.name}已达标`
          : '已保存，继续按自己的节奏来。',
    )
  }
  function choose(id: string) {
    setSelected(id)
    setShowDetails(true)
  }
  const headings: Record<string, string> = {
    today: day === today ? '今天的习惯' : `${shortDate(day)}的习惯`,
    all: '全部习惯',
    done: '已达标',
    ungrouped: '未分组',
  }
  return (
    <>
      <aside className="sidebar habit-sidebar">
        <WorkspaceName
          name={data.preferences.name}
          subtitle="一点一滴，慢慢成为"
          onChange={onChange}
        />
        <nav className="smart-nav" aria-label="习惯筛选">
          {[
            { id: 'today', name: '今日习惯', icon: 'Sun', count: scheduled.length - done },
            { id: 'all', name: '全部习惯', icon: 'Layers', count: habits.length },
            { id: 'done', name: '已达标', icon: 'CircleCheck', count: done },
          ].map((item) => (
            <button
              key={item.id}
              className={`side-row ${filter === item.id ? 'active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.name}</span>
              <small>{item.count}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-scroll">
          <div className="sidebar-section-heading">
            <span>习惯分组</span>
            <button
              className="icon-button"
              title="新建习惯时可添加分组"
              aria-label="添加分组与习惯"
              onClick={() => create()}
            >
              <Icon name="Plus" size={15} />
            </button>
          </div>
          <div className="habit-group-nav">
            {groups.map((g) => (
              <div className="habit-group-row" key={g.id}>
                <button
                  className={`side-row ${filter === g.id ? 'active' : ''}`}
                  onClick={() => setFilter(g.id)}
                >
                  <i style={{ background: g.color }} />
                  <span>{g.name}</span>
                  <small>{habits.filter((h) => h.groupId === g.id).length}</small>
                </button>
                <button
                  type="button"
                  className="icon-button habit-group-delete"
                  aria-label={`删除分组 ${g.name}`}
                  title="删除分组"
                  onClick={() => setDeletingGroup(g)}
                >
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
            <button
              className={`side-row ${filter === 'ungrouped' ? 'active' : ''}`}
              onClick={() => setFilter('ungrouped')}
            >
              <Icon name="Folder" size={15} />
              <span>未分组</span>
              <small>{habits.filter((h) => !h.groupId).length || ''}</small>
            </button>
          </div>
          <div className="habit-side-note">
            <div className="habit-side-leaf">
              <Icon name="Sprout" size={31} />
            </div>
            <p>
              不必一下子改变很多，
              <br />
              每天进步一点就很好。
            </p>
            <span>SMALL STEPS, EVERY DAY</span>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="side-row" onClick={onSettings}>
            <Icon name="Settings2" size={17} />
            <span>设置与数据</span>
          </button>
          <div className="local-indicator">
            <i />
            本地存储 · 专注你的生活
          </div>
        </div>
      </aside>
      <main className="habit-main">
        <div className="habit-topline">
          <div className="breadcrumb">
            <Icon name="Flame" size={14} />
            打卡<span>/</span>
            <h1 className="breadcrumb-heading">日常打卡</h1>
          </div>
          <div className="habit-topline-right">
            <span className={`save-status ${status}`} title={saveError || '更改会自动保存到本机'}>
              <i />
              {status === 'saved'
                ? '已保存到本机'
                : status === 'saving'
                  ? '正在保存…'
                  : '保存失败，请备份'}
            </span>
            <div className="habit-search">
              <Icon name="Search" size={14} />
              <input
                aria-label="搜索习惯"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索习惯"
              />
              {search && (
                <button aria-label="清空习惯搜索" onClick={() => setSearch('')}>
                  <Icon name="X" size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="habit-main-scroll">
          <div className="module-summary-row">
            <CompletionSummary
              label={day === today ? '今日达标' : `${shortDate(day)}达标`}
              completed={done}
              total={scheduled.length}
            />
            <div className="module-summary-actions">
              <button type="button" className="button primary" onClick={() => create()}>
                <Icon name="Plus" size={16} />
                新建习惯
              </button>
            </div>
          </div>
          <section className="habit-week-section">
            <div className="habit-week-heading">
              <div>
                <strong>
                  {parseDate(day).getFullYear()} 年 {parseDate(day).getMonth() + 1} 月
                </strong>
              </div>
              <div>
                <button
                  className="icon-button"
                  aria-label="上一周的习惯"
                  onClick={() => setDay(addDays(day, -7))}
                >
                  <Icon name="ChevronLeft" size={14} />
                </button>
                <button className="habit-today-button" onClick={() => setDay(today)}>
                  今天
                </button>
                <button
                  className="icon-button"
                  aria-label="下一周的习惯"
                  onClick={() => setDay(addDays(day, 7))}
                >
                  <Icon name="ChevronRight" size={14} />
                </button>
              </div>
            </div>
            <div className="habit-week-strip">
              {week.map((d, i) => {
                const due = habits.filter((h) => habitOccursOn(h, d)),
                  completed = due.filter((h) => habitDone(h, d)).length
                return (
                  <button
                    key={d}
                    aria-label={`选择 ${d}`}
                    aria-pressed={d === day}
                    className={`${d === day ? 'active' : ''} ${d === today ? 'today' : ''}`}
                    onClick={() => setDay(d)}
                  >
                    <span>周{['一', '二', '三', '四', '五', '六', '日'][i]}</span>
                    <strong>{parseDate(d).getDate()}</strong>
                    <small>
                      {d > today ? (
                        <i className="future" />
                      ) : due.length && completed === due.length ? (
                        <Icon name="Check" size={12} />
                      ) : (
                        <i className={completed ? 'partial' : ''} />
                      )}
                    </small>
                    {d === today && <em>今</em>}
                  </button>
                )
              })}
            </div>
          </section>
          <div className="habit-list-toolbar">
            <div>
              <h2>{headings[filter] || groups.find((g) => g.id === filter)?.name || '我的习惯'}</h2>
              <span>{visible.length} 个</span>
            </div>
            <div className="habit-view-toggle" role="tablist" aria-label="打卡展示方式">
              <button
                role="tab"
                aria-selected={view === 'cards'}
                className={view === 'cards' ? 'active' : ''}
                onClick={() => setView('cards')}
              >
                <Icon name="Layers" size={14} />
                习惯卡片
              </button>
              <button
                role="tab"
                aria-selected={view === 'overview'}
                className={view === 'overview' ? 'active' : ''}
                onClick={() => setView('overview')}
              >
                <Icon name="CalendarDays" size={14} />
                打卡总览
              </button>
            </div>
            {!showDetails && (
              <button
                className="icon-button"
                aria-label="打开习惯详情"
                onClick={() => {
                  if (!selected) setSelected(habits[0]?.id || null)
                  setShowDetails(true)
                }}
              >
                <Icon name="PanelRightOpen" size={16} />
              </button>
            )}
          </div>
          {visible.length ? (
            view === 'cards' ? (
              <div className="habit-card-grid">
                {visible.map((habit) => {
                  const count = Object.values(habit.records).filter(
                    (entry) => entry.value > 0,
                  ).length
                  const streak = habitStreak(habit, today)
                  return (
                    <article
                      key={habit.id}
                      aria-label={`习惯 ${habit.name}`}
                      className={`habit-card ${selected === habit.id && showDetails ? 'selected' : ''}`}
                      style={{ '--habit-color': habit.color } as React.CSSProperties}
                      onClick={() => choose(habit.id)}
                    >
                      <div className="habit-card-info">
                        <div className="habit-card-name">
                          <Icon name={habit.icon} size={13} />
                          <h3>
                            <button
                              type="button"
                              title={`${habit.name} · ${habitGoalText(habit)}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                choose(habit.id)
                              }}
                            >
                              {habit.name}
                            </button>
                          </h3>
                          <button
                            type="button"
                            className="habit-card-edit"
                            title="编辑习惯"
                            aria-label={`编辑卡片 ${habit.name}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditor({ habit, editing: true })
                            }}
                          >
                            <Icon name="Pencil" size={11} />
                          </button>
                        </div>
                        <div className="habit-card-stats">
                          <span title={`打卡 ${count} 次`}>
                            <Icon name="Zap" size={12} />
                            {count}
                          </span>
                          <span title={`连续达标 ${streak} 次`}>
                            <Icon name="Flame" size={12} />
                            {streak}
                          </span>
                        </div>
                      </div>
                      <div className="habit-card-week" role="group" aria-label="本周打卡">
                        {week.map((date, index) => {
                          const value = habitValue(habit, date)
                          const done = habitDone(habit, date)
                          const check = habit.goal.type === 'check'
                          const allowed = date <= today && habitOccursOn(habit, date)
                          const action = allowed
                            ? check
                              ? done
                                ? '撤销打卡'
                                : '打卡'
                              : '填写完成量'
                            : date > today
                              ? '未来日期'
                              : '非计划日'
                          const status = check
                            ? value
                              ? '已打卡'
                              : '未打卡'
                            : `${value} / ${habit.goal.target} ${habit.goal.unit}`
                          return (
                            <button
                              type="button"
                              key={date}
                              className={`habit-cell intensity-${habitIntensity(habit, date)} ${date === day ? 'current' : ''}`}
                              title={`${date} · ${status} · ${action}`}
                              aria-label={`${habit.name} ${date} ${action}`}
                              aria-pressed={check ? done : undefined}
                              disabled={!allowed}
                              onClick={(event) => {
                                event.stopPropagation()
                                if (check) record(habit, date, done ? 0 : 1)
                                else
                                  setRecording({
                                    id: habit.id,
                                    day: date,
                                    amount: value ? String(value) : '',
                                  })
                              }}
                            >
                              {done && check ? (
                                <Icon name="Check" size={12} />
                              ) : (
                                '一二三四五六日'[index]
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </article>
                  )
                })}
                <button className="habit-add-card" onClick={() => create()}>
                  <span>
                    <Icon name="Plus" size={22} />
                  </span>
                  <strong>添加一个好习惯</strong>
                  <small>为生活留一点新的可能</small>
                </button>
              </div>
            ) : (
              <div className="habit-overview">
                <div className="habit-overview-caption">
                  <span>最近 28 天 · 点击色块查看或补记</span>
                  <span>浅色 → 深色，代表更多投入</span>
                </div>
                <div className="habit-overview-scroll">
                  <div className="habit-overview-dates">
                    <span />
                    {overviewDays.map((d) => (
                      <small key={d}>{parseDate(d).getDate()}</small>
                    ))}
                  </div>
                  {visible.map((h) => (
                    <div
                      className="habit-overview-row"
                      key={h.id}
                      style={{ '--habit-color': h.color } as React.CSSProperties}
                    >
                      <button onClick={() => choose(h.id)}>
                        <Icon name={h.icon} size={16} />
                        {h.name}
                      </button>
                      {overviewDays.map((d) => (
                        <button
                          key={d}
                          className={`habit-cell intensity-${habitIntensity(h, d)}`}
                          aria-label={`${h.name} ${d} ${habitValue(h, d)} ${h.goal.unit}`}
                          title={`${d} · ${habitValue(h, d)} ${h.goal.unit}`}
                          disabled={d > today || !habitOccursOn(h, d)}
                          onClick={() => {
                            choose(h.id)
                            setDay(d)
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="habit-empty">
              <Icon name={search ? 'Search' : 'Sprout'} size={36} />
              <h3>
                {search
                  ? '没有找到这个习惯'
                  : filter === 'done'
                    ? '今天的坚持，从现在开始'
                    : '这里还没有习惯'}
              </h3>
              <p>{search ? '换个关键词试试看。' : '挑一个喜欢的小目标，慢慢把它变成日常。'}</p>
              <button
                className="button secondary"
                onClick={() => (search ? setSearch('') : create())}
              >
                {search ? '清空搜索' : '添加习惯'}
              </button>
            </div>
          )}
          <section className="habit-discover">
            <div>
              <Icon name="Sparkles" size={18} />
              <span>
                <strong>下一个好习惯，从这里开始</strong>
                <small>选一个喜欢的，也可以完全自定义。</small>
              </span>
            </div>
            <div>
              {[habitPresets[0], habitPresets[1], habitPresets[4]].map((p) => (
                <button key={p.name} onClick={() => create(p)}>
                  <Icon name={p.icon} size={14} />
                  {p.name}
                  <Icon name="Plus" size={12} />
                </button>
              ))}
            </div>
          </section>
          {habits.some((h) => h.example) && (
            <p className="habit-example-note">
              <Icon name="CircleHelp" size={12} />
              这些习惯来自旧版示例，已保留你的修改，可继续编辑或删除。
            </p>
          )}
        </div>
        <footer className="main-footer">
          <span>
            <Icon name="Leaf" size={13} />
            每一天，都算数。
          </span>
          <span>
            {day === today ? '今天' : shortDate(day)} {done} / {scheduled.length} 已达标
            <i />
            Ctrl + N 新建习惯
          </span>
        </footer>
      </main>
      {showDetails && selectedHabit && (
        <HabitDetail
          key={`${selectedHabit.id}:${day}:${habitValue(selectedHabit, day)}`}
          habit={selectedHabit}
          day={day}
          today={today}
          group={groups.find((g) => g.id === selectedHabit.groupId)?.name || ''}
          onDay={setDay}
          onRecord={record}
          onEdit={() => setEditor({ habit: selectedHabit, editing: true })}
          onDelete={() => setDeleting(selectedHabit)}
          onClose={() => setShowDetails(false)}
        />
      )}
      {editor && (
        <HabitEditor
          initial={editor.habit}
          groups={groups}
          editing={editor.editing}
          onSave={saveHabit}
          onClose={() => setEditor(null)}
        />
      )}
      {recording && recordingHabit && (
        <Modal
          title="填写习惯完成量"
          subtitle={`${recordingHabit.name} · ${recording.day} · ${habitGoalText(recordingHabit)}`}
          onClose={() => setRecording(null)}
        >
          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault()
              const amount = Number(recording.amount)
              if (!recording.amount || !Number.isFinite(amount) || amount < 0) return
              record(recordingHabit, recording.day, amount)
              setRecording(null)
            }}
          >
            <label>
              当天累计完成量（{recordingHabit.goal.unit}）
              <input
                type="number"
                min="0"
                step="any"
                required
                value={recording.amount}
                onChange={(event) => setRecording({ ...recording, amount: event.target.value })}
              />
            </label>
            <p className="field-hint">保存会更新当天的记录，填 0 可撤销打卡。</p>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setRecording(null)}>
                取消
              </button>
              <button type="submit" className="button primary">
                保存记录
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={`删除“${deleting.name}”？`}
          subtitle="该习惯的全部打卡记录也会一起删除。"
          onClose={() => setDeleting(null)}
        >
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              className="button danger-button"
              onClick={() => {
                const removed = deleting
                onChange((d) => ({ ...d, habits: d.habits?.filter((h) => h.id !== removed.id) }))
                if (selected === removed.id)
                  setSelected(habits.find((h) => h.id !== removed.id)?.id || null)
                setDeleting(null)
                notify('习惯已删除', () =>
                  onChange((d) => ({
                    ...d,
                    habits: d.habits?.some((h) => h.id === removed.id)
                      ? d.habits
                      : [...(d.habits || []), removed],
                  })),
                )
              }}
            >
              删除习惯
            </button>
          </div>
        </Modal>
      )}
      {deletingGroup && (
        <Modal
          title={`删除分组“${deletingGroup.name}”？`}
          subtitle="组内习惯将移到「未分组」，打卡记录会保留。"
          onClose={() => setDeletingGroup(null)}
        >
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setDeletingGroup(null)}>
              取消
            </button>
            <button className="button danger-button" onClick={() => removeGroup(deletingGroup.id)}>
              删除分组
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
