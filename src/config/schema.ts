import { Schema } from 'koishi'
import type { WebQQProtocol } from '../onebot/protocol'
import {
  readConfigDefault,
  type ConfigKey,
  type ConfigValue,
  type WebQQChatStyle,
  type WebQQColorMode,
  type WebQQStorageBackend,
} from './spec'

// ADR 0003：`Config` 保持手写 interface，不从配置规格派生。它由包入口对外导出，派生成映射类型后
// 使用者在 IDE 里看到的是展不开的条件类型，而不是可读的字段列表。
// 「漏改一个配置项会编译报错」这个收益由本文件末尾的双向键集断言提供。
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
  enableWebQQFrostedGlass?: boolean
  enableWebQQSend?: boolean
  webQQChatStyle?: WebQQChatStyle
  webQQTimBubbleTail?: boolean
  webQQColorMode?: WebQQColorMode
  webQQAccentColor?: string
  enableCapsuleFrostedGlass?: boolean
  useCompactCapsuleShadow?: boolean
  hiddenCapsuleActivityIds?: string[]
  allowWebQQResize?: boolean
  hideWebQQGroupLevel?: boolean
  showWebQQAffinity?: boolean
  showWebQQRelationship?: boolean
  showWebQQCharacterThinking?: boolean
  showWebQQThinkingTokens?: boolean
  showWebQQThinkingTiming?: boolean
  webQQAffinityScopeId?: string
  showWebQQCapsuleUnread?: boolean
  webQQStorageBackend?: WebQQStorageBackend
  webQQMockEnvironment?: boolean
}

