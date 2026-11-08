import type { AppData, Task } from '../../core/types'

export function tagNameKey(name: string) {
  return name.normalize('NFKC').toLowerCase()
}

/** Recognize standalone hashtags, while leaving URLs, C# and Markdown headings alone. */
export function parseNoteTags(notes: string): { notes: string; names: string[] } {
  const names: string[] = []
  const seen = new Set<string>()
  const pattern =
    /(^|[\s，。；、！？（）【】「」“”‘’,:;!?()[\]{}<>])[#＃]([\p{L}\p{N}_-]{1,40})(?![\p{L}\p{N}_-])/gu
  const body = notes.replace(pattern, (_match, boundary: string, name: string) => {
    const key = tagNameKey(name)
    if (!seen.has(key)) {
      names.push(name)
      seen.add(key)
    }
    return boundary
  })
  return {
    notes: names.length
      ? body
          .replace(/[ \t]+$/gm, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      : notes,
    names,
  }
}

/** Create tags and save the task together, so persistence never sees dangling tag IDs. */
export function saveTaskWithNoteTags(data: AppData, task: Task): AppData {
  const parsed = parseNoteTags(task.notes)
  const tags = [...data.tags]
  const tagIds = new Set(task.tagIds)
  for (const name of parsed.names) {
    let tag = tags.find((candidate) => tagNameKey(candidate.name) === tagNameKey(name))
    if (!tag) {
      tag = { id: crypto.randomUUID(), name, color: '#548f76' }
      tags.push(tag)
    }
    tagIds.add(tag.id)
  }
  const saved = { ...task, notes: parsed.notes, tagIds: [...tagIds] }
  return {
    ...data,
    tags,
    tasks: data.tasks.some((item) => item.id === task.id)
      ? data.tasks.map((item) => (item.id === task.id ? saved : item))
      : [...data.tasks, saved],
  }
}
