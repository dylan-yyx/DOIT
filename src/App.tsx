import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, Filter, Tag, Task, TaskSort, View } from './core/types'
import {
  addDays,
  dateKey,
  friendlyDate,
  moveMonth,
  parseDate,
  shortDate,
  startOfWeek,
} from './core/dates'
import { createSeed } from './core/seed'
import { exportData, loadData, saveData } from './core/storage'
import { clearModuleData } from './core/clear-modules'
import { modules, type ModuleId } from './modules/registry'
import { saveTaskWithNoteTags } from './modules/tasks/notes'
import { editChecklist, type ChecklistEdit } from './modules/tasks/checklist'
import {
  isCompleted,
  newTask,
  occursOn,
  spansMultipleDays,
  taskDisplayDay,
  toggleCheck,
  toggleComplete,
  validateData,
  type TaskDates,
} from './modules/tasks/logic'
import Icon from './components/Icon'
import CompletionSummary from './components/CompletionSummary'
import Modal from './components/Modal'
import ClearModulesDialog from './components/ClearModulesDialog'
import Sidebar from './components/Sidebar'
import EntityEditor, {
  type Entity,
  type EntityDraft,
  type EntityKind,
} from './components/EntityEditor'
import TaskEditor from './modules/tasks/TaskEditor'
import TaskDetail from './modules/tasks/TaskDetail'
import TaskPaneGrip, { useTaskPaneWidths } from './modules/tasks/TaskPaneGrip'
import TaskListView, { type TaskRow } from './modules/tasks/TaskListView'
import CalendarView from './modules/tasks/CalendarView'
import { moveOrder, type DropSide } from './modules/tasks/order'
import HabitBoard from './modules/habits/HabitBoard'
import FinanceBoard from './modules/finance/FinanceBoard'
import AssetBoard from './modules/assets/AssetBoard'
import SettingsDialog, { type SettingsSectionId } from './components/SettingsDialog'
import { applyAppearance } from './core/appearance'
import { upgradeData } from './core/migrations'
import { saveTag } from './modules/tasks/tags'

const titleOrder = new Intl.Collator('zh-CN-u-co-pinyin', { numeric: true })