// Schema 的形状仍然手写：分组划分、分组顺序、字段顺序、控件类型、数值上下限、说明文案都不生成，
// 只有默认值改从配置规格读取。生成 Schema 在框架层面可行，但会丢掉键级字面量类型。
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    onebotUseRuntimeBots: Schema.boolean().default(readConfigDefault('onebotUseRuntimeBots')).description('使用当前运行时里所有可用的 OneBot 机器人，关闭后只使用下方 selfId 集合'),
    onebotSelfIds: Schema.array(Schema.string()).role('table').default(readConfigDefault('onebotSelfIds')).description('关闭运行时全量模式时允许使用的 OneBot 机器人 selfId 集合'),
    onebotProtocol: Schema.union([
      Schema.const('napcat').description('NapCat'),
      Schema.const('llbot').description('LLBot'),
    ]).default(readConfigDefault('onebotProtocol')).role('radio').description('WebQQ 读取接口使用的 OneBot 实现协议'),
  }).description('连接设置'),

  Schema.object({
    historyLimit: Schema.natural().min(1).max(100).default(readConfigDefault('historyLimit')).description('每次加载聊天历史的消息数量'),
    webQQMessageCacheLimit: Schema.natural().min(1).max(1000).default(readConfigDefault('webQQMessageCacheLimit')).description('每个 WebQQ 会话保留的最近消息缓存数量'),
    webQQStorageBackend: Schema.union([
      Schema.const('koishi').description('Koishi 数据库'),
      Schema.const('browser').description('浏览器'),
    ]).default(readConfigDefault('webQQStorageBackend')).role('radio').description('WebQQ 状态存储后端'),
    webQQImageCacheEnabled: Schema.boolean().default(readConfigDefault('webQQImageCacheEnabled')).description('启用 WebQQ 图片代理内存缓存，会额外占用服务器内存'),
    webQQImageCacheLimitMB: Schema.natural().min(1).max(4096).default(readConfigDefault('webQQImageCacheLimitMB')).description('WebQQ 图片代理内存缓存总上限，单位 MB'),
    webQQImageCacheItemLimitMB: Schema.natural().min(1).max(1024).default(readConfigDefault('webQQImageCacheItemLimitMB')).description('单张 WebQQ 图片超过此大小时不写入内存缓存，单位 MB'),
  }).description('历史与缓存'),

  Schema.object({
    enableCapsuleFrostedGlass: Schema.boolean().default(readConfigDefault('enableCapsuleFrostedGlass')).description('启用小胶囊毛玻璃效果'),
    useCompactCapsuleShadow: Schema.boolean().default(readConfigDefault('useCompactCapsuleShadow')).description('使用较窄的小胶囊阴影，关闭后使用较宽的阴影'),
    showWebQQCapsuleUnread: Schema.boolean().default(readConfigDefault('showWebQQCapsuleUnread')).description('在小胶囊 bot 头像上显示 WebQQ 总未读数'),
    hiddenCapsuleActivityIds: Schema.array(Schema.string()).role('onebot-webqq-activity-select').default(readConfigDefault('hiddenCapsuleActivityIds')).description('不显示小胶囊的控制台侧栏项'),
  }).description('小胶囊设置'),

  Schema.object({
    enableWebQQFrostedGlass: Schema.boolean().default(readConfigDefault('enableWebQQFrostedGlass')).description('启用 WebQQ 毛玻璃效果'),
    enableWebQQSend: Schema.boolean().default(readConfigDefault('enableWebQQSend')).description('启用 WebQQ 消息发送功能'),
    webQQChatStyle: Schema.union([
      Schema.const('tim').description('TIM'),
      Schema.const('qq').description('QQ'),
    ]).default(readConfigDefault('webQQChatStyle')).role('radio').description('WebQQ 聊天页面样式'),
    webQQTimBubbleTail: Schema.boolean().default(readConfigDefault('webQQTimBubbleTail')).description('显示 TIM 气泡小尖角'),
    webQQColorMode: Schema.union([
      Schema.const('auto').description('自动'),
      Schema.const('light').description('明亮'),
      Schema.const('dark').description('暗色'),
    ]).default(readConfigDefault('webQQColorMode')).role('radio').description('WebQQ 颜色模式'),
    webQQAccentColor: Schema.string().default(readConfigDefault('webQQAccentColor')).role('color').description('WebQQ 强调色'),
    allowWebQQResize: Schema.boolean().default(readConfigDefault('allowWebQQResize')).description('允许拖动 WebQQ 以调整窗口宽高'),
    webQQMarkRecalledMessages: Schema.boolean().default(readConfigDefault('webQQMarkRecalledMessages')).description('保留被撤回的 WebQQ 消息并显示删除线。关闭后显示撤回事件并移除原消息'),
    hideWebQQGroupLevel: Schema.boolean().default(readConfigDefault('hideWebQQGroupLevel')).description('隐藏 WebQQ 消息中的群等级徽标'),
    showWebQQAffinity: Schema.boolean().default(readConfigDefault('showWebQQAffinity')).description('在 WebQQ 用户昵称右侧显示 ChatLuna 好感度'),
    showWebQQRelationship: Schema.boolean().default(readConfigDefault('showWebQQRelationship')).description('在 WebQQ 用户昵称右侧显示 ChatLuna 关系'),
    showWebQQCharacterThinking: Schema.boolean().default(readConfigDefault('showWebQQCharacterThinking')).description('在 WebQQ 中显示 chatluna-character 的 think 内容'),
    showWebQQThinkingTokens: Schema.boolean().default(readConfigDefault('showWebQQThinkingTokens')).description('在 WebQQ 中显示 ChatLuna 输入/输出 token，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示'),
    showWebQQThinkingTiming: Schema.boolean().default(readConfigDefault('showWebQQThinkingTiming')).description('在 WebQQ 中显示 ChatLuna TTFT、TPS 和 Total，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示'),
    // 配置规格里没有默认值的唯一一项，因此这里也不能调 .default()。
    webQQAffinityScopeId: Schema.string().description('ChatLuna 好感度插件的 scopeId，留空且当前只有一个 scopeId 时自动使用'),
  }).description('WebQQ 设置'),

  Schema.object({
    onebotMockBotCount: Schema.natural().max(20).default(readConfigDefault('onebotMockBotCount')).description('额外模拟的 OneBot 机器人数量，勿动'),
    webQQMockEnvironment: Schema.boolean().default(readConfigDefault('webQQMockEnvironment')).description('启用 WebQQ 开发者模拟环境'),
    debug: Schema.boolean().default(readConfigDefault('debug')).description('显示调试信息'),
  }).description('开发者选项'),
])

// 双向键集断言：配置规格的键集与 `Config` 的键集必须完全相等，多一个少一个都编译失败。
// 这是「新增配置项时漏掉某一端就编译报错」的实际来源，替代了 ADR 0003 里被否掉的「Config 从规格派生」。
type AssertTrue<T extends true> = T
type KeySetsEqual<A extends PropertyKey, B extends PropertyKey> =
  [Exclude<A, B>] extends [never]
    ? ([Exclude<B, A>] extends [never] ? true : false)
    : false

type _ConfigKeysMatchSpec = AssertTrue<KeySetsEqual<keyof Config, ConfigKey>>

// 配置规格的默认值必须能落进 `Config` 的字段类型，否则两处对同一个配置项的取值类型已经漂移。
type _SpecDefaultsMatchConfig = AssertTrue<
  [{
    [K in ConfigKey & keyof Config]: ConfigValue<K> extends Config[K] ? never : K
  }[ConfigKey & keyof Config]] extends [never] ? true : false
>
