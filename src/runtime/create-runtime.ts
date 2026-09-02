import type { Config as PluginConfig } from '../config'
import { readConfigValue } from '../config/spec'
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
    ...readConfigValue(config, 'onebotSelfIds').map(normalizeOneBotSelfId),
  ].filter((selfId): selfId is string => !!selfId)))
}

export function createPluginRuntime(ctx: ChatCapsuleContext, config: PluginConfig) {
  const historyLimit = readConfigValue(config, 'historyLimit')
  const debug = readConfigValue(config, 'debug')
  const logger = debug ? ctx.logger?.('onebot-webqq') : undefined
  // 故障日志不能挂在 debug 开关上，否则「请检查日志」时日志里什么都没有。
  const errorLogger = ctx.logger?.('onebot-webqq') ?? logger
  const configuredOneBotSelfIds = getConfiguredOneBotSelfIds(config)
  const useRuntimeOneBotBots = readConfigValue(config, 'onebotUseRuntimeBots')
  const initialOneBotSelfId = !useRuntimeOneBotBots ? configuredOneBotSelfIds[0] : undefined
  const mockBotCount = readConfigValue(config, 'onebotMockBotCount')
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger, {
    cacheEnabled: readConfigValue(config, 'webQQImageCacheEnabled'),
    cacheLimitBytes: readConfigValue(config, 'webQQImageCacheLimitMB') * 1024 * 1024,
    cacheItemLimitBytes: readConfigValue(config, 'webQQImageCacheItemLimitMB') * 1024 * 1024,
  })
  // 开发者模拟环境完全走内存预设，避免依赖真实 OneBot bot / 协议实现。
  const webqq = readConfigValue(config, 'webQQMockEnvironment')
    ? createMockWebQQService(undefined, { mockBotCount })
    : createOneBotWebQQService(ctx, {
      selfId: initialOneBotSelfId,
      selfIds: useRuntimeOneBotBots ? undefined : configuredOneBotSelfIds,
      mockBotCount,
      protocol: readConfigValue(config, 'onebotProtocol'),
      imageUrlResolver,
      logBotStatus: logger
        ? (source, data) => logger.info('[bot-status-debug] %s %s', source, JSON.stringify(data))
        : undefined,
    })

  return {
    historyLimit,
    logger,
    errorLogger,
    // 每次 apply 一个身份，用来在 dispose 时只回收本次注册的控制台监听器。
    consoleOwner: createConsoleOwnerToken(),
    imageUrlResolver,
    webqq,
    consoleAuthOptions: { authority: 1 },
  }
}
