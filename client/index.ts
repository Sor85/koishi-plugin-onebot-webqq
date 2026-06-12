import { Context, receive, withProxy } from '@koishijs/client'
import type { Ref } from 'vue'
import Capsule from './Capsule.vue'
import { capsule, debug, hideWebQQGroupLevel, resetWebQQClientState, showWebQQAffinity, showWebQQCapsuleUnread, showWebQQRelationship, useBotAvatarThemeColor, webQQAccentColor, webQQAvatarAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTheme, webQQTimBubbleTail, type CapsuleData, type WebQQChatStyle, type WebQQColorMode, type WebQQStorageBackend, type WebQQTheme } from './state'
import './style.scss'

interface ClientData {
  capsule?: CapsuleData
  debug?: boolean
  webQQTheme?: WebQQTheme
  webQQChatStyle?: WebQQChatStyle
  webQQTimBubbleTail?: boolean
  webQQColorMode?: WebQQColorMode
  webQQStorageBackend?: WebQQStorageBackend
  webQQMessageCacheLimit?: number
  webQQAccentColor?: string
  useBotAvatarThemeColor?: boolean
  hideWebQQGroupLevel?: boolean
  showWebQQAffinity?: boolean
  showWebQQRelationship?: boolean
  showWebQQCapsuleUnread?: boolean
}

const webQQAvatarThemeStorageKey = 'onebot-webqq:webqq-avatar-theme:v1'
let lastCheckedAvatar = ''

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function loadAvatarThemeCache() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(webQQAvatarThemeStorageKey)
    const data = raw ? JSON.parse(raw) : {}
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function loadCachedAvatarThemeColor(avatar: string) {
  const color = Reflect.get(loadAvatarThemeCache(), avatar)
  return isHexColor(color) ? color : ''
}

function cacheAvatarThemeColor(avatar: string, color: string) {
  if (typeof localStorage === 'undefined' || !isHexColor(color)) return
  try {
    localStorage.setItem(webQQAvatarThemeStorageKey, JSON.stringify({
      ...loadAvatarThemeCache(),
      [avatar]: color,
    }))
  } catch {}
}

function toHexPart(value: number) {
  return value.toString(16).padStart(2, '0')
}

function extractDominantAvatarColor(avatar: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 24
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('无法读取头像颜色'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const colors = new Map<string, number>()
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 128) continue
        const red = pixels[index] & 0xf0
        const green = pixels[index + 1] & 0xf0
        const blue = pixels[index + 2] & 0xf0
        const key = `${red},${green},${blue}`
        colors.set(key, (colors.get(key) || 0) + 1)
      }
      const dominant = [...colors.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
      if (!dominant) {
        reject(new Error('头像没有可用颜色'))
        return
      }
      const [red, green, blue] = dominant.split(',').map(Number)
      resolve(`#${toHexPart(red)}${toHexPart(green)}${toHexPart(blue)}`)
    }
    image.onerror = () => reject(new Error('头像加载失败'))
    image.src = withProxy(avatar)
  })
}

function updateWebQQAvatarThemeColor(data?: CapsuleData) {
  const avatar = data?.bot.avatar || ''
  if (!useBotAvatarThemeColor.value || !avatar) {
    webQQAvatarAccentColor.value = ''
    return
  }
  const cached = loadCachedAvatarThemeColor(avatar)
  webQQAvatarAccentColor.value = cached || ''
  if (lastCheckedAvatar === avatar) return
  lastCheckedAvatar = avatar
  extractDominantAvatarColor(avatar).then((color) => {
    if (capsule.value?.bot.avatar !== avatar || !useBotAvatarThemeColor.value) return
    webQQAvatarAccentColor.value = color
    cacheAvatarThemeColor(avatar, color)
  }).catch(() => {})
}

function resetClientEntryState() {
  lastCheckedAvatar = ''
  resetWebQQClientState()
}

export default function (ctx: Context, data?: Ref<ClientData>) {
  capsule.value = data?.value?.capsule
  debug.value = !!data?.value?.debug
  webQQTheme.value = data?.value?.webQQTheme || 'fresh'
  webQQChatStyle.value = data?.value?.webQQChatStyle || 'telegram'
  webQQTimBubbleTail.value = data?.value?.webQQTimBubbleTail ?? true
  webQQColorMode.value = data?.value?.webQQColorMode || 'auto'
  webQQStorageBackend.value = data?.value?.webQQStorageBackend || 'koishi'
  webQQMessageCacheLimit.value = data?.value?.webQQMessageCacheLimit ?? 100
  webQQAccentColor.value = data?.value?.webQQAccentColor || '#2563eb'
  useBotAvatarThemeColor.value = data?.value?.useBotAvatarThemeColor ?? false
  hideWebQQGroupLevel.value = data?.value?.hideWebQQGroupLevel ?? true
  showWebQQAffinity.value = data?.value?.showWebQQAffinity ?? false
  showWebQQRelationship.value = data?.value?.showWebQQRelationship ?? false
  showWebQQCapsuleUnread.value = data?.value?.showWebQQCapsuleUnread ?? true
  updateWebQQAvatarThemeColor(capsule.value)

  if (debug.value) {
    console.debug('[onebot-webqq] entry data', data?.value)
  }

  ctx.effect(() => {
    const disposeUpdateReceive = receive('onebot-webqq/update', (value) => {
      capsule.value = value as CapsuleData | undefined
      updateWebQQAvatarThemeColor(capsule.value)
      if (debug.value) {
        console.debug('[onebot-webqq] update', value)
      }
    })

    return () => {
      // Koishi client receive 旧实现没有 disposer；插件卸载时覆盖为空回调，避免 update 事件继续持有旧的全局 ref 闭包。
      if (typeof disposeUpdateReceive === 'function') disposeUpdateReceive()
      else receive('onebot-webqq/update', () => {})
      resetClientEntryState()
    }
  })

  ctx.slot({
    type: 'global',
    component: Capsule,
    order: 100,
  })
}
