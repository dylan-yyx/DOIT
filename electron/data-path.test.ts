import { createRequire } from 'node:module'
import path from 'node:path'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveDataDir } = require('./data-path.cjs')
const options = {
  packaged: true,
  installed: true,
  exeDir: path.resolve('installed-app'),
  appData: path.resolve('user-appdata'),
  projectDir: path.resolve('project'),
}
it('安装版数据独立于安装目录，升级和卸载不删除用户数据', () => {
  const expected = path.join(options.appData, 'DOIT', 'data')
  expect(resolveDataDir(options)).toBe(expected)
  expect(resolveDataDir({ ...options, exeDir: path.resolve('another-install') })).toBe(expected)
})
it('便携版保留软件旁的数据位置', () => {
  expect(resolveDataDir({ ...options, installed: false })).toBe(path.join(options.exeDir, 'data'))
})
it('开发版和显式隔离数据目录互不干扰', () => {
  expect(resolveDataDir({ ...options, packaged: false })).toBe(
    path.join(options.projectDir, '.local-data'),
  )
  expect(resolveDataDir({ ...options, override: 'test-only' })).toBe('test-only')
})
