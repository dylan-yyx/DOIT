import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../core/types'
import type { ChecklistEdit } from './checklist'
import { checksFor } from './logic'
import Icon from '../../components/Icon'

export default function TaskChecklist({
  task,
  day,
  request,
  onEdit,
  onCheck,
}: {
  task: Task
  day: string
  request: number
  onEdit: (edit: ChecklistEdit) => void
  onCheck: (id: string) => void
}) {
  const [adding, setAdding] = useState(false),
    [draft, setDraft] = useState('')
  const draftRef = useRef(''),
    input = useRef<HTMLInputElement>(null)
  const itemInputs = useRef(new Map<string, HTMLInputElement | null>())
  const checks = checksFor(task, day)
  useEffect(() => {
    if (request) setAdding(true)
  }, [request])
  useEffect(() => {
    if (adding) input.current?.focus()
  }, [adding, request])
  function addNext() {
    setAdding(true)
    input.current?.focus()
  }
  function commit(keepOpen: boolean) {
    const title = draftRef.current.trim()
    draftRef.current = ''
    setDraft('')
    if (title) onEdit({ type: 'add', title })
    if (!keepOpen) setAdding(false)
  }
  if (!task.checklist.length && !adding) return null
  return (
    <section className="detail-checklist" aria-label="检查事项">
      <div className="section-label">
        <span>检查事项</span>
        <div className="checklist-tools">
          <span className="muted">
            {task.checklist.filter((item) => checks.includes(item.id)).length} /{' '}
            {task.checklist.length}
          </span>
          <button
            className="icon-button"
            aria-label="添加下一条检查事项"
            title="添加检查事项"
            onClick={addNext}
          >
            <Icon name="Plus" size={14} />
          </button>
        </div>
      </div>
      {task.checklist.map((item, index) => (
        <div className={`detail-check ${checks.includes(item.id) ? 'checked' : ''}`} key={item.id}>
          <button
            className="square-check"
            aria-label={item.title || `完成检查事项 ${index + 1}`}
            aria-pressed={checks.includes(item.id)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCheck(item.id)}
          >
            {checks.includes(item.id) && <Icon name="Check" size={12} />}
          </button>
          <input
            ref={(element) => {
              itemInputs.current.set(item.id, element)
            }}
            className="detail-check-title"
            aria-label={`检查事项 ${index + 1}`}
            value={item.title}
            placeholder="输入检查事项"
            maxLength={200}
            onChange={(event) => onEdit({ type: 'rename', id: item.id, title: event.target.value })}
            onBlur={(event) => {
              const title = event.currentTarget.value.trim()
              if (!title) onEdit({ type: 'remove', id: item.id })
              else if (title !== event.currentTarget.value)
                onEdit({ type: 'rename', id: item.id, title })
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault()
                const next = task.checklist[index + 1]
                if (next) itemInputs.current.get(next.id)?.focus()
                else addNext()
              }
            }}
          />
          <button
            className="icon-button checklist-delete"
            aria-label={`删除检查事项 ${index + 1}`}
            title="删除检查事项"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onEdit({ type: 'remove', id: item.id })}
          >
            <Icon name="X" size={13} />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="detail-check check-composer">
          <span className="square-check" />
          <input
            ref={input}
            className="detail-check-title"
            aria-label="新增检查事项"
            placeholder="回车添加下一项"
            value={draft}
            maxLength={200}
            onChange={(event) => {
              draftRef.current = event.target.value
              setDraft(event.target.value)
            }}
            onBlur={() => commit(false)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault()
                commit(true)
              }
              if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                event.stopPropagation()
                draftRef.current = ''
                setDraft('')
                setAdding(false)
              }
            }}
          />
        </div>
      ) : (
        <button className="text-button add-detail-check" onClick={addNext}>
          <Icon name="Plus" size={13} />
          添加检查事项
        </button>
      )}
    </section>
  )
}
