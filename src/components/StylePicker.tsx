import { useId, useRef, useState } from 'react'
import Icon, { colors } from './Icon'

const iconGroups: { name: string; icons: [string, string][] }[] = [
  {
    name: '工作与学习',
    icons: [
      ['Folder', '文件夹'],
      ['List', '清单'],
      ['Layers', '分类'],
      ['BriefcaseBusiness', '公文包'],
      ['ClipboardList', '任务板'],
      ['BookOpen', '阅读'],
      ['LibraryBig', '书架'],
      ['GraduationCap', '学习'],
      ['NotebookPen', '笔记'],
      ['Pencil', '写作'],
      ['Laptop', '电脑'],
      ['Code2', '编程'],
      ['Languages', '外语'],
      ['Calculator', '计算器'],
      ['CalendarDays', '日程'],
    ],
  },
  {
    name: '生活与兴趣',
    icons: [
      ['Home', '家'],
      ['Coffee', '咖啡'],
      ['Heart', '爱心'],
      ['ShoppingCart', '购物'],
      ['CookingPot', '烹饪'],
      ['Utensils', '餐具'],
      ['WalletCards', '钱包'],
      ['Music', '音乐'],
      ['Headphones', '耳机'],
      ['Camera', '相机'],
      ['Clapperboard', '影视'],
      ['Gamepad2', '游戏'],
      ['Brush', '画笔'],
      ['Wrench', '工具'],
      ['Sparkles', '星光'],
    ],
  },
  {
    name: '健康与运动',
    icons: [
      ['Target', '目标'],
      ['Dumbbell', '力量训练'],
      ['Footprints', '步行'],
      ['Bike', '骑行'],
      ['StretchHorizontal', '拉伸'],
      ['HeartPulse', '心率'],
      ['Flame', '火焰'],
      ['Droplet', '水滴'],
      ['GlassWater', '喝水'],
      ['Apple', '水果'],
      ['Salad', '轻食'],
      ['Moon', '月亮'],
      ['BedDouble', '睡眠'],
      ['Sun', '太阳'],
      ['CalendarCheck2', '打卡'],
    ],
  },
  {
    name: '自然与出行',
    icons: [
      ['Sprout', '嫩芽'],
      ['Leaf', '叶子'],
      ['Trees', '树林'],
      ['Mountain', '山峰'],
      ['Plane', '飞机'],
      ['Bus', '公交'],
      ['MapPin', '地点'],
      ['Archive', '归档'],
      ['Inbox', '收集箱'],
      ['CircleDot', '圆点'],
    ],
  },
]
const iconNames = new Map(iconGroups.flatMap((group) => group.icons))
const iconShortcuts = {
  list: [
    'List',
    'BookOpen',
    'BriefcaseBusiness',
    'ShoppingCart',
    'Heart',
    'Coffee',
    'CalendarDays',
  ],
  folder: ['Folder', 'Layers', 'Archive', 'Home', 'BriefcaseBusiness', 'LibraryBig', 'Sprout'],
  habit: ['Target', 'Dumbbell', 'Droplet', 'Moon', 'BookOpen', 'Footprints', 'Sprout'],
}

const palettes = [
  {
    name: '马卡龙',
    swatches: [
      '#dc8ba2',
      '#e8a175',
      '#d5b568',
      '#80b99c',
      '#76b2c4',
      '#879fd8',
      '#ac92cb',
      '#bd92b3',
    ],
  },
  {
    name: '孟菲斯',
    swatches: [
      '#eb565d',
      '#ee833c',
      '#e5b123',
      '#19a793',
      '#388bd8',
      '#5256c7',
      '#9253bd',
      '#db528b',
    ],
  },
  {
    name: '莫兰迪',
    swatches: [
      '#b18283',
      '#b28d7c',
      '#ab996b',
      '#899c85',
      '#718f8f',
      '#768ba3',
      '#8a819c',
      '#8a8681',
    ],
  },
  {
    name: '自然大地',
    swatches: [
      '#a76550',
      '#a9743f',
      '#a48a52',
      '#707c4f',
      '#527b66',
      '#527e8d',
      '#635e7d',
      '#756659',
    ],
  },
]

