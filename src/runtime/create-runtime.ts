import type { Config as PluginConfig } from '../config'
import type { ChatCapsuleContext } from '../plugin-context'
import { readWebQQBotGroupSenderMetadata } from '../webqq/adapters/onebot/group-sender-metadata'
import { createOneBotWebQQService } from '../webqq/adapters/onebot/service'
import { createWebQQImageUrlResolver } from '../webqq/media/image-url-resolver'

function normalizeOneBotSelfId(value?: string) {
  const selfId = value?.trim()
  return selfId || undefined
}

function getConfiguredOneBotSelfIds(config: PluginConfig) {
  return Array.from(new Set([
    ...(config.onebotSelfIds ?? []).map(normalizeOneBotSelfId),
  ].filter((selfId): selfId is string => !!selfId)))
}

export function createPluginRuntime(ctx: ChatCapsuleContext, config: PluginConfig) {
  const historyLimit = config.historyLimit ?? 100
  const debug = !!config.debug
  const logger = debug ? ctx.logger?.('onebot-webqq') : undefined
  const configuredOneBotSelfIds = getConfiguredOneBotSelfIds(config)
  const useRuntimeOneBotBots = config.onebotUseRuntimeBots ?? true
  const initialOneBotSelfId = !useRuntimeOneBotBots ? configuredOneBotSelfIds[0] : undefined
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger, {
    cacheEnabled: config.webQQImageCacheEnabled ?? true,
    cacheLimitBytes: (config.webQQImageCacheLimitMB ?? 100) * 1024 * 1024,
    cacheItemLimitBytes: (config.webQQImageCacheItemLimitMB ?? 10) * 1024 * 1024,
  })
  const webqq = createOneBotWebQQService(ctx, {
    selfId: initialOneBotSelfId,
    selfIds: useRuntimeOneBotBots ? undefined : configuredOneBotSelfIds,
    mockBotCount: config.onebotMockBotCount,
    protocol: config.onebotProtocol,
    imageUrlResolver,
  })

  return {
    historyLimit,
    debug,
    logger,
    imageUrlResolver,
    webqq,
    readBotSenderMetadata: readWebQQBotGroupSenderMetadata,
    consoleAuthOptions: { authority: 1 },
  }
}
