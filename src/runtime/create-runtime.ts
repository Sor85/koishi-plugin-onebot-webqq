import type { Config as PluginConfig } from '../config'
import type { ChatCapsuleContext } from '../plugin-context'
import { createMockWebQQService } from '../webqq/adapters/mock/service'
import { createOneBotWebQQService } from '../webqq/adapters/onebot/service'
import { createWebQQImageUrlResolver } from '../webqq/media/image-url-resolver'
import { createConsoleOwnerToken } from '../shared/console-listeners'

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
  // 故障日志不能挂在 debug 开关上，否则「请检查日志」时日志里什么都没有。
  const errorLogger = ctx.logger?.('onebot-webqq') ?? logger
  const configuredOneBotSelfIds = getConfiguredOneBotSelfIds(config)
  const useRuntimeOneBotBots = config.onebotUseRuntimeBots ?? true
  const initialOneBotSelfId = !useRuntimeOneBotBots ? configuredOneBotSelfIds[0] : undefined
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger, {
    cacheEnabled: config.webQQImageCacheEnabled ?? true,
    cacheLimitBytes: (config.webQQImageCacheLimitMB ?? 100) * 1024 * 1024,
    cacheItemLimitBytes: (config.webQQImageCacheItemLimitMB ?? 10) * 1024 * 1024,
  })
  // 开发者模拟环境完全走内存预设，避免依赖真实 OneBot bot / 协议实现。
  const webqq = config.webQQMockEnvironment
    ? createMockWebQQService(undefined, { mockBotCount: config.onebotMockBotCount })
    : createOneBotWebQQService(ctx, {
      selfId: initialOneBotSelfId,
      selfIds: useRuntimeOneBotBots ? undefined : configuredOneBotSelfIds,
      mockBotCount: config.onebotMockBotCount,
      protocol: config.onebotProtocol,
      imageUrlResolver,
      logBotStatus: logger
        ? (source, data) => logger.info('[bot-status-debug] %s %s', source, JSON.stringify(data))
        : undefined,
    })

  return {
    historyLimit,
    debug,
    logger,
    errorLogger,
    // 每次 apply 一个身份，用来在 dispose 时只回收本次注册的控制台监听器。
    consoleOwner: createConsoleOwnerToken(),
    imageUrlResolver,
    webqq,
    consoleAuthOptions: { authority: 1 },
  }
}
