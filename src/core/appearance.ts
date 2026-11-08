import type { Appearance, FontId, ThemeId } from './types'

export const themes: { id: ThemeId; name: string; color: string; description: string }[] = [
  { id: 'sage', name: '鼠尾草', color: '#e5eddf', description: '柔和的草木绿' },
  { id: 'cloud', name: '云朵白', color: '#eef0f2', description: '干净的中性白' },
  { id: 'sand', name: '燕麦米', color: '#eee4d5', description: '温暖的浅米色' },
  { id: 'blue', name: '雾霭蓝', color: '#dfeaf3', description: '清透的浅雾蓝' },
  { id: 'rose', name: '蔷薇粉', color: '#f1e0e3', description: '安静的浅玫瑰色' },
  { id: 'lavender', name: '浅藤紫', color: '#e8e1f2', description: '轻盈的淡紫色' },
]
export const fonts: { id: FontId; name: string; family: string; description: string }[] = [
  {
    id: 'system',
    name: '系统默认',
    family: "'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif",
    description: '清晰自然，适合日常使用',
  },
  {
    id: 'yahei',
    name: '微软雅黑',
    family: "'Microsoft YaHei', 'Microsoft YaHei UI', sans-serif",
    description: '简洁舒展的无衬线字体',
  },
  {
    id: 'song',
    name: '宋体',
    family: "'SimSun', 'Songti SC', serif",
    description: '经典书卷感，笔画细腻',
  },
  { id: 'kai', name: '楷体', family: "'KaiTi', 'STKaiti', serif", description: '温润的手写笔意' },
  {
    id: 'lxgw975',
    name: '霞鹜975圆体',
    family:
      "'LXGW 975 Yuan SC 500W', '霞鹜975圆体SC 500W', 'LXGW 975 Yuan SC', '霞鹜975圆体SC', 'Microsoft YaHei', sans-serif",
    description: '圆润柔和，让日常多一点温度',
  },
]
export const defaultAppearance: Appearance = { theme: 'sage', font: 'system' }
export const landscapeUrl = './backgrounds/misty-hills.svg'
const themeIds = [...themes.map((t) => t.id), 'landscape', 'custom']
export const maxImageDataLength = 2 * 1024 * 1024

export function validateAppearance(value: unknown): value is Appearance | undefined {
  if (value === undefined) return true // Older backups use the original appearance.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const a = value as Appearance
  if (!themeIds.includes(a.theme) || !fonts.some((f) => f.id === a.font)) return false
  if (a.customImage !== undefined) {
    const image = a.customImage
    if (
      !image ||
      typeof image.name !== 'string' ||
      image.name.length > 200 ||
      typeof image.dataUrl !== 'string' ||
      image.dataUrl.length > maxImageDataLength ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl)
    )
      return false
  }
  return a.theme !== 'custom' || !!a.customImage
}

export function applyAppearance(appearance = defaultAppearance) {
  const root = document.documentElement
  const image =
    appearance.theme === 'custom'
      ? appearance.customImage?.dataUrl
      : appearance.theme === 'landscape'
        ? new URL(landscapeUrl, document.baseURI).href
        : undefined
  root.dataset.theme = image ? 'sage' : appearance.theme
  root.dataset.background = image ? 'image' : 'solid'
  root.style.setProperty('--app-bg-image', image ? `url("${image}")` : 'none')
  root.style.setProperty('--app-font', fonts.find((f) => f.id === appearance.font)!.family)
}

export async function prepareBackground(
  file: File,
): Promise<NonNullable<Appearance['customImage']>> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('请选择 JPG、PNG 或 WebP 格式的图片。')
  if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MB，请选择较小的图片。')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'))
    reader.readAsDataURL(file)
  })
  const image = new Image()
  image.src = dataUrl
  try {
    await image.decode()
  } catch {
    throw new Error('无法识别这张图片，请选择有效的 JPG、PNG 或 WebP 图片。')
  }
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    image.naturalWidth * image.naturalHeight > 60_000_000
  )
    throw new Error('图片分辨率过大，请先缩小图片后重试。')
  const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('图片处理失败，请重试。')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  let result = canvas.toDataURL('image/jpeg', 0.86)
  if (result.length > maxImageDataLength) result = canvas.toDataURL('image/jpeg', 0.65)
  if (result.length > maxImageDataLength) throw new Error('图片内容过于复杂，请缩小图片后重试。')
  return { name: file.name.slice(0, 200), dataUrl: result }
}
