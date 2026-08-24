import type { ChatCapsuleContext, ChatLunaCharacterService } from '../plugin-context'
import { createMessageInput, readCapsuleMemberName } from './message-input'
import {
  recordConversationActivity,
  type CapsuleState,
} from './state'

export function registerChatLunaCharacterLockSync(
  ctx: ChatCapsuleContext,
  service: ChatLunaCharacterService,
  options: {
    state: CapsuleState
    logSnapshot: (source: string) => void
    broadcast: () => void
    clearActivity: (source: string) => void
  },
) {
  const acquireResponseLock = service.acquireResponseLock
  const releaseResponseLock = service.releaseResponseLock

  // 包裹 character 响应锁以同步胶囊状态，dispose 时恢复原方法。
  const patchedAcquire: ChatLunaCharacterService['acquireResponseLock'] = async (session, message) => {
    const acquired = await acquireResponseLock.call(service, session, message)
    if (acquired) {
      const input = createMessageInput(session, message)
      input.user.name = readCapsuleMemberName(session) || input.user.name
      recordConversationActivity(options.state, input, `正在与 ${input.user.name || input.user.id} 对话`)
      options.logSnapshot('character-lock')
      options.broadcast()
    }
    return acquired
  }

  const patchedRelease: ChatLunaCharacterService['releaseResponseLock'] = async (session) => {
    try {
      await releaseResponseLock.call(service, session)
    } finally {
      options.clearActivity('character-release')
    }
  }

  service.acquireResponseLock = patchedAcquire
  service.releaseResponseLock = patchedRelease

  ctx.on('dispose', () => {
    // 只在当前仍是本实例的包装时才回滚。修改插件时新实例会先包好新的一层，
    // 旧实例若无条件写回原方法，就会把新包装整个抹掉，胶囊对话状态从此不再更新。
    if (service.acquireResponseLock === patchedAcquire) service.acquireResponseLock = acquireResponseLock
    if (service.releaseResponseLock === patchedRelease) service.releaseResponseLock = releaseResponseLock
  })
}
