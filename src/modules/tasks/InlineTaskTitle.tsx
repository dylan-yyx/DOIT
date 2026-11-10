import { useRef, useState } from 'react'

export default function InlineTaskTitle({
  title,
  onRename,
  onOpen,
}: {
  title: string
  onRename: (title: string) => void
  onOpen?: () => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  if (draft === null) {
    return (
      <button
        type="button"
        className="inline-task-title"
        title={`点击改名 · ${title}`}
        aria-label={`改名 ${title}`}
        onClick={(event) => {
          event.stopPropagation()
          onOpen?.()
          cancelled.current = false
          setDraft(title)
        }}
      >
        {title}
      </button>
    )
  }
  return (
    <input
      className="inline-task-title-input"
      aria-label="修改事项名称"
      value={draft}
      maxLength={200}
      autoFocus
      onFocus={(event) => event.target.select()}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (!cancelled.current && next && next !== title) onRename(next)
        setDraft(null)
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancelled.current = event.key === 'Escape'
          event.currentTarget.blur()
        }
      }}
    />
  )
}
