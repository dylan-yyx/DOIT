import { useLayoutEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'

export default function TaskNotes({
  notes,
  onChange,
}: {
  notes: string
  onChange: (notes: string, convertTags: boolean) => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  useLayoutEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.max(96, input.current.scrollHeight)}px`
  }, [notes])
  return (
    <section className="detail-notes">
      <div className="section-label">
        <span>备注</span>
        <button
          className="icon-button"
          title="编辑备注"
          aria-label="编辑备注"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => input.current?.focus()}
        >
          <Icon name="Pencil" size={13} />
        </button>
      </div>
      <textarea
        ref={input}
        className="detail-notes-input"
        aria-label="备注"
        value={notes}
        placeholder="点击这里输入备注，支持 #标签……"
        onFocus={() => setFocused(true)}
        onChange={(event) => onChange(event.target.value, false)}
        onBlur={(event) => {
          setFocused(false)
          onChange(event.currentTarget.value, true)
        }}
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      <p
        className="inline-edit-hint"
        style={{ visibility: focused ? 'visible' : 'hidden' }}
        aria-hidden={!focused}
      >
        自动保存 · 离开备注时，#文字 会转为标签
      </p>
    </section>
  )
}
