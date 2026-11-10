import { describe, expect, it } from 'vitest'
import { createSeed } from '../../core/seed'
import { newTask, validateData } from './logic'
import { deleteTagGroup, deleteTags, patchTags, saveTag, saveTagGroup, withTagData } from './tags'
import { saveTaskWithNoteTags } from './notes'

function fixture() {
  let data = saveTagGroup(createSeed(), { id: 'books', name: '书籍' })
  data = saveTagGroup(data, { id: 'films', name: '影视' })
  data = saveTag(data, {
    id: 'literature',
    name: '文学',
    color: '#237b65',
    groupId: 'books',
    pinned: true,
  })
  data = saveTag(data, {
    id: 'scifi',
    name: '科幻',
    color: '#6b8ca9',
    groupId: 'books',
    pinned: false,
  })
  data.tasks = [{ ...newTask(), title: '一本书', tagIds: ['literature', 'scifi'] }]
  return data
}
describe('标签分组与侧栏管理', () => {
  it('旧标签仅默认固定前六个，显式取消固定不会在重启后恢复', () => {
    const data = createSeed()
    data.tags = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: String(i),
      color: '#237b65',
    }))
    const upgraded = withTagData(data)
    expect(upgraded.tags.filter((t) => t.pinned)).toHaveLength(6)
    expect(withTagData(patchTags(upgraded, ['0'], { pinned: false })).tags[0].pinned).toBe(false)
  })
  it('新标签支持归组和固定，并按规范化名称拒绝重复标签和分组', () => {
    const data = fixture()
    expect(validateData(data)).toBe(true)
    expect(() => saveTag(data, { id: 'other', name: ' 文学 ', color: '#237b65' })).toThrow('同名')
    expect(() => saveTagGroup(data, { id: 'other', name: ' 书籍 ' })).toThrow('同名')
    expect(() => saveTag(data, { id: 'other', name: '', color: '#237b65' })).toThrow()
    expect(() =>
      saveTag(data, { id: 'other', name: 'x', color: '#237b65', groupId: 'missing' }),
    ).toThrow()
  })
  it('批量归组、固定和改名不改变事项的标签 ID', () => {
    const data = fixture()
    const moved = patchTags(data, ['literature', 'scifi'], { groupId: 'films', pinned: true })
    const renamed = saveTag(moved, { ...moved.tags[0], name: '文学经典', color: '#937caf' })
    expect(renamed.tasks).toEqual(data.tasks)
    expect(renamed.tags.every((t) => t.groupId === 'films' && t.pinned)).toBe(true)
    expect(renamed.tags[0].id).toBe('literature')
  })
  it('删除分组只取消归组；删除标签只移除关联，保留事项和其他模块', () => {
    const data = fixture()
    const ungrouped = deleteTagGroup(data, 'books')
    expect(ungrouped.tags).toHaveLength(2)
    expect(ungrouped.tags.every((t) => !t.groupId)).toBe(true)
    expect(ungrouped.tasks).toEqual(data.tasks)
    const deleted = deleteTags(ungrouped, ['literature'])
    expect(deleted.tasks).toHaveLength(1)
    expect(deleted.tasks[0].tagIds).toEqual(['scifi'])
    expect(deleted.finance).toEqual(data.finance)
    expect(deleted.assets).toEqual(data.assets)
    expect(validateData(deleted)).toBe(true)
  })
  it('备注创建的新标签不占据侧栏，仍可复用已分组的标签', () => {
    const data = fixture()
    const next = saveTaskWithNoteTags(data, { ...newTask(), title: '另一项', notes: '#文学 #纪实' })
    expect(next.tags.find((t) => t.name === '文学')?.groupId).toBe('books')
    expect(next.tags.find((t) => t.name === '纪实')?.pinned).toBe(false)
    expect(validateData(next)).toBe(true)
  })
  it('备份保留分类和固定状态，拒绝断开的分组和无效字段', () => {
    const data = fixture()
    const restored = JSON.parse(JSON.stringify(data))
    expect(validateData(restored)).toBe(true)
    expect(restored).toEqual(data)
    for (const patch of [{ groupId: 'missing' }, { groupId: 1 }, { pinned: 'true' }])
      expect(validateData({ ...data, tags: [{ ...data.tags[0], ...patch }] })).toBe(false)
    expect(validateData({ ...data, tagGroups: null })).toBe(false)
    expect(validateData({ ...data, tagGroups: [data.tagGroups![0], data.tagGroups![0]] })).toBe(
      false,
    )
  })
})
