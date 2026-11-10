import type { AppData, Folder, TaskList } from '../../core/types'

export type DropSide = 'before' | 'after' | 'inside'
type Root = { kind: 'folder'; item: Folder } | { kind: 'list'; item: TaskList }

export function moveOrder(order: string[], source: string, target: string, side: DropSide) {
  if (source === target) return order
  const next = order.filter((key) => key !== source)
  const index = next.indexOf(target)
  next.splice(index < 0 ? next.length : index + Number(side === 'after'), 0, source)
  return next
}

export function sidebarRoots(data: AppData): Root[] {
  const roots: Root[] = [
    ...data.lists
      .filter((list) => !list.folderId && list.id !== 'inbox')
      .map((item) => ({ kind: 'list' as const, item })),
    ...data.folders.map((item) => ({ kind: 'folder' as const, item })),
  ]
  const order = new Map(data.taskSidebarOrder?.map((id, index) => [id, index]))
  const rank = (root: Root) => order.get(`${root.kind}:${root.item.id}`) ?? order.size
  return roots.sort((a, b) => rank(a) - rank(b))
}

export function moveSidebarEntry(data: AppData, source: string, target: string, side: DropSide) {
  if (source === target) return data
  const roots = sidebarRoots(data).map(({ kind, item }) => `${kind}:${item.id}`)
  const sourceList = data.lists.find((list) => list.id !== 'inbox' && `list:${list.id}` === source)
  const targetList = data.lists.find((list) => list.id !== 'inbox' && `list:${list.id}` === target)
  const targetFolder = data.folders.find((folder) => `folder:${folder.id}` === target)
  if (side === 'inside' && !targetFolder && target !== 'root') return data
  if (!sourceList) {
    if (!roots.includes(source) || !roots.includes(target) || side === 'inside') return data
    return { ...data, taskSidebarOrder: moveOrder(roots, source, target, side) }
  }
  if (!targetList && !targetFolder && target !== 'root') return data
  const folderId = side === 'inside' ? targetFolder?.id : targetList?.folderId
  const updated = { ...sourceList, folderId }
  const lists = folderId
    ? data.lists.filter((list) => list.id !== sourceList.id)
    : data.lists.map((list) => (list.id === sourceList.id ? updated : list))
  if (folderId) {
    const sibling = targetList ? lists.findIndex((list) => list.id === targetList.id) : -1
    lists.splice(sibling < 0 ? lists.length : sibling + Number(side === 'after'), 0, updated)
  }
  return {
    ...data,
    lists,
    folders: folderId
      ? data.folders.map((folder) =>
          folder.id === folderId && folder.collapsed ? { ...folder, collapsed: false } : folder,
        )
      : data.folders,
    taskSidebarOrder: folderId
      ? roots.filter((id) => id !== source)
      : moveOrder(roots, source, target, side),
  }
}
