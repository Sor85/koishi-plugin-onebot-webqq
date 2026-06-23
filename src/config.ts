import { Schema } from 'koishi'
import type { WebQQProtocol } from './onebot/protocol'

export interface Config {
  debug?: boolean
  onebotUseRuntimeBots?: boolean
  onebotSelfIds?: string[]
  onebotMockBotCount?: number
  onebotProtocol?: WebQQProtocol
  historyLimit?: number
  webQQMessageCacheLimit?: number
  webQQImageCacheEnabled?: boolean
  webQQImageCacheLimitMB?: number
  webQQImageCacheItemLimitMB?: number
  webQQMarkRecalledMessages?: boolean
  webQQTheme?: 'fresh' | 'frosted'
  webQQChatStyle?: 'qq' | 'telegram'
  webQQTimBubbleTail?: boolean
  webQQColorMode?: 'auto' | 'light' | 'dark'
  webQQAccentColor?: string
  useCompactCapsuleShadow?: boolean
  allowWebQQResize?: boolean
  hideWebQQGroupLevel?: boolean
  showWebQQAffinity?: boolean
  showWebQQRelationship?: boolean
  showWebQQCharacterThinking?: boolean
  showWebQQThinkingTokens?: boolean
  showWebQQThinkingTiming?: boolean
  webQQAffinityScopeId?: string
  showWebQQCapsuleUnread?: boolean
  webQQStorageBackend?: 'browser' | 'koishi'
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    onebotUseRuntimeBots: Schema.boolean().default(true).description('使用当前运行时里所有可用的 OneBot 机器人，关闭后只使用下方 selfId 集合'),
    onebotSelfIds: Schema.array(Schema.string()).role('table').default([]).description('关闭运行时全量模式时允许使用的 OneBot 机器人 selfId 集合'),
    onebotProtocol: Schema.union([
      Schema.const('napcat').description('NapCat'),
      Schema.const('llbot').description('LLBot'),
    ]).default('napcat').role('radio').description('WebQQ 读取接口使用的 OneBot 实现协议'),
  }).description('连接设置'),

  Schema.object({
    historyLimit: Schema.natural().min(1).max(100).default(100).description('每次加载聊天历史的消息数量'),
    webQQMessageCacheLimit: Schema.natural().min(1).max(1000).default(100).description('每个 WebQQ 会话保留的最近消息缓存数量'),
    webQQStorageBackend: Schema.union([
      Schema.const('koishi').description('Koishi 数据库'),
      Schema.const('browser').description('浏览器'),
    ]).default('koishi').role('radio').description('WebQQ 状态存储后端'),
    webQQImageCacheEnabled: Schema.boolean().default(true).description('启用 WebQQ 图片代理内存缓存，会额外占用服务器内存'),
    webQQImageCacheLimitMB: Schema.natural().min(1).max(4096).default(100).description('WebQQ 图片代理内存缓存总上限，单位 MB'),
    webQQImageCacheItemLimitMB: Schema.natural().min(1).max(1024).default(10).description('单张 WebQQ 图片超过此大小时不写入内存缓存，单位 MB'),
  }).description('历史与缓存'),

  Schema.object({
    useCompactCapsuleShadow: Schema.boolean().default(true).description('使用较窄的小胶囊阴影，关闭后使用较宽的阴影'),
    showWebQQCapsuleUnread: Schema.boolean().default(true).description('在小胶囊 bot 头像上显示 WebQQ 总未读数'),
  }).description('小胶囊设置'),

  Schema.object({
    webQQTheme: Schema.union([
      Schema.const('fresh').description('清爽'),
      Schema.const('frosted').description('毛玻璃'),
    ]).default('fresh').role('radio').description('WebQQ 主题'),
    webQQChatStyle: Schema.union([
      Schema.const('telegram').description('TIM'),
      Schema.const('qq').description('QQ'),
    ]).default('telegram').role('radio').description('WebQQ 聊天页面样式'),
    webQQTimBubbleTail: Schema.boolean().default(true).description('显示 TIM 气泡小尖角'),
    webQQColorMode: Schema.union([
      Schema.const('auto').description('自动'),
      Schema.const('light').description('明亮'),
      Schema.const('dark').description('暗色'),
    ]).default('auto').role('radio').description('WebQQ 颜色模式'),
    webQQAccentColor: Schema.string().default('#2563eb').role('color').description('WebQQ 主题色'),
    allowWebQQResize: Schema.boolean().default(false).description('允许拖动 WebQQ 以调整窗口宽高'),
    webQQMarkRecalledMessages: Schema.boolean().default(true).description('保留被撤回的 WebQQ 消息并显示删除线。关闭后显示撤回事件并移除原消息'),
    hideWebQQGroupLevel: Schema.boolean().default(true).description('隐藏 WebQQ 消息中的群等级徽标'),
    showWebQQAffinity: Schema.boolean().default(false).description('在 WebQQ 用户昵称右侧显示 ChatLuna 好感度'),
    showWebQQRelationship: Schema.boolean().default(false).description('在 WebQQ 用户昵称右侧显示 ChatLuna 关系'),
    showWebQQCharacterThinking: Schema.boolean().default(true).description('在 WebQQ 中显示 chatluna-character 的 think 内容'),
    showWebQQThinkingTokens: Schema.boolean().default(true).description('在 WebQQ 中显示 ChatLuna 输入/输出 token，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示'),
    showWebQQThinkingTiming: Schema.boolean().default(true).description('在 WebQQ 中显示 ChatLuna TTFT、TPS 和 Total，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示'),
    webQQAffinityScopeId: Schema.string().description('ChatLuna 好感度插件的 scopeId，留空且当前只有一个 scopeId 时自动使用'),
  }).description('WebQQ 设置'),

  Schema.object({
    onebotMockBotCount: Schema.natural().max(20).default(0).description('额外模拟的 OneBot 机器人数量，勿动'),
    debug: Schema.boolean().default(false).description('显示调试信息'),
  }).description('开发者选项'),
])
