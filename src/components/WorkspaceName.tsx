import { useState } from 'react'
import type { AppData } from '../core/types'
import Icon from './Icon'
import Modal from './Modal'

const defaultName = '我的生活空间'

export default function WorkspaceName({
  name,
  subtitle,
  onChange,
}: {
  name: string
  subtitle: string
  onChange: (fn: (data: AppData) => AppData) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayedName = name.trim() || defaultName
  return (
    <>
      <button
        type="button"
        className="workspace-name"
        title={`${displayedName} · 点击改名`}
        onClick={() => setDraft(name)}
      >
        <span className="workspace-avatar">
          <Icon name="Leaf" size={17} />
        </span>
        <span className="workspace-copy">
          <strong>{displayedName}</strong>
          <small>{subtitle}</small>
        </span>
        <Icon name="Pencil" size={12} />
      </button>
      {draft !== null && (
        <Modal title="重命名生活空间" onClose={() => setDraft(null)}>
          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault()
              onChange((data) => ({
                ...data,
                preferences: { ...data.preferences, name: draft.trim() },
              }))
              setDraft(null)
            }}
          >
            <label>
              生活空间名称
              <input
                value={draft}
                placeholder={defaultName}
                maxLength={40}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <p className="field-hint">留空可恢复默认名称。</p>
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setDraft(null)}>
                取消
              </button>
              <button type="submit" className="button primary">
                保存名称
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
