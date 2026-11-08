import { useEffect, useRef, useState } from 'react'
import type { Appearance } from '../core/types'
import {
  defaultAppearance,
  fonts,
  landscapeUrl,
  prepareBackground,
  themes,
} from '../core/appearance'
import Icon from './Icon'

export default function AppearanceSettings({
  value = defaultAppearance,
  onChange,
}: {
  value?: Appearance
  onChange: (value: Appearance) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const latestValue = useRef(value)
  latestValue.current = value
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const customImage = await prepareBackground(file)
      if (active.current) onChange({ ...latestValue.current, theme: 'custom', customImage })
    } catch (e) {
      if (active.current) setError((e as Error).message)
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return (
    <section className="appearance-settings" aria-label="外观设置">
      <div className="appearance-heading">
        <p>
          <Icon name="CheckCircle2" size={14} />
          切换后即时生效，自动保存。
        </p>
        <button
          className="text-button appearance-reset"
          disabled={busy}
          onClick={() => {
            onChange({ ...value, ...defaultAppearance })
            setError('')
          }}
        >
          <Icon name="RefreshCw" size={12} />
          恢复默认
        </button>
      </div>
      <fieldset className="appearance-fieldset">
        <legend>纯色背景</legend>
        <div className="theme-grid">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`theme-option ${value.theme === theme.id ? 'selected' : ''}`}
              aria-pressed={value.theme === theme.id}
              aria-label={`${theme.name}主题`}
              title={theme.description}
              disabled={busy}
              onClick={() => onChange({ ...value, theme: theme.id })}
            >
              <span className="theme-swatch" style={{ background: theme.color }}>
                <span className="theme-mini-rail" />
                <span className="theme-mini-panel">
                  <i />
                  <i />
                  <i />
                </span>
                {value.theme === theme.id && (
                  <span className="theme-check">
                    <Icon name="Check" size={12} />
                  </span>
                )}
              </span>
              <span>{theme.name}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="appearance-fieldset image-fieldset">
        <legend>图片背景</legend>
        <div className="image-theme-grid">
          <button
            className={`image-theme-option ${value.theme === 'landscape' ? 'selected' : ''}`}
            aria-pressed={value.theme === 'landscape'}
            aria-label="远山主题"
            disabled={busy}
            onClick={() => onChange({ ...value, theme: 'landscape' })}
          >
            <img src={landscapeUrl} alt="柔和天空下的层叠远山" />
            <span>
              远山 <small>内置背景</small>
            </span>
            {value.theme === 'landscape' && (
              <i className="theme-check">
                <Icon name="Check" size={12} />
              </i>
            )}
          </button>
          <button
            className={`image-theme-option custom-image-option ${value.theme === 'custom' ? 'selected' : ''}`}
            aria-pressed={value.theme === 'custom'}
            aria-label="自定义图片主题"
            disabled={busy}
            onClick={() =>
              value.customImage ? onChange({ ...value, theme: 'custom' }) : input.current?.click()
            }
          >
            {value.customImage ? (
              <img src={value.customImage.dataUrl} alt="自定义背景预览" />
            ) : (
              <div className="image-upload-placeholder">
                <Icon name="Upload" size={22} />
                <span>把喜欢的风景带进来</span>
              </div>
            )}
            <span>
              自定义图片 <small>{value.customImage ? '已保存在本机' : '从本机选择'}</small>
            </span>
            {value.theme === 'custom' && (
              <i className="theme-check">
                <Icon name="Check" size={12} />
              </i>
            )}
          </button>
        </div>
        <div className="image-upload-actions">
          <p>JPG / PNG / WebP，最大 20 MB；自动适配窗口。</p>
          <div>
            {value.customImage && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  const { customImage: _image, ...rest } = value
                  onChange({ ...rest, theme: value.theme === 'custom' ? 'sage' : value.theme })
                  setError('')
                }}
              >
                移除图片
              </button>
            )}
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Icon name="Upload" size={12} />
              {busy ? '正在处理…' : value.customImage ? '更换图片' : '上传图片'}
            </button>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          aria-label="上传自定义背景图片"
          onChange={(e) => {
            void upload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {error && (
          <p role="alert" className="error-text appearance-error">
            {error}
          </p>
        )}
      </fieldset>
      <fieldset className="appearance-fieldset font-fieldset">
        <legend>界面字体</legend>
        <div className="font-options">
          {fonts.map((font) => (
            <button
              key={font.id}
              className={`font-option ${value.font === font.id ? 'selected' : ''}`}
              aria-pressed={value.font === font.id}
              aria-label={`${font.name}字体`}
              style={{ fontFamily: font.family }}
              onClick={() => onChange({ ...value, font: font.id })}
            >
              <span>
                <strong>{font.name}</strong>
                <small>日常，自有章法 0123</small>
              </span>
              {value.font === font.id && <Icon name="Check" size={14} />}
            </button>
          ))}
        </div>
        <p className="appearance-hint">使用电脑本地字体；未安装时自动使用备用字体。</p>
      </fieldset>
    </section>
  )
}
