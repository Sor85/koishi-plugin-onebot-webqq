import type { CapsuleSnapshot } from '../capsule/state/types'
import type { OneBotRobotState } from '../onebot/types'
import type {
  WebQQContacts,
  WebQQForwardSendInput,
  WebQQFriendAction,
  WebQQGroupAction,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQLiveMessage,
  WebQQMessage,
  WebQQMessageCachePayload,
  WebQQMessageCacheQuery,
  WebQQMessageQuery,
  WebQQMessageReactionInput,
  WebQQMessageRecallInput,
  WebQQMessageSearchQuery,
  WebQQMessageSearchResult,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQProfile,
  WebQQProfileQuery,
  WebQQRecallPayload,
  WebQQRecordTranscriptionQuery,
  WebQQSelfProfileUpdate,
  WebQQSendPayload,
  WebQQStoredState,
} from '../webqq/types'

// 控制台契约：控制台与插件之间全部事件名及其载荷形状的唯一权威声明，含请求与广播两个方向。
// 服务端的请求映射与包入口全局声明从它派生，客户端的发送与接收函数、服务端的广播函数按它约束。
// 于是四端里任何一端漏改都编译失败，而不是等到运行时——请求名写错前端拿到 undefined、界面显示
// 「加载聊天历史失败」而日志里查不到原因；广播名写错则完全静默，只是实时消息不再出现、小胶囊
// 计数停在旧值，看起来像机器人掉线了。
//
// ADR 0010：契约落在共享层的中立位置。它同时管小胶囊的两个广播名，放进 WebQQ 领域会让那个领域
// 拥有小胶囊的事件；也不能留在 ../plugin-context.ts——那个文件 type-import 了 koishi 与控制台包，
// 客户端引用它就越过 ADR 0003 那条明线。
//
// ADR 0003：本文件及其 import 闭包不得引用 koishi，也不得引用任何间接引用 koishi 的 module。
// 前端 vite 构建的 external 不含 koishi，契约一旦沾上 koishi，整个 koishi 会被静默打进浏览器
// 产物且不产生任何报错。这条规矩由 tests/console-contract.test.ts 的 import 图守卫兜底。
//
// 契约只声明、不注册：注册顺序与 handler 实现留在各自的注册 module 里。契约表要被客户端引用，
// 一沾实现就会把整条服务端依赖链拖进浏览器产物。

/** 请求方向：前端问、后端答。 */
export interface ConsoleRequests {
  'onebot-webqq/webqq/contacts': () => Promise<WebQQContacts>
  'onebot-webqq/webqq/messages': (query: WebQQMessageQuery) => Promise<WebQQMessage[]>
  'onebot-webqq/webqq/messages/search': (query: WebQQMessageSearchQuery) => Promise<WebQQMessageSearchResult>
  'onebot-webqq/webqq/group-info': (query: WebQQGroupInfoQuery) => Promise<WebQQGroupInfo>
  'onebot-webqq/webqq/record/transcribe': (query: WebQQRecordTranscriptionQuery) => Promise<string>
  'onebot-webqq/webqq/notices': () => Promise<WebQQNotice[]>
  'onebot-webqq/webqq/notice-action': (action: WebQQNoticeAction) => Promise<void>
  'onebot-webqq/webqq/send': (payload: WebQQSendPayload) => Promise<void>
  'onebot-webqq/webqq/message-recall': (input: WebQQMessageRecallInput) => Promise<void>
  'onebot-webqq/webqq/message-reaction': (input: WebQQMessageReactionInput) => Promise<void>
  'onebot-webqq/webqq/profile': (query: WebQQProfileQuery) => Promise<WebQQProfile>
  'onebot-webqq/webqq/self-profile': (input: WebQQSelfProfileUpdate) => Promise<void>
  'onebot-webqq/webqq/friend-action': (input: WebQQFriendAction) => Promise<void>
  'onebot-webqq/webqq/group-action': (input: WebQQGroupAction) => Promise<void>
  'onebot-webqq/webqq/forward-send': (input: WebQQForwardSendInput) => Promise<void>
  'onebot-webqq/webqq/bot/select': (input: { selfId: string }) => Promise<OneBotRobotState>
  'onebot-webqq/webqq/storage/load': () => Promise<WebQQStoredState>
  'onebot-webqq/webqq/storage/save': (state: WebQQStoredState) => Promise<void>
  'onebot-webqq/webqq/messages/cache/load': (query: WebQQMessageCacheQuery) => Promise<WebQQMessage[]>
  'onebot-webqq/webqq/messages/cache/save': (payload: WebQQMessageCachePayload) => Promise<void>
}

