import type { AppData, Tag, TagGroup } from '../../core/types'
import { tagNameKey } from './notes'

export function withTagData(data: AppData): AppData {
  return {
    ...data,
    tagGroups: data.tagGroups || [],
    tags: data.tags.map((tag, index) => ({ ...tag, pinned: tag.pinned ?? index < 6 })),
  }
}
export function validateTagData(data: AppData) {
  if (
    data.tagGroups !== undefined &&
    (!Array.isArray(data.tagGroups) ||
      !data.tagGroups.every(
        (g) => g && typeof g.id === 'string' && typeof g.name === 'string' && g.name.trim(),
      ) ||
      new Set(data.tagGroups.map((g) => g.id)).size !== data.tagGroups.length)
  )
    return false
  return data.tags.every(
    (t) =>
      (t.pinned === undefined || typeof t.pinned === 'boolean') &&
      (t.groupId === undefined ||
        (typeof t.groupId === 'string' &&
          (!t.groupId || data.tagGroups?.some((g) => g.id === t.groupId)))),
  )
}
export function saveTag(data: AppData, tag: Tag): AppData {
  const name = tag.name.trim()
  if (!name || name.length > 40) throw new Error('标签名称需为 1–40 个字。')
  if (data.tags.some((t) => t.id !== tag.id && tagNameKey(t.name) === tagNameKey(name)))
    throw new Error('已有同名标签，请直接使用或编辑现有标签。')
  if (tag.groupId && !data.tagGroups?.some((g) => g.id === tag.groupId))
    throw new Error('这个分组已不存在，请重新选择。')
  const saved = { ...tag, name }
  return {
    ...data,
    tags: data.tags.some((t) => t.id === tag.id)
      ? data.tags.map((t) => (t.id === tag.id ? saved : t))
      : [...data.tags, saved],
  }
}
export function saveTagGroup(data: AppData, group: TagGroup): AppData {
  const name = group.name.trim()
  if (!name || name.length > 30) throw new Error('分组名称需为 1–30 个字。')
  const groups = data.tagGroups || []
  if (groups.some((g) => g.id !== group.id && tagNameKey(g.name) === tagNameKey(name)))
    throw new Error('已有同名分组。')
  return {
    ...data,
    tagGroups: groups.some((g) => g.id === group.id)
      ? groups.map((g) => (g.id === group.id ? { ...group, name } : g))
      : [...groups, { ...group, name }],
  }
}
export function deleteTags(data: AppData, ids: string[]): AppData {
  const removed = new Set(ids)
  return {
    ...data,
    tags: data.tags.filter((t) => !removed.has(t.id)),
    tasks: data.tasks.map((t) => ({ ...t, tagIds: t.tagIds.filter((id) => !removed.has(id)) })),
  }
}
export function deleteTagGroup(data: AppData, id: string): AppData {
  return {
    ...data,
    tagGroups: data.tagGroups?.filter((g) => g.id !== id),
    tags: data.tags.map((t) => (t.groupId === id ? { ...t, groupId: undefined } : t)),
  }
}
export function patchTags(
  data: AppData,
  ids: string[],
  patch: Pick<Partial<Tag>, 'groupId' | 'pinned'>,
): AppData {
  if (patch.groupId && !data.tagGroups?.some((g) => g.id === patch.groupId)) return data
  const selected = new Set(ids)
  return { ...data, tags: data.tags.map((t) => (selected.has(t.id) ? { ...t, ...patch } : t)) }
}
