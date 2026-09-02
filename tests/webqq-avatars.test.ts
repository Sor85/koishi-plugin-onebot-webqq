import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  getWebQQGroupAvatar,
  getWebQQUserAvatar,
  readWebQQProvidedAvatar,
  resolveWebQQGroupAvatar,
  resolveWebQQUserAvatar,
} from '../src/webqq/display'

const realBot = { synthesizeQQAvatars: true }
const virtualBot = { synthesizeQQAvatars: false }
const clientDir = new URL('../client/', import.meta.url)

async function listVueFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: URL[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...await listVueFiles(new URL(`${entry.name}/`, dir)))
      continue
    }
    if (entry.name.endsWith('.vue')) files.push(new URL(entry.name, dir))
  }
  return files
}

describe('webqq 头像取值', () => {
  it('真实机器人的 id 仍按 QQ 号合成腾讯 CDN 地址', () => {
    expect(resolveWebQQUserAvatar('', '30001', realBot)).toBe(getWebQQUserAvatar('30001'))
    expect(resolveWebQQGroupAvatar('', '30001', realBot)).toBe(getWebQQGroupAvatar('30001'))
  })

  it('虚拟机器人的 id 不合成任何腾讯 CDN 地址', () => {
    expect(resolveWebQQUserAvatar('', '30001', virtualBot)).toBe('')
    expect(resolveWebQQGroupAvatar('', '30001', virtualBot)).toBe('')
    expect(resolveWebQQUserAvatar(undefined, '30001', virtualBot)).toBe('')
  })

  it('对方给出的头像优先于合成地址', () => {
    const provided = 'https://example.com/avatar.png'
    expect(resolveWebQQUserAvatar(provided, '30001', realBot)).toBe(provided)
    expect(resolveWebQQUserAvatar(provided, '30001', virtualBot)).toBe(provided)
    expect(resolveWebQQGroupAvatar('/onebot-sandbox/avatar.svg', '30001', virtualBot)).toBe('/onebot-sandbox/avatar.svg')
    expect(resolveWebQQUserAvatar('data:image/svg+xml;base64,PHN2Zy8+', '30001', virtualBot)).toBe('data:image/svg+xml;base64,PHN2Zy8+')
  })

  // 提供方插件可能给的是它自己的受管媒体引用，塞进 <img> 只会渲染成碎图。
  it('进不了 <img> 的取值当作没有头像', () => {
    expect(readWebQQProvidedAvatar('sandbox-media://0123456789abcdef0123456789abcdef')).toBe('')
    expect(readWebQQProvidedAvatar('file:///tmp/avatar.png')).toBe('')
    expect(readWebQQProvidedAvatar('avatar.png')).toBe('')
    expect(readWebQQProvidedAvatar('   ')).toBe('')
    expect(readWebQQProvidedAvatar(42)).toBe('')
    expect(resolveWebQQUserAvatar('sandbox-media://0123456789abcdef0123456789abcdef', '30001', virtualBot)).toBe('')
    // 真实机器人下这种取值同样不算头像，但仍可按 QQ 号合成。
    expect(resolveWebQQUserAvatar('sandbox-media://0123456789abcdef0123456789abcdef', '30001', realBot))
      .toBe(getWebQQUserAvatar('30001'))
  })

  // 没有头像时必须显示首字母占位；无条件的 <img> 会在场景没给头像时渲染成一个碎图。
  it('界面上每个头像 img 都有缺省分支', async () => {
    const unguarded: string[] = []
    for (const file of await listVueFiles(clientDir)) {
      const source = await readFile(file, 'utf8')
      for (const line of source.split('\n')) {
        if (!line.includes('<img')) continue
        if (!/avatar/i.test(line)) continue
        if (line.includes('v-if')) continue
        unguarded.push(`${file.pathname.split('/client/')[1]}: ${line.trim()}`)
      }
    }
    expect(unguarded).toEqual([])
  })
})
