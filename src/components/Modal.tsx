import { useEffect, useRef } from 'react'
import Icon from './Icon'
export default function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  className = '',
  hideHeading = false,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
  className?: string
  hideHeading?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const firstInput = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled)',
      ) || [],
    ).find((element) => element.getClientRects().length > 0)
    const activeTab = ref.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    ;(firstInput || activeTab || ref.current)?.focus()
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not([hidden]):not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) || [],
        ).filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0)
        const first = focusable[0],
          last = focusable.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''} ${className}`}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {!hideHeading && (
          <div className="modal-heading">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button className="icon-button" onClick={onClose} aria-label="关闭弹窗">
              <Icon name="X" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
