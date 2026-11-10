import { describe, expect, it } from 'vitest'
import { createLegacySeed as createSeed } from '../../core/legacy-examples'
import { newTask, toggleCheck, toggleComplete, isCompleted, validateData } from './logic'
import { parseNoteTags, saveTaskWithNoteTags } from './notes'
import { editChecklist } from './checklist'

const day = '2026-11-07'
const task = () => ({ ...newTask('inbox', day), title: '直接编辑' })

describe('备注转为标签', () => {
  it('提取中文、英文、数字标签，保留说明文字', () => {
    expect(parseNoteTags('每天阅读。 #阅读 #book-2026\n今天记下一个想法。')).toEqual({
      notes: '每天阅读。\n今天记下一个想法。',
      names: ['阅读', 'book-2026'],
    })
  })
  it('复用同名标签，重复标签只添加一次', () => {
    const data = createSeed(),
      t = { ...task(), notes: '#自我提升 #自我提升 #新标签 #新标签' }
    const saved = saveTaskWithNoteTags(data, t)
    const item = saved.tasks.find((item) => item.id === t.id)!
    expect(saved.tags.length).toBe(data.tags.length + 1)
    expect(item.tagIds).toContain('self')
    expect(item.tagIds.length).toBe(2)
    expect(item.notes).toBe('')
    expect(validateData(saved)).toBe(true)
  })
  it('全角井号与大小写不创建重复标签', () => {
    const parsed = parseNoteTags('#Reading ＃reading #READING')
    expect(parsed.names).toEqual(['Reading'])
    expect(parsed.notes).toBe('')
  })
  it('保留普通备注、Markdown 标题、URL 锚点、C# 和转义文字', () => {
    for (const notes of [
      '第一行\n\n  原样保留  ',
      '# 一个标题\n## 第二级标题',
      'https://example.com/#章节',
      '学习 C#编程',
      '\\#普通文字',
    ]) {
      expect(parseNoteTags(notes)).toEqual({ notes, names: [] })
    }
  })
  it('拒绝把超过标签长度限制的文字截断成标签', () => {
    const notes = '#' + '中'.repeat(41)
    expect(parseNoteTags(notes).names).toEqual([])
  })
  it('预览不修改全局标签，取消创建不会留下空标签', () => {
    const data = createSeed(),
      original = structuredClone(data)
    parseNoteTags('#取消后不创建')
    expect(data).toEqual(original)
  })
  it('保存时保留手动选择的标签和现有进度', () => {
    const data = createSeed(),
      t = { ...data.tasks[0], notes: '新备注 #阅读' }
    const saved = saveTaskWithNoteTags(data, t).tasks.find((item) => item.id === t.id)!
    expect(saved.tagIds).toEqual(expect.arrayContaining(t.tagIds))
    expect(saved.entries).toEqual(t.entries)
    expect(saved.notes).toBe('新备注')
  })
})

describe('详情内编辑检查事项', () => {
  it('在已完成事项里增加检查事项会重新打开', () => {
    const completed = toggleComplete(task(), day)
    const changed = editChecklist(completed, { type: 'add', title: '新增的一步' }, day)
    expect(changed.checklist[0].title).toBe('新增的一步')
    expect(isCompleted(changed, day)).toBe(false)
  })
  it('修改标题保留 ID、勾选状态和完成日期', () => {
    let t = editChecklist(task(), { type: 'add', title: '原来的一步' }, day)
    const id = t.checklist[0].id
    t = toggleCheck(t, id, day)
    const changed = editChecklist(t, { type: 'rename', id, title: '修改后的一步' }, day)
    expect(changed.checklist).toEqual([{ id, title: '修改后的一步' }])
    expect(changed.occurrences).toEqual(t.occurrences)
    expect(isCompleted(changed, day)).toBe(true)
  })
  it('删除未完成项后，剩余项已全部勾选时自动完成', () => {
    let t = editChecklist(task(), { type: 'add', title: '第一步' }, day)
    t = editChecklist(t, { type: 'add', title: '第二步' }, day)
    t = toggleCheck(t, t.checklist[0].id, day)
    const changed = editChecklist(t, { type: 'remove', id: t.checklist[1].id }, day)
    expect(isCompleted(changed, day)).toBe(true)
  })
  it('删掉全部检查项不意外改变事项原来的完成状态', () => {
    let t = editChecklist(task(), { type: 'add', title: '第一步' }, day)
    expect(editChecklist(t, { type: 'remove', id: t.checklist[0].id }, day).completed).toBe(false)
    t = toggleCheck(t, t.checklist[0].id, day)
    expect(editChecklist(t, { type: 'remove', id: t.checklist[0].id }, day).completed).toBe(true)
  })
  it('重复事项的结构编辑只更新当前日期的完成状态', () => {
    let t = editChecklist({ ...task(), repeat: 'daily' }, { type: 'add', title: '每天一步' }, day)
    t = toggleCheck(t, t.checklist[0].id, '2026-11-06')
    t = toggleCheck(t, t.checklist[0].id, day)
    const changed = editChecklist(t, { type: 'add', title: '今天补充' }, day)
    expect(isCompleted(changed, day)).toBe(false)
    expect(changed.occurrences['2026-11-06']).toEqual(t.occurrences['2026-11-06'])
    expect(changed.occurrences['2026-11-08']).toBeUndefined()
  })
  it('忽略空白新增项及对已删除检查项的勾选', () => {
    const t = task()
    expect(editChecklist(t, { type: 'add', title: '   ' }, day)).toBe(t)
    expect(toggleCheck(t, 'missing', day)).toBe(t)
  })
})