export function IconPicker({
  kind,
  value,
  color,
  onChange,
}: {
  kind: keyof typeof iconShortcuts
  value: string
  color: string
  onChange: (icon: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const more = useRef<HTMLButtonElement>(null)
  const suggested = iconShortcuts[kind]
  const visible = suggested.includes(value) ? suggested : [...suggested.slice(0, -1), value]
  const option = (icon: string) => {
    const label = iconNames.get(icon) || icon
    return (
      <button
        type="button"
        key={icon}
        className="style-icon"
        title={label}
        aria-label={`图标 ${label}`}
        aria-pressed={icon === value}
        style={icon === value ? { color } : undefined}
        onClick={() => {
          if (expanded && !visible.includes(icon)) more.current?.focus()
          onChange(icon)
          setExpanded(false)
        }}
      >
        <Icon name={icon} size={19} />
      </button>
    )
  }
  return (
    <div className="style-picker">
      <div className="field-label">图标</div>
      <div className="style-grid icon-choices" role="group" aria-label="常用图标">
        {visible.map(option)}
        <button
          type="button"
          ref={more}
          className="style-more"
          aria-controls={id}
          aria-expanded={expanded}
          aria-label={expanded ? '收起图标' : '更多图标'}
          title={expanded ? '收起图标' : '更多图标'}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name={expanded ? 'ChevronDown' : 'MoreHorizontal'} size={17} />
        </button>
      </div>
      <div id={id} hidden={!expanded} className="style-gallery">
        {expanded &&
          iconGroups.map(({ name, icons }) => (
            <div className="style-group" key={name}>
              <div className="style-group-label">{name}</div>
              <div className="style-grid icon-choices" role="group" aria-label={name}>
                {icons.filter(([icon]) => !visible.includes(icon)).map(([icon]) => option(icon))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function ColorPicker({
  value,
  onChange,
  classic = colors,
  label = '颜色',
}: {
  value: string
  onChange: (color: string) => void
  classic?: string[]
  label?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const more = useRef<HTMLButtonElement>(null)
  const families = [{ name: '经典', swatches: classic }, ...palettes]
  const selected = value.toLowerCase()
  const active = families.find(({ swatches }) => swatches.includes(selected)) || {
    name: '当前颜色',
    swatches: [value],
  }
  const option = (color: string, family: string) => {
    const checked = color.toLowerCase() === selected
    return (
      <button
        type="button"
        key={color}
        className="style-swatch"
        style={{ background: color }}
        title={`${family} · ${color.toUpperCase()}`}
        aria-label={`${label} ${color}`}
        aria-pressed={checked}
        onClick={() => {
          if (family !== active.name) more.current?.focus()
          onChange(color)
          setExpanded(false)
        }}
      >
        {checked && <Icon name="Check" size={14} />}
      </button>
    )
  }
  return (
    <div className="style-picker">
      <div className="field-label">
        {label}
        <span className="field-hint">{active.name}</span>
      </div>
      <div className="style-grid color-choices" role="group" aria-label={`${active.name}色系`}>
        {active.swatches.map((color) => option(color, active.name))}
        <button
          type="button"
          ref={more}
          className="style-more"
          aria-controls={id}
          aria-expanded={expanded}
          aria-label={expanded ? '收起色系' : '更多色系'}
          title={expanded ? '收起色系' : '更多色系'}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name={expanded ? 'ChevronDown' : 'MoreHorizontal'} size={17} />
        </button>
      </div>
      <div id={id} hidden={!expanded} className="style-gallery">
        {expanded &&
          families
            .filter(({ name }) => name !== active.name)
            .map(({ name, swatches }) => (
              <div className="style-group" key={name}>
                <div className="style-group-label">{name}</div>
                <div className="style-grid color-choices" role="group" aria-label={`${name}色系`}>
                  {swatches.map((color) => option(color, name))}
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
