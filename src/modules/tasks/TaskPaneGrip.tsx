import { useEffect, useRef, useState } from 'react'

type Side = 'left' | 'right'
const storageKey = 'doit-task-pane-widths'
const gripWidth = 6
const minWidth = { left: 160, right: 240 }
const maxWidth = { left: 480, right: 640 }
const clamp = (width: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, width)))

export function useTaskPaneWidths(hasDetail: boolean) {
  const [viewport, setViewport] = useState(window.innerWidth)
  const [preferred, setPreferred] = useState<Partial<Record<Side, number>>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return {
        left: Number.isFinite(stored?.left) ? stored.left : undefined,
        right: Number.isFinite(stored?.right) ? stored.right : undefined,
      }
    } catch {
      return {}
    }
  })
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferred))
    } catch {
      // The current window still keeps its widths if local storage is unavailable.
    }
  }, [preferred])

  const compact = viewport <= 1260
  // Reserve room for the module rail, separators and the main task controls.
  const available = Math.max(1000, viewport) - 73 - 460 - gripWidth * (hasDetail ? 2 : 1)
  const left = clamp(
    preferred.left ?? (compact ? 200 : 224),
    minWidth.left,
    Math.min(maxWidth.left, available - (hasDetail ? minWidth.right : 0)),
  )
  const rightMax = Math.min(maxWidth.right, available - left)
  const right = clamp(
    preferred.right ?? (compact ? 284 : viewport >= 1600 ? 350 : 320),
    minWidth.right,
    rightMax,
  )
  const leftMax = Math.min(maxWidth.left, available - (hasDetail ? right : 0))
  function resize(side: Side, width: number) {
    const current = side === 'left' ? left : right
    const next = clamp(width, minWidth[side], side === 'left' ? leftMax : rightMax)
    if (next !== current) setPreferred((old) => ({ ...old, [side]: next }))
  }
  return { left, right, leftMax, rightMax, resize }
}

export default function TaskPaneGrip({
  side,
  width,
  max,
  onResize,
}: {
  side: Side
  width: number
  max: number
  onResize: (width: number) => void
}) {
  const drag = useRef<{ x: number; width: number } | null>(null)
  const direction = side === 'left' ? 1 : -1
  return (
    <div
      className="task-pane-grip"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={side === 'left' ? '调整左侧清单栏宽度' : '调整右侧详情栏宽度'}
      aria-valuemin={minWidth[side]}
      aria-valuemax={max}
      aria-valuenow={width}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        drag.current = { x: event.clientX, width }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (drag.current)
          onResize(drag.current.width + (event.clientX - drag.current.x) * direction)
      }}
      onLostPointerCapture={() => {
        drag.current = null
      }}
      onKeyDown={(event) => {
        let next: number
        if (event.key === 'ArrowLeft') next = width - 16 * direction
        else if (event.key === 'ArrowRight') next = width + 16 * direction
        else if (event.key === 'Home') next = minWidth[side]
        else if (event.key === 'End') next = max
        else return
        event.preventDefault()
        onResize(next)
      }}
    />
  )
}
