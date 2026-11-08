import { describe, expect, it } from 'vitest'
import {
  defaultAppearance,
  fonts,
  maxImageDataLength,
  themes,
  validateAppearance,
} from './appearance'
import { createSeed } from './seed'
import { validateData } from '../modules/tasks/logic'

describe('外观偏好与备份边界', () => {
  it('兼容没有外观字段的旧版数据', () => {
    const data = createSeed()
    delete data.preferences.appearance
    expect(validateData(data)).toBe(true)
  })
  it('允许所有内置主题与字体组合', () => {
    for (const theme of [...themes.map((t) => t.id), 'landscape']) {
      for (const font of fonts) expect(validateAppearance({ theme, font: font.id })).toBe(true)
    }
  })
  it('自定义主题必须有本地图片，纯色主题可以保留已上传图片', () => {
    const image = { name: '测试.png', dataUrl: 'data:image/png;base64,aGVsbG8=' }
    expect(validateAppearance({ ...defaultAppearance, theme: 'custom', customImage: image })).toBe(
      true,
    )
    expect(validateAppearance({ ...defaultAppearance, customImage: image })).toBe(true)
    expect(validateAppearance({ ...defaultAppearance, theme: 'custom' })).toBe(false)
  })
  it('拒绝外部图片 URL、非图片内容、过大图片与无效偏好', () => {
    for (const dataUrl of [
      'https://example.com/photo.jpg',
      'file:///C:/photo.jpg',
      'data:image/svg+xml;base64,aGVsbG8=',
      `data:image/png;base64,${'a'.repeat(maxImageDataLength)}`,
    ]) {
      expect(
        validateAppearance({ ...defaultAppearance, customImage: { name: 'x', dataUrl } }),
      ).toBe(false)
    }
    for (const value of [
      null,
      [],
      'sage',
      {},
      { theme: 'invalid', font: 'system' },
      { theme: 'sage', font: 'invalid' },
    ])
      expect(validateAppearance(value)).toBe(false)
  })
  it('完整备份验证覆盖外观配置', () => {
    const data = createSeed()
    data.preferences.appearance = { theme: 'blue', font: 'song' }
    expect(validateData(JSON.parse(JSON.stringify(data)))).toBe(true)
    const invalid = JSON.parse(JSON.stringify(data))
    invalid.preferences.appearance.font = 'unknown'
    expect(validateData(invalid)).toBe(false)
  })
})
