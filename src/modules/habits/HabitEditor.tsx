import { useState } from 'react'
import type { Habit, HabitGroup } from '../../core/types'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { habitColors, habitFrequencies, habitPresets } from './logic'

export default function HabitEditor({
  initial,
  groups,
  editing,
  onSave,
  onClose,
}: {
  initial: Habit
  groups: HabitGroup[]
  editing: boolean
  onSave: (habit: Habit, newGroup?: HabitGroup) => void
  onClose: () => void
}) {
  const [habit, setHabit] = useState(initial)
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')
  const [preset, setPreset] = useState('自定义')
  const patch = (value: Partial<Habit>) => setHabit((h) => ({ ...h, ...value }))
  function usePreset(item: (typeof habitPresets)[number]) {
    setPreset(item.name)
    const group = groups.find((g) => g.name === item.group)
    patch({
      name: item.name,
      icon: item.icon,
      color: item.color,
      groupId: group?.id || '__new',
      goal: { type: item.type, target: item.target, unit: item.unit },
    })
    setGroupName(group ? '' : item.group)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!habit.name.trim()) return setError('给这个习惯起一个名字吧。')
    if (!habit.startDate) return setError('请选择开始日期。')
    if (habit.frequency === 'custom' && !habit.days.length)
      return setError('至少选择一星期中的一天。')
    if (!Number.isFinite(habit.goal.target) || habit.goal.target <= 0 || !habit.goal.unit.trim())
      return setError('请填写大于 0 的目标和计量单位。')
    if (habit.groupId === '__new' && !groupName.trim()) return setError('请填写新分组的名称。')
    const existing = groups.find((g) => g.name === groupName.trim())
    const group =
      habit.groupId === '__new'
        ? existing || { id: crypto.randomUUID(), name: groupName.trim(), color: habit.color }
        : undefined
    const records =
      habit.goal.type === 'check' && initial.goal.type === 'quantity'
        ? Object.fromEntries(
            Object.entries(habit.records)
              .filter(([, r]) => r.value >= initial.goal.target)
              .map(([day]) => [day, { value: 1 }]),
          )
        : habit.records
    onSave(
      {
        ...habit,
        name: habit.name.trim(),
        goal: { ...habit.goal, unit: habit.goal.unit.trim() },
        groupId: group?.id || habit.groupId,
        records,
      },
      group && !existing ? group : undefined,
    )
  }
  return (
    <Modal
      title={editing ? '编辑习惯' : '养成一个新习惯'}
      subtitle="从一个小小的行动开始，把节奏交给自己。"
      onClose={onClose}
      wide
    >
      <form className="habit-form" onSubmit={submit}>
        {!editing && (
          <section className="habit-presets">
            <div className="habit-form-label">
              从常见习惯开始 <span>选择后还可以继续调整</span>
            </div>
            <div className="habit-preset-grid">
              {habitPresets.map((item) => (
                <button
                  type="button"
                  className={preset === item.name ? 'selected' : ''}
                  key={item.name}
                  title={item.description}
                  onClick={() => usePreset(item)}
                >
                  <Icon name={item.icon} size={18} style={{ color: item.color }} />
                  <span>{item.name}</span>
                </button>
              ))}
              <button
                type="button"
                className={preset === '自定义' ? 'selected' : ''}
                onClick={() => {
                  setPreset('自定义')
                  patch({ name: '', icon: 'Target' })
                }}
              >
                <Icon name="Plus" size={18} />
                <span>自定义</span>
              </button>
            </div>
          </section>
        )}
        <label>
          习惯名称
          <input
            aria-label="习惯名称"
            maxLength={40}
            value={habit.name}
            placeholder="比如：每天读几页书"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <div className="habit-form-row">
          <label>
            频率
            <select
              aria-label="频率"
              value={habit.frequency}
              onChange={(e) => patch({ frequency: e.target.value as Habit['frequency'] })}
            >
              {Object.entries(habitFrequencies).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            开始日期
            <input
              type="date"
              required
              value={habit.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
            />
          </label>
        </div>
        {habit.frequency === 'custom' && (
          <div className="habit-week-picker" aria-label="重复星期">
            {[1, 2, 3, 4, 5, 6, 0].map((n, i) => (
              <button
                type="button"
                key={n}
                aria-pressed={habit.days.includes(n)}
                className={habit.days.includes(n) ? 'active' : ''}
                onClick={() =>
                  patch({
                    days: habit.days.includes(n)
                      ? habit.days.filter((d) => d !== n)
                      : [...habit.days, n],
                  })
                }
              >
                {['一', '二', '三', '四', '五', '六', '日'][i]}
              </button>
            ))}
          </div>
        )}
        <div className="habit-form-row">
          <label>
            分组
            <select
              aria-label="分组"
              value={habit.groupId}
              onChange={(e) => patch({ groupId: e.target.value })}
            >
              <option value="">未分组</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="__new">＋ 新建分组</option>
            </select>
          </label>
          {habit.groupId === '__new' ? (
            <label>
              新分组名称
              <input
                maxLength={20}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="比如：我的晨间习惯"
              />
            </label>
          ) : (
            <div className="habit-form-colors">
              <span>标记颜色</span>
              <div>
                {habitColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`习惯颜色 ${color}`}
                    aria-pressed={color === habit.color}
                    style={{ background: color }}
                    onClick={() => patch({ color })}
                  >
                    {color === habit.color && <Icon name="Check" size={13} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <section className="habit-goal-config">
          <div className="habit-form-label">
            目标 <span>怎样算完成一次？</span>
          </div>
          <div className="habit-goal-picker">
            {[
              {
                type: 'check',
                icon: 'CircleCheck',
                title: '完成即打卡',
                sub: '适合戒糖、早睡等习惯',
              },
              {
                type: 'quantity',
                icon: 'ChartNoAxesCombined',
                title: '记录数值',
                sub: '适合阅读、运动等习惯',
              },
            ].map((g) => (
              <button
                type="button"
                key={g.type}
                className={habit.goal.type === g.type ? 'active' : ''}
                onClick={() =>
                  patch({
                    goal:
                      g.type === 'check'
                        ? { type: 'check', target: 1, unit: '次' }
                        : { type: 'quantity', target: 30, unit: '分钟' },
                  })
                }
              >
                <Icon name={g.icon} size={19} />
                <span>
                  <strong>{g.title}</strong>
                  <small>{g.sub}</small>
                </span>
                <i>{habit.goal.type === g.type && <Icon name="Check" size={12} />}</i>
              </button>
            ))}
          </div>
          {habit.goal.type === 'quantity' && (
            <>
              <div className="habit-form-row habit-target-fields">
                <label>
                  每个计划日的基本目标
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={habit.goal.target || ''}
                    onChange={(e) =>
                      patch({ goal: { ...habit.goal, target: Number(e.target.value) } })
                    }
                  />
                </label>
                <label>
                  单位
                  <input
                    maxLength={10}
                    required
                    value={habit.goal.unit}
                    placeholder="分钟、页、次、ml…"
                    onChange={(e) => patch({ goal: { ...habit.goal, unit: e.target.value } })}
                  />
                </label>
              </div>
              <div
                className="habit-intensity-preview"
                style={{ '--habit-color': habit.color } as React.CSSProperties}
              >
                <span>打卡强度</span>
                {[1, 2, 3].map((n) => (
                  <span key={n}>
                    <i className={`habit-cell intensity-${n + 1}`} />
                    {Number((habit.goal.target * n).toFixed(2))}
                    {n === 3 ? '+' : ''} {habit.goal.unit}
                  </span>
                ))}
              </div>
              <p className="habit-form-hint">
                达到目标即完成，超额完成时颜色逐级加深。未达标的记录也会保留。
              </p>
            </>
          )}
          {editing && initial.goal.type !== habit.goal.type && (
            <p className="habit-form-hint">
              切换为完成打卡时，只保留原本已达标的日期；切换为数值记录时，原打卡以 1 为数值保留。
            </p>
          )}
        </section>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            <Icon name={editing ? 'Check' : 'Plus'} size={15} />
            {editing ? '保存习惯' : '创建习惯'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
