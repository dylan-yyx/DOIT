import { useState, type DragEvent } from 'react'
import type { DropSide } from './order'

export function useReorderDrag(onMove: (source: string, target: string, side: DropSide) => void) {
  const [source, setSource] = useState('')
  const [hint, setHint] = useState<{ target: string; side: DropSide } | null>(null)
  function clear() {
    setSource('')
    setHint(null)
  }
  function handle(id: string, siblings: string[]) {
    return {
      draggable: true,
      onDragStart(event: DragEvent<HTMLButtonElement>) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-doit-order', id)
        setSource(id)
      },
      onDragEnd: clear,
      onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
        const up = event.key === 'ArrowUp'
        const neighbor = siblings[siblings.indexOf(id) + (up ? -1 : 1)]
        if (!neighbor) return
        event.preventDefault()
        onMove(id, neighbor, up ? 'before' : 'after')
      },
    }
  }
  function target(id: string, { accepts = true, inside = false, append = false } = {}) {
    function sideAt(event: DragEvent<HTMLElement>): DropSide {
      if (append) return 'inside'
      const box = event.currentTarget.getBoundingClientRect()
      const fraction = (event.clientY - box.top) / box.height
      if (inside && fraction >= 0.27 && fraction <= 0.73) return 'inside'
      return fraction < 0.5 ? 'before' : 'after'
    }
    return {
      'data-drop-side': hint?.target === id ? hint.side : undefined,
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!accepts || !source || source === id) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        const side = sideAt(event)
        setHint((old) => (old?.target === id && old.side === side ? old : { target: id, side }))
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          return
        setHint((old) => (old?.target === id ? null : old))
      },
      onDrop(event: DragEvent<HTMLElement>) {
        if (!accepts || !source || source === id) return
        event.preventDefault()
        onMove(source, id, sideAt(event))
        clear()
      },
    }
  }
  return { source, handle, target }
}
