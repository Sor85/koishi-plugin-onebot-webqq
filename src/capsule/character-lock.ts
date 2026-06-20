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
  service.acquireResponseLock = async (session, message) => {
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

  service.releaseResponseLock = async (session) => {
    try {
      await releaseResponseLock.call(service, session)
    } finally {
      options.clearActivity('character-release')
    }
  }

  ctx.on('dispose', () => {
    service.acquireResponseLock = acquireResponseLock
    service.releaseResponseLock = releaseResponseLock
  })
}
