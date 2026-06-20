import type { Config as PluginConfig } from '../config'
import { registerCapsule } from '../capsule/register'
import type {
  ChatCapsuleContext,
  ChatLunaCharacterAfterChatPayload,
} from '../plugin-context'
import { registerWebQQ } from '../webqq/register'
import { createPluginRuntime } from './create-runtime'

export function registerPluginRuntime(ctx: ChatCapsuleContext, config: PluginConfig) {
  const {
    historyLimit,
    debug,
    logger,
    imageUrlResolver,
    webqq,
    consoleAuthOptions,
    readBotSenderMetadata,
  } = createPluginRuntime(ctx, config)
  const capsuleRuntime = registerCapsule({
    ctx,
    config,
    debug,
    bots: webqq,
    consoleAuthOptions,
    readBotSenderMetadata,
    logger,
  })
  const liveRuntime = registerWebQQ({
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    historyLimit,
    logger,
    getThinkingDurationMs: capsuleRuntime.getThinkingDurationMs,
    getThinkingUsage: capsuleRuntime.getThinkingUsage,
    getStorageScope: capsuleRuntime.getStorageScope,
    readBotState: capsuleRuntime.readBotState,
    broadcastBotState: capsuleRuntime.broadcastBotState,
  })

  ctx.on('message', async (session) => {
    capsuleRuntime.recordIncomingMessage(session)
    await liveRuntime.recordWebQQLiveMessage(session)
    await capsuleRuntime.refreshIdleScheduleActivity('message-schedule', session)
  })

  ctx.on('chatluna_character/after-chat', (payload: ChatLunaCharacterAfterChatPayload) => {
    liveRuntime.updateLastOutgoingWebQQThinking(payload)
  })
}