/** 广播方向：后端推、前端收。 */
export interface ConsoleBroadcasts {
  'onebot-webqq/update': (data: CapsuleSnapshot | undefined) => void
  'onebot-webqq/bots/update': (data: OneBotRobotState) => void
  'onebot-webqq/webqq/message': (data: WebQQLiveMessage) => void
  'onebot-webqq/webqq/recall': (data: WebQQRecallPayload) => void
}

/** 两个方向合起来的那张表。包入口面向控制台包的全局声明从它派生。 */
export type ConsoleContract = ConsoleRequests & ConsoleBroadcasts

/** 一条广播的载荷形状。广播函数的签名与客户端的接收函数都从这里取，不各自派生一遍。 */
export type ConsoleBroadcastBody<Event extends keyof ConsoleBroadcasts> = Parameters<ConsoleBroadcasts[Event]>[0]

// 类型层的 interface 在运行时没有键表可枚举，而运行期恰好守着唯一无法编译期检查的失效形态：
// 契约声明了但没人注册、没人广播。运行期守卫读下面这两个数组。
//
// 按方向拆成两份而不是拼成一份：守卫要写「广播名必须有 broadcaster」这条判据，需要能直接拿到
// 广播那一组的键集。守卫测试自己维护一份清单是不行的——那份清单漏一条时编译期抓不到，它不是
// 契约的一端，而是又一份副本。
export const consoleRequestNames = [
  'onebot-webqq/webqq/contacts',
  'onebot-webqq/webqq/messages',
  'onebot-webqq/webqq/messages/search',
  'onebot-webqq/webqq/group-info',
  'onebot-webqq/webqq/record/transcribe',
  'onebot-webqq/webqq/notices',
  'onebot-webqq/webqq/notice-action',
  'onebot-webqq/webqq/send',
  'onebot-webqq/webqq/message-recall',
  'onebot-webqq/webqq/message-reaction',
  'onebot-webqq/webqq/profile',
  'onebot-webqq/webqq/self-profile',
  'onebot-webqq/webqq/friend-action',
  'onebot-webqq/webqq/group-action',
  'onebot-webqq/webqq/forward-send',
  'onebot-webqq/webqq/bot/select',
  'onebot-webqq/webqq/storage/load',
  'onebot-webqq/webqq/storage/save',
  'onebot-webqq/webqq/messages/cache/load',
  'onebot-webqq/webqq/messages/cache/save',
] as const satisfies readonly (keyof ConsoleRequests)[]

export const consoleBroadcastNames = [
  'onebot-webqq/update',
  'onebot-webqq/bots/update',
  'onebot-webqq/webqq/message',
  'onebot-webqq/webqq/recall',
] as const satisfies readonly (keyof ConsoleBroadcasts)[]

// 双向键集断言，写法沿用配置规格与 `Config` 之间那一份（见 src/config/schema.ts 末尾）：名字数组
// 的元素集与契约的键集必须完全相等，多一个少一个都编译失败。少了「少一个」这个方向，运行期守卫
// 会拿着一份不全的清单声称一切正常——那正是本轮要消灭的失效形态。
//
// 助手逐字重复而不是共享：那一份住在沾 koishi 的 schema.ts 里，ADR 0003 不给这条捷径。
// 上面的 `satisfies` 与这里重叠了一个方向，留着是因为它的报错直接指到数组里那个写错的元素上。
// 断言只在类型层，契约不为可测性多导出任何东西。
type AssertTrue<T extends true> = T
type KeySetsEqual<A extends PropertyKey, B extends PropertyKey> =
  [Exclude<A, B>] extends [never]
    ? ([Exclude<B, A>] extends [never] ? true : false)
    : false

type _RequestNamesMatchContract = AssertTrue<KeySetsEqual<keyof ConsoleRequests, typeof consoleRequestNames[number]>>
type _BroadcastNamesMatchContract = AssertTrue<KeySetsEqual<keyof ConsoleBroadcasts, typeof consoleBroadcastNames[number]>>
