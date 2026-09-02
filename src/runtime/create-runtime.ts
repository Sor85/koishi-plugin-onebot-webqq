import type { Config as PluginConfig } from '../config'
import { readConfigValue } from '../config/spec'
import type { OneBotBotScope } from '../onebot/bots'
import type { ChatCapsuleContext } from '../plugin-context'
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
  // 开发者模拟环境把候选集合换成虚拟 OneBot 机器人，读写与实时链路都走真实 OneBot action 与真实 Koishi 事件。
  const botScope: OneBotBotScope = {
    includeVirtualBots: readConfigValue(config, 'webQQMockEnvironment'),
  }
  // 虚拟机器人的 selfId 由提供方插件决定，白名单在模拟环境下整体不参与筛选，初始选中项同样不能钉在白名单第一项上。
  const initialOneBotSelfId = !useRuntimeOneBotBots && !botScope.includeVirtualBots
    ? configuredOneBotSelfIds[0]
    : undefined
  const mockBotCount = readConfigValue(config, 'onebotMockBotCount')
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger, {
    cacheEnabled: readConfigValue(config, 'webQQImageCacheEnabled'),
    cacheLimitBytes: readConfigValue(config, 'webQQImageCacheLimitMB') * 1024 * 1024,
    cacheItemLimitBytes: readConfigValue(config, 'webQQImageCacheItemLimitMB') * 1024 * 1024,
  })
  const webqq = createOneBotWebQQService(ctx, {
    selfId: initialOneBotSelfId,
    selfIds: useRuntimeOneBotBots ? undefined : configuredOneBotSelfIds,
    mockBotCount,
    ...botScope,
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
    botScope,
    consoleAuthOptions: { authority: 1 },
  }
}