export default function App() {
  const [data, setData] = useState<AppData | null>(null),
    [bootError, setBootError] = useState(''),
    [module, setModule] = useState<ModuleId>('tasks')
  const [filter, setFilter] = useState<Filter>({ kind: 'smart', id: 'today' }),
    [calendarView, setCalendarView] = useState<Exclude<View, 'list'>>('month'),
    [anchor, setAnchor] = useState(dateKey()),
    [today, setToday] = useState(dateKey)
  const [selected, setSelected] = useState<{ id: string; day: string } | null>(null),
    [editor, setEditor] = useState<Task | null>(null),
    [entity, setEntity] = useState<EntityDraft | null>(null)
  const [detailOpen, setDetailOpen] = useState(true)
  const [settings, setSettings] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [search, setSearch] = useState('')
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('appearance')
  const [clearRequest, setClearRequest] = useState<ModuleId[] | null>(null)
  const [clearBackup, setClearBackup] = useState('')
  const [moduleReset, setModuleReset] = useState(0)
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null),
    [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saved'),
    [saveError, setSaveError] = useState(''),
    [path, setPath] = useState('')
  const [confirm, setConfirm] = useState<{
      title: string
      message: string
      action: () => void
      danger?: boolean
    } | null>(null),
    [pendingImport, setPendingImport] = useState<AppData | null>(null)
  const searchRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null)
  const savedClear = useRef<AppData | null>(null)
  const notify = useCallback(
    (message: string, undo?: () => void) => setToast({ message, undo }),
    [],
  )
  useEffect(() => {
    applyAppearance(data?.preferences.appearance)
  }, [data?.preferences.appearance])
  useEffect(() => {
    function refreshDate() {
      const next = dateKey()
      if (next === today) return
      setToday(next)
      setAnchor((day) => (day === today ? next : day))
      setSelected((value) => (value?.day === today ? { ...value, day: next } : value))
    }
    const timer = setInterval(refreshDate, 30_000)
    window.addEventListener('focus', refreshDate)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refreshDate)
    }
  }, [today])
  useEffect(() => {
    let active = true
    loadData()
      .then((value) => {
        if (active) {
          const initial = value || createSeed()
          setData(initial)
        }
      })
      .catch((e) => {
        if (active) setBootError(String(e.message || e))
      })
    window.desktop?.dataPath().then(setPath)
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!data || bootError) return
    if (data === savedClear.current) {
      savedClear.current = null
      return
    }
    let active = true
    setStatus('saving')
    saveData(data)
      .then(() => {
        if (active) {
          setStatus('saved')
          setSaveError('')
        }
      })
      .catch((e) => {
        if (active) {
          setStatus('error')
          setSaveError(String(e.message || e))
        }
      })
    return () => {
      active = false
    }
  }, [data, bootError])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6500)
    return () => clearTimeout(timer)
  }, [toast])
  const change = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), [])
  function patchTask(task: Task) {
    change((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? task : t)) }))
  }
  function renameTask(id: string, title: string) {
    change((d) => ({
      ...d,
      tasks: d.tasks.map((task) => (task.id === id ? { ...task, title } : task)),
    }))
  }
  function changeNotes(id: string, notes: string, convertTags: boolean) {
    change((d) => {
      const task = d.tasks.find((item) => item.id === id)
      if (!task) return d
      if (convertTags) return saveTaskWithNoteTags(d, { ...task, notes })
      return { ...d, tasks: d.tasks.map((item) => (item.id === id ? { ...item, notes } : item)) }
    })
  }
  function changeChecklist(id: string, edit: ChecklistEdit, day: string) {
    change((d) => ({
      ...d,
      tasks: d.tasks.map((task) => (task.id === id ? editChecklist(task, edit, day) : task)),
    }))
  }
  function checkTask(id: string, checkId: string, day: string) {
    change((d) => ({
      ...d,
      tasks: d.tasks.map((task) => (task.id === id ? toggleCheck(task, checkId, day) : task)),
    }))
  }
  const create = useCallback(
    (day?: string) => {
      const task = newTask(filter.kind === 'list' ? filter.id : 'inbox', day || dateKey())
      if (filter.kind === 'tag') task.tagIds = [filter.id]
      setEditor(task)
      setFiltersOpen(false)
    },
    [filter],
  )
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'k' &&
        !document.querySelector('[role="dialog"]') &&
        module !== 'finance' &&
        module !== 'assets'
      ) {
        e.preventDefault()
        setModule('tasks')
        searchRef.current?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (module === 'tasks' && !document.querySelector('[role="dialog"]')) create()
      }
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setSearch('')
        setFiltersOpen(false)
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [create, module])
  function chooseFilter(f: Filter) {
    setFilter(f)
    setSearch('')
    setAnchor(today)
    setSelected(null)
    setFiltersOpen(false)
    if (f.kind === 'smart' && f.id === 'all') setCalendarView('month')
  }
  function selectTask(id: string, day: string) {
    setSelected({ id, day })
    setDetailOpen(true)
  }
  useEffect(() => {
    if (data && filter.kind === 'tag' && !data.tags.some((tag) => tag.id === filter.id)) {
      setFilter({ kind: 'smart', id: 'all' })
      setCalendarView('month')
      setSelected(null)
    }
  }, [data?.tags, filter])
  const filteredTasks = useMemo(() => {
    if (!data) return []
    let tasks = data.tasks
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase()
      return tasks.filter((t) =>
        [
          t.title,
          t.notes,
          ...t.checklist.map((c) => c.title),
          ...t.tagIds.map((id) => data.tags.find((g) => g.id === id)?.name || ''),
        ].some((s) => s.toLocaleLowerCase().includes(q)),
      )
    }
    if (filter.kind === 'list') tasks = tasks.filter((t) => t.listId === filter.id)
    if (filter.kind === 'tag') tasks = tasks.filter((t) => t.tagIds.includes(filter.id))
    if (filter.kind === 'smart' && filter.id === 'inbox')
      tasks = tasks.filter((t) => t.listId === 'inbox')
    if (filter.kind === 'smart' && filter.id === 'completed')
      tasks = tasks.filter(
        (t) => isCompleted(t, today) || Object.values(t.occurrences).some((o) => o.completed),
      )
    return tasks
  }, [data, filter, search, today])
  const searching = Boolean(search.trim())
  const view = !searching && filter.kind === 'smart' && filter.id === 'all' ? calendarView : 'list'
  const sortScope = searching ? 'search' : `${filter.kind}:${filter.id}`
  const listSorting = data?.taskListSorting?.[sortScope]
  const sort = listSorting?.mode || data?.preferences.taskSort || 'time'
  const rows = useMemo(() => {
    const result: TaskRow[] = []
    for (const task of filteredTasks) {
      if (search.trim()) {
        result.push({ task, day: taskDisplayDay(task, today) })
        continue
      }
      if (filter.kind === 'smart' && filter.id === 'completed') {
        if (task.repeat === 'none') {
          if (isCompleted(task, today)) result.push({ task, day: task.dueDate || today })
        } else
          for (const [day, o] of Object.entries(task.occurrences))
            if (o.completed && day !== 'once') result.push({ task, day })
      } else if (filter.kind === 'smart' && filter.id === 'today') {
        if (
          occursOn(task, anchor) ||
          (task.repeat === 'none' &&
            task.dueDate &&
            task.dueDate < anchor &&
            !isCompleted(task, anchor))
        )
          result.push({ task, day: task.repeat === 'none' ? taskDisplayDay(task, anchor) : anchor })
      } else if (filter.kind === 'smart' && filter.id === 'upcoming') {
        for (let i = 0; i < 7; i++) {
          const day = addDays(anchor, i)
          if (occursOn(task, day)) {
            result.push({ task, day })
            if (task.repeat === 'none') break
          }
        }
      } else result.push({ task, day: taskDisplayDay(task, today) })
    }
    const priority = { high: 0, medium: 1, low: 2, none: 3 }
    function scheduledAt({ task, day }: TaskRow) {
      const date =
        task.repeat !== 'none'
          ? day
          : spansMultipleDays(task)
            ? task.startDate
            : task.dueDate || '9999-12-31'
      return `${date}T${task.timeMode === 'allday' ? '00:00' : task.startTime}`
    }
    const manual = new Map(listSorting?.order?.map((id, index) => [id, index]))
    return result.sort((a, b) => {
      if (sort === 'custom') {
        const difference =
          (manual.get(a.task.id) ?? manual.size) - (manual.get(b.task.id) ?? manual.size)
        if (difference) return difference
      }
      if (sort === 'created') return b.task.createdAt.localeCompare(a.task.createdAt)
      if (sort === 'title') {
        const difference = titleOrder.compare(a.task.title, b.task.title)
        if (difference) return difference
      }
      if (sort === 'priority') {
        const difference = priority[a.task.priority] - priority[b.task.priority]
        if (difference) return difference
      }
      return scheduledAt(a).localeCompare(scheduledAt(b))
    })
  }, [filteredTasks, search, filter, anchor, today, sort, listSorting])
  function selectSort(mode: TaskSort) {
    change((d) => {
      const existing = d.taskListSorting?.[sortScope]?.order
      const order =
        mode === 'custom' && !existing ? [...new Set(rows.map(({ task }) => task.id))] : existing
      return { ...d, taskListSorting: { ...d.taskListSorting, [sortScope]: { mode, order } } }
    })
    setFiltersOpen(false)
  }
  function reorderTasks(source: string, target: string, side: DropSide) {
    change((d) => {
      const sorting = d.taskListSorting?.[sortScope]
      if (sorting?.mode !== 'custom') return d
      const taskIds = new Set(d.tasks.map((task) => task.id))
      const order = [
        ...new Set([...(sorting.order || []), ...rows.map(({ task }) => task.id)]),
      ].filter((id) => taskIds.has(id))
      if (!order.includes(source) || !order.includes(target)) return d
      return {
        ...d,
        taskListSorting: {
          ...d.taskListSorting,
          [sortScope]: { mode: 'custom', order: moveOrder(order, source, target, side) },
        },
      }
    })
  }
  function toggleTask(taskId: string, day: string) {
    change((d) => ({
      ...d,
      tasks: d.tasks.map((task) => (task.id === taskId ? toggleComplete(task, day) : task)),
    }))
  }
  const selectedTask = data?.tasks.find((t) => t.id === selected?.id)
  const panes = useTaskPaneWidths(detailOpen)
  const title = search.trim()
    ? '搜索结果'
    : filter.kind === 'list'
      ? data?.lists.find((l) => l.id === filter.id)?.name || '清单'
      : filter.kind === 'tag'
        ? `# ${data?.tags.find((t) => t.id === filter.id)?.name || '标签'}`
        : {
            today: '我的一天',
            upcoming: '最近七天',
            all: '全部事项',
            inbox: '收集箱',
            completed: '已完成',
          }[filter.id]
  const showDaySummary = !searching && filter.kind === 'smart' && filter.id === 'today'
  const dayPlan = showDaySummary ? data?.tasks.filter((task) => occursOn(task, anchor)) || [] : []
  const dayCompleted = dayPlan.filter((task) => isCompleted(task, anchor)).length
  function saveTask(task: Task) {
    change((d) => saveTaskWithNoteTags(d, task))
    selectTask(task.id, taskDisplayDay(task, today))
    setEditor(null)
    notify('事项已保存')
  }
  function saveTaskDates(task: Task, dates: TaskDates) {
    const updated = { ...task, ...dates }
    change((d) => ({
      ...d,
      tasks: d.tasks.map((item) => (item.id === task.id ? { ...item, ...dates } : item)),
    }))
    setSelected({
      id: task.id,
      day: taskDisplayDay(updated, today),
    })
    notify('日期已更新')
  }

  async function confirmClearModules() {
    if (!data || !clearRequest?.length || status !== 'saved')
      throw new Error('请等待当前数据保存完成。')
    const next = clearModuleData(data, clearRequest)
    const backup = await saveData(next, true)
    savedClear.current = next
    setData(next)
    if (clearRequest.includes('tasks')) {
      chooseFilter({ kind: 'smart', id: 'today' })
      setEditor(null)
      setEntity(null)
    }
    if (clearRequest.includes(module)) setModuleReset((value) => value + 1)
    setClearBackup(backup || '')
    setClearRequest(null)
    notify('所选模块已清空')
  }
  function quickCreate(title: string) {
    const task = newTask(
      filter.kind === 'list' ? filter.id : 'inbox',
      filter.kind === 'smart' && filter.id === 'today' ? anchor : '',
    )
    task.title = title
    if (filter.kind === 'tag') task.tagIds = [filter.id]
    saveTask(task)
  }
  function deleteTask(task: Task) {
    change((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }))
    setSelected(null)
    notify('事项已删除', () =>
      change((d) => ({
        ...d,
        tasks: d.tasks.some((t) => t.id === task.id) ? d.tasks : [...d.tasks, task],
      })),
    )
  }
  function saveEntity(kind: EntityKind, value: Entity) {
    if (kind === 'tag') {
      change((d) => saveTag(d, value as Tag))
      setEntity(null)
      notify('已保存')
      return
    }
    const key = kind === 'list' ? 'lists' : kind === 'folder' ? 'folders' : 'tags'
    change((d) => {
      const editing = d[key].some((item) => item.id === value.id)
      const folderToOpen = !editing && kind === 'list' && 'folderId' in value ? value.folderId : ''
      return {
        ...d,
        folders: folderToOpen
          ? d.folders.map((folder) =>
              folder.id === folderToOpen && folder.collapsed
                ? { ...folder, collapsed: false }
                : folder,
            )
          : d.folders,
        [key]: editing
          ? d[key].map((item) => (item.id === value.id ? value : item))
          : [...d[key], value],
      }
    })
    setEntity(null)
    notify('已保存')
  }
  function requestDeleteEntity(kind: EntityKind, value: Entity) {
    setEntity(null)
    setConfirm({
      title: `删除“${value.name}”？`,
      message:
        kind === 'list'
          ? '此清单的事项将移至收集箱，事项与进度记录都会保留。'
          : kind === 'folder'
            ? '文件夹中的清单将保留，并移到外层。'
            : '标签将从关联事项中移除，事项本身会保留。',
      danger: true,
      action: () => {
        change((d) =>
          kind === 'list'
            ? {
                ...d,
                lists: d.lists.filter((l) => l.id !== value.id),
                tasks: d.tasks.map((t) => (t.listId === value.id ? { ...t, listId: 'inbox' } : t)),
              }
            : kind === 'folder'
              ? {
                  ...d,
                  folders: d.folders.filter((f) => f.id !== value.id),
                  lists: d.lists.map((l) =>
                    l.folderId === value.id ? { ...l, folderId: undefined } : l,
                  ),
                }
              : {
                  ...d,
                  tags: d.tags.filter((t) => t.id !== value.id),
                  tasks: d.tasks.map((t) => ({
                    ...t,
                    tagIds: t.tagIds.filter((id) => id !== value.id),
                  })),
                },
        )
        chooseFilter({ kind: 'smart', id: 'today' })
        notify('已删除，关联事项已保留')
      },
    })
  }
  async function doExport() {
    if (!data) return
    try {
      if (await exportData(data)) notify('备份已导出')
    } catch (e) {
      notify(`导出失败：${String((e as Error).message)}`)
    }
  }
  function parseImport(value: unknown) {
    if (!validateData(value)) {
      notify('无法导入：文件不是完整的 DOIT 备份。')
      return
    }
    setPendingImport(upgradeData(value))
  }
  async function doImport() {
    try {
      if (window.desktop) {
        const value = await window.desktop.importData()
        if (value !== null) parseImport(value)
      } else importRef.current?.click()
    } catch (e) {
      notify(`无法读取备份：${String((e as Error).message)}`)
    }
  }
  async function restoreBoot() {
    try {
      if (!window.desktop) {
        importRef.current?.click()
        return
      }
      const value = await window.desktop.importData()
      if (value === null) return
      if (!validateData(value)) {
        notify('备份格式不正确')
        return
      }
      setPendingImport(upgradeData(value))
    } catch (e) {
      notify(String((e as Error).message))
    }
  }
  const closeEditor = useCallback(() => setEditor(null), []),
    closeEntity = useCallback(() => setEntity(null), []),
    closeSettings = useCallback(() => setSettings(false), [])
  const period =
    view === 'month'
      ? `${parseDate(anchor).getFullYear()} 年 ${parseDate(anchor).getMonth() + 1} 月`
      : view === 'week'
        ? `${shortDate(startOfWeek(anchor))} — ${shortDate(addDays(startOfWeek(anchor), 6))}`
        : friendlyDate(anchor)
  function move(step: number) {
    setAnchor(
      view === 'month'
        ? moveMonth(anchor, step)
        : addDays(anchor, view === 'week' ? step * 7 : step),
    )
  }
  const newTaskButton = (
    <button type="button" className="button primary" onClick={() => create(anchor)}>
      <Icon name="Plus" size={16} />
      新建事项
    </button>
  )
  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="titlebar-brand">
          <span className="mini-brand">d.</span> DOIT <span>拾序</span>
        </div>
        <span className="titlebar-motto">日常，自有章法</span>
        <div className="window-controls">
          <button aria-label="最小化" onClick={() => window.desktop?.window('minimize')}>
            <Icon name="Minus" size={14} />
          </button>
          <button aria-label="最大化" onClick={() => window.desktop?.window('maximize')}>
            <Icon name="Square" size={11} />
          </button>
          <button
            className="close-window"
            aria-label="关闭软件"
            onClick={() => window.desktop?.window('close')}
          >
            <Icon name="X" size={15} />
          </button>
        </div>
      </header>
      {!data ? (
        <div className="boot-state">
          <div className="brand-logo">
            d<span>.</span>
          </div>
          <h2>{bootError ? '本地数据需要恢复' : '让日常，慢慢有序'}</h2>
          <p>{bootError || '正在打开你的生活空间……'}</p>
          {bootError && (
            <>
              <code>{path}</code>
              <button className="button primary" onClick={restoreBoot}>
                从备份恢复
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="app-body">
          <nav className="module-rail" aria-label="功能模块">
            <div className="brand-logo" title="DOIT 拾序">
              d<span>.</span>
            </div>
            <div className="module-buttons">
              {modules.map((m) => (
                <button
                  key={m.id}
                  className={`module-button ${module === m.id ? 'active' : ''}`}
                  aria-label={m.name}
                  title={m.name}
                  onClick={() => {
                    setModule(m.id)
                    setFiltersOpen(false)
                  }}
                >
                  <Icon name={m.icon} size={22} />
                  <span>{m.name}</span>
                  {!m.enabled && <i />}
                </button>
              ))}
            </div>
            <div className="rail-bottom">
              <button className="module-button" aria-label="设置" onClick={() => setSettings(true)}>
                <Icon name="Settings2" size={20} />
              </button>
              <div className="user-avatar" title="本地个人空间">
                我
              </div>
            </div>
          </nav>
          {module === 'tasks' ? (
            <>
              <Sidebar
                data={data}
                onChange={change}
                width={panes.left}
                filter={filter}
                onFilter={chooseFilter}
                onEntity={setEntity}
                onCollapse={(id) =>
                  change((d) => ({
                    ...d,
                    folders: d.folders.map((f) =>
                      f.id === id ? { ...f, collapsed: !f.collapsed } : f,
                    ),
                  }))
                }
                onSettings={() => setSettings(true)}
                onManageTags={() => {
                  setSettingsSection('tasks')
                  setSettings(true)
                }}
              />
              <TaskPaneGrip
                side="left"
                width={panes.left}
                max={panes.leftMax}
                onResize={(width) => panes.resize('left', width)}
              />
              <main className="main-panel">
                <div className="main-topline">
                  <div className="breadcrumb">
                    <Icon name="CheckCheck" size={14} />
                    待办<span>/</span>
                    <h1 className="breadcrumb-heading">{title}</h1>
                  </div>
                  <div className="main-topline-right">
                    <span
                      className={`save-status ${status}`}
                      title={saveError || '更改会自动保存到本机'}
                    >
                      <i />
                      {status === 'saved'
                        ? '已保存到本机'
                        : status === 'saving'
                          ? '正在保存…'
                          : '保存失败，请备份'}
                    </span>
                    <div className="global-search">
                      <Icon name="Search" size={14} />
                      <input
                        ref={searchRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="搜索事项"
                        aria-label="搜索事项"
                      />
                      {search ? (
                        <button
                          className="icon-button"
                          aria-label="清空搜索"
                          onClick={() => setSearch('')}
                        >
                          <Icon name="X" size={12} />
                        </button>
                      ) : (
                        <kbd>Ctrl K</kbd>
                      )}
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={detailOpen ? '收起事项详情栏' : '展开事项详情栏'}
                      aria-expanded={detailOpen}
                      title={detailOpen ? '收起事项详情栏' : '展开事项详情栏'}
                      onClick={() => setDetailOpen(!detailOpen)}
                    >
                      <Icon name={detailOpen ? 'PanelRightClose' : 'PanelRightOpen'} size={16} />
                    </button>
                  </div>
                </div>
                {showDaySummary && (
                  <div className="module-summary-row task-summary-row">
                    <CompletionSummary
                      label={anchor === today ? '今日完成' : `${shortDate(anchor)}完成`}
                      completed={dayCompleted}
                      total={dayPlan.length}
                    />
                    <div className="module-summary-actions">{newTaskButton}</div>
                  </div>
                )}
                <div className="view-toolbar">
                  {view === 'list' ? (
                    <div className="view-tabs">
                      <span className="list-view-label">
                        <Icon name="List" size={15} />{' '}
                        {searching ? `${rows.length} 项匹配` : '列表'}
                      </span>
                    </div>
                  ) : (
                    <div className="view-tabs" role="tablist" aria-label="事项视图">
                      {(
                        [
                          { id: 'day', name: '日视图', icon: 'CalendarDays' },
                          { id: 'week', name: '周视图', icon: 'CalendarRange' },
                          { id: 'month', name: '月视图', icon: 'CalendarDays' },
                        ] as const
                      ).map((v) => (
                        <button
                          key={v.id}
                          role="tab"
                          aria-selected={view === v.id}
                          className={view === v.id ? 'active' : ''}
                          onClick={() => setCalendarView(v.id)}
                        >
                          <Icon name={v.icon} size={15} />
                          {v.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="view-tools">
                    {(view !== 'list' ||
                      (filter.kind === 'smart' && ['today', 'upcoming'].includes(filter.id))) && (
                      <div className="date-navigation">
                        <button
                          className="icon-button"
                          aria-label="上一期"
                          onClick={() => move(-1)}
                        >
                          <Icon name="ChevronLeft" size={14} />
                        </button>
                        <span>{period}</span>
                        <button className="icon-button" aria-label="下一期" onClick={() => move(1)}>
                          <Icon name="ChevronRight" size={14} />
                        </button>
                        {anchor !== today && (
                          <button className="today-button" onClick={() => setAnchor(today)}>
                            今天
                          </button>
                        )}
                      </div>
                    )}
                    <div className="filter-anchor">
                      <button
                        className={`icon-button ${filtersOpen ? 'is-active' : ''}`}
                        title="显示与排序"
                        aria-label="显示与排序"
                        onClick={() => setFiltersOpen(!filtersOpen)}
                      >
                        <Icon name="SlidersHorizontal" size={17} />
                      </button>
                      {filtersOpen && (
                        <>
                          <div className="popover-dismiss" onClick={() => setFiltersOpen(false)} />
                          <div className="filter-popover">
                            <div className="popover-title">显示与排序</div>
                            <label>
                              <input
                                type="checkbox"
                                checked={data.preferences.showCompleted}
                                onChange={(e) =>
                                  change((d) => ({
                                    ...d,
                                    preferences: {
                                      ...d.preferences,
                                      showCompleted: e.target.checked,
                                    },
                                  }))
                                }
                              />
                              显示已完成事项
                            </label>
                            {view === 'list' && (
                              <>
                                <div className="popover-subtitle">排序方式</div>
                                {(
                                  [
                                    { id: 'time', name: '事项时间' },
                                    { id: 'title', name: '标题拼音' },
                                    { id: 'priority', name: '优先级' },
                                    { id: 'created', name: '创建时间（最新优先）' },
                                    { id: 'custom', name: '自定义' },
                                  ] as const
                                )
                                  .filter((option) => !searching || option.id !== 'custom')
                                  .map((option) => (
                                    <button
                                      key={option.id}
                                      aria-pressed={sort === option.id}
                                      onClick={() => selectSort(option.id)}
                                    >
                                      {option.name}
                                      {sort === option.id && <Icon name="Check" size={14} />}
                                    </button>
                                  ))}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {!showDaySummary && newTaskButton}
                  </div>
                </div>
                <div className="main-scroll">
                  {view === 'list' ? (
                    <TaskListView
                      key={moduleReset}
                      rows={rows}
                      data={data}
                      selectedId={selected?.id || null}
                      onSelect={selectTask}
                      onToggle={(t, day) => toggleTask(t.id, day)}
                      onReorder={!searching && sort === 'custom' ? reorderTasks : undefined}
                      onRename={renameTask}
                      onCreate={() => create(anchor)}
                      onQuickCreate={quickCreate}
                      showCompleted={
                        data.preferences.showCompleted ||
                        (filter.kind === 'smart' && filter.id === 'completed')
                      }
                      searching={!!search}
                      groupByList={
                        sort !== 'custom' &&
                        (searching ||
                          (filter.kind !== 'list' &&
                            !(filter.kind === 'smart' && filter.id === 'inbox')))
                      }
                    />
                  ) : (
                    <CalendarView
                      view={view}
                      anchor={anchor}
                      tasks={filteredTasks}
                      data={data}
                      selectedId={selected?.id || null}
                      onSelect={selectTask}
                      onCreate={create}
                      onRename={renameTask}
                    />
                  )}
                </div>
                <footer className="main-footer">
                  <span>
                    <Icon name="Leaf" size={13} />
                    生活有序，心里有余。
                  </span>
                  <span>
                    {view === 'list'
                      ? `${rows.filter((r) => !isCompleted(r.task, r.day)).length} 项待完成`
                      : view === 'day'
                        ? '按当天安排排列'
                        : '按周一至周日排列'}
                    <i />
                    Ctrl + N 新建
                  </span>
                </footer>
              </main>
              {detailOpen && (
                <>
                  <TaskPaneGrip
                    side="right"
                    width={panes.right}
                    max={panes.rightMax}
                    onResize={(width) => panes.resize('right', width)}
                  />
                  {selectedTask && selected ? (
                    <TaskDetail
                      key={selectedTask.id}
                      task={selectedTask}
                      width={panes.right}
                      day={selected.day}
                      data={data}
                      onClose={() => setDetailOpen(false)}
                      onEdit={() => setEditor(selectedTask)}
                      onDelete={() => deleteTask(selectedTask)}
                      onChange={patchTask}
                      onDateChange={(dates) => saveTaskDates(selectedTask, dates)}
                      onRename={(title) => renameTask(selectedTask.id, title)}
                      onToggle={() => toggleTask(selectedTask.id, selected.day)}
                      onCheck={(id) => checkTask(selectedTask.id, id, selected.day)}
                      onNotesChange={(notes, convertTags) =>
                        changeNotes(selectedTask.id, notes, convertTags)
                      }
                      onChecklistEdit={(edit) =>
                        changeChecklist(selectedTask.id, edit, selected.day)
                      }
                    />
                  ) : (
                    <aside
                      className="detail-panel detail-empty"
                      aria-label="事项详情"
                      style={{ width: panes.right }}
                    />
                  )}
                </>
              )}
            </>
          ) : module === 'habits' ? (
            <HabitBoard
              key={moduleReset}
              data={data}
              today={today}
              status={status}
              saveError={saveError}
              onChange={change}
              onSettings={() => setSettings(true)}
              notify={notify}
            />
          ) : module === 'finance' ? (
            <FinanceBoard
              key={moduleReset}
              data={data}
              today={today}
              status={status}
              saveError={saveError}
              onChange={change}
              onSettings={() => setSettings(true)}
              notify={notify}
            />
          ) : (
            <AssetBoard
              key={moduleReset}
              data={data}
              today={today}
              status={status}
              saveError={saveError}
              onChange={change}
              onSettings={() => setSettings(true)}
              notify={notify}
            />
          )}
        </div>
      )}
      {data && editor && (
        <TaskEditor initial={editor} data={data} onSave={saveTask} onClose={closeEditor} />
      )}
      {data && entity && (
        <EntityEditor
          {...entity}
          data={data}
          onSave={saveEntity}
          onDelete={requestDeleteEntity}
          onClose={closeEntity}
        />
      )}
      {settings && data && !pendingImport && !clearRequest && (
        <SettingsDialog
          data={data}
          path={path}
          status={status}
          saveError={saveError}
          onAppearanceChange={(appearance) =>
            change((d) => ({ ...d, preferences: { ...d.preferences, appearance } }))
          }
          onExport={doExport}
          onImport={doImport}
          clearBackup={clearBackup}
          onRequestClear={(selectedModules) => {
            setSettingsSection('data')
            setClearRequest(selectedModules)
          }}
          onClose={closeSettings}
          initialSection={settingsSection}
          onChange={change}
          onViewTag={(id) => {
            chooseFilter({ kind: 'tag', id })
            setSettings(false)
          }}
        />
      )}
      {clearRequest && (
        <ClearModulesDialog
          names={modules
            .filter(({ id }) => clearRequest.includes(id))
            .map(({ name }) => name)
            .join('、')}
          onClear={confirmClearModules}
          onClose={() => setClearRequest(null)}
        />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="confirm-message">{confirm.message}</p>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              取消
            </button>
            <button
              className={`button ${confirm.danger ? 'danger-button' : 'primary'}`}
              onClick={() => {
                confirm.action()
                setConfirm(null)
              }}
            >
              确认删除
            </button>
          </div>
        </Modal>
      )}
      {pendingImport && (
        <Modal
          title="导入这份备份？"
          subtitle="确认后将替换当前空间的数据。建议先导出当前备份。"
          onClose={() => setPendingImport(null)}
        >
          <div className="import-summary">
            <span>
              <strong>{pendingImport.tasks.length}</strong> 个事项
            </span>
            <span>
              <strong>{pendingImport.lists.length}</strong> 个清单
            </span>
            <span>
              <strong>{pendingImport.tags.length}</strong> 个标签
            </span>
            <span>
              <strong>{pendingImport.habits?.length || 0}</strong> 个习惯
            </span>
            <span>
              <strong>{pendingImport.finance?.entries.length || 0}</strong> 笔账目
            </span>
            <span>
              <strong>{pendingImport.assets?.products.length || 0}</strong> 项投资
            </span>
            <span>
              <strong>{pendingImport.assets?.records.length || 0}</strong> 笔投资记录
            </span>
          </div>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setPendingImport(null)}>
              取消
            </button>
            {data && (
              <button className="button secondary" onClick={doExport}>
                先导出当前数据
              </button>
            )}
            <button
              className="button primary"
              onClick={() => {
                setData(pendingImport)
                setBootError('')
                setPendingImport(null)
                setSelected(null)
                setSettings(false)
                setFilter({ kind: 'smart', id: 'today' })
                notify('备份已导入')
              }}
            >
              确认导入
            </button>
          </div>
        </Modal>
      )}
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={importRef}
        onChange={async (e) => {
          try {
            const file = e.target.files?.[0]
            if (file) {
              if (file.size > 20 * 1024 * 1024) {
                notify('备份不能超过 20 MB')
                return
              }
              parseImport(JSON.parse(await file.text()))
            }
          } catch {
            notify('无法读取备份，请选择有效的 JSON 文件。')
          } finally {
            e.target.value = ''
          }
        }}
      />
      {toast && !clearRequest && (
        <div className="toast" role="status">
          <span className="toast-icon">
            <Icon name="Check" size={14} />
          </span>
          {toast.message}
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              撤销
            </button>
          )}
          <button className="toast-close" aria-label="关闭提示" onClick={() => setToast(null)}>
            <Icon name="X" size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
