export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function parseDate(key: string) {
  return new Date(`${key}T12:00:00`)
}
export function addDays(key: string, n: number) {
  const d = parseDate(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.UTC(...parts(b)) - Date.UTC(...parts(a))) / 86400000)
}
function parts(k: string): [number, number, number] {
  const [y, m, d] = k.split('-').map(Number)
  return [y, m - 1, d]
}
export function startOfWeek(key: string) {
  const day = parseDate(key).getDay()
  return addDays(key, -((day + 6) % 7))
}
export function monthGrid(key: string) {
  const d = parseDate(key)
  d.setDate(1)
  const start = startOfWeek(dateKey(d))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
export function moveMonth(key: string, step: number) {
  const d = parseDate(key)
  d.setDate(1)
  d.setMonth(d.getMonth() + step)
  return dateKey(d)
}
export function shortDate(key: string) {
  return key
    ? parseDate(key).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    : '未安排日期'
}
export function friendlyDate(key: string, today = dateKey()) {
  return key === today
    ? '今天'
    : key === addDays(today, 1)
      ? '明天'
      : key === addDays(today, -1)
        ? '昨天'
        : shortDate(key)
}
export const weekdays = ['日', '一', '二', '三', '四', '五', '六']
