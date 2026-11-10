import { useRef, useState } from 'react'
import Modal from './Modal'

const confirmation = '清空数据'

export default function ClearModulesDialog({
  names,
  onClear,
  onClose,
}: {
  names: string
  onClear: () => Promise<void>
  onClose: () => void
}) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const clearing = useRef(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (clearing.current || input.trim() !== confirmation) return
    clearing.current = true
    setBusy(true)
    setError('')
    try {
      await onClear()
    } catch (err) {
      setError(`清空失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      clearing.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      title="确认清空模块数据"
      subtitle={`将清空以下模块的数据：${names}。`}
      onClose={() => {
        if (!clearing.current) onClose()
      }}
    >
      <form className="task-form" onSubmit={submit}>
        {window.desktop && <p className="clear-data-note">清空前会在本机数据目录保存完整备份。</p>}
        <label>
          输入「{confirmation}」确认
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="清空确认词"
            disabled={busy}
            autoComplete="off"
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="submit"
            className="button danger-button"
            disabled={busy || input.trim() !== confirmation}
          >
            {busy ? '正在清空…' : '确认清空'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
