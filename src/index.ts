import type { Config as PluginConfig } from './config'
import {
  CapsuleSnapshot,
} from './capsule/state'
import {
  WebQQContacts,
  WebQQForwardSendInput,
  WebQQFriendAction,
  WebQQGroupAction,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQLiveMessage,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQMessageSearchQuery,
  WebQQMessageSearchResult,
  WebQQMessageReactionInput,
  WebQQMessageRecallInput,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQProfile,
  WebQQProfileQuery,
  WebQQRecallPayload,
  WebQQRecordTranscriptionQuery,
  WebQQSelfProfileUpdate,
  WebQQSendPayload,
} from './webqq/types'
import type { OneBotRobotState } from './onebot/types'
import type {
  ChatCapsuleStorageRow,
} from './webqq/storage/schema'
import type {
  WebQQMessageCachePayload,
  WebQQMessageCacheQuery,
} from './webqq/storage/message-cache'
import type {
  WebQQStoredState,
} from './webqq/storage/state'
import type {
  ChatCapsuleContext,
} from './plugin-context'
import { registerPluginRuntime } from './runtime/register'

export { Config } from './config'
export type { ChatCapsuleContext } from './plugin-context'

export const name = 'onebot-webqq'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character', 'ffmpeg', 'chatluna_schedule'],
}

declare module '@koishijs/console' {
  interface Events {
    'onebot-webqq/update'(data: CapsuleSnapshot | undefined): void
    'onebot-webqq/bots/update'(data: OneBotRobotState): void
    'onebot-webqq/webqq/message'(data: WebQQLiveMessage): void
    'onebot-webqq/webqq/recall'(data: WebQQRecallPayload): void
    'onebot-webqq/webqq/contacts'(): Promise<WebQQContacts>
    'onebot-webqq/webqq/group-info'(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo>
    'onebot-webqq/webqq/messages'(query: WebQQMessageQuery): Promise<WebQQMessage[]>
    'onebot-webqq/webqq/messages/search'(query: WebQQMessageSearchQuery): Promise<WebQQMessageSearchResult>
    'onebot-webqq/webqq/record/transcribe'(query: WebQQRecordTranscriptionQuery): Promise<string>
    'onebot-webqq/webqq/notices'(): Promise<WebQQNotice[]>
    'onebot-webqq/webqq/notice-action'(action: WebQQNoticeAction): Promise<void>
    'onebot-webqq/webqq/send'(payload: WebQQSendPayload): Promise<void>
    'onebot-webqq/webqq/message-recall'(input: WebQQMessageRecallInput): Promise<void>
    'onebot-webqq/webqq/message-reaction'(input: WebQQMessageReactionInput): Promise<void>
    'onebot-webqq/webqq/profile'(query: WebQQProfileQuery): Promise<WebQQProfile>
    'onebot-webqq/webqq/self-profile'(input: WebQQSelfProfileUpdate): Promise<void>
    'onebot-webqq/webqq/friend-action'(input: WebQQFriendAction): Promise<void>
    'onebot-webqq/webqq/group-action'(input: WebQQGroupAction): Promise<void>
    'onebot-webqq/webqq/forward-send'(input: WebQQForwardSendInput): Promise<void>
    'onebot-webqq/webqq/bot/select'(input: { selfId: string }): Promise<OneBotRobotState>
    'onebot-webqq/webqq/storage/load'(): Promise<WebQQStoredState>
    'onebot-webqq/webqq/storage/save'(state: WebQQStoredState): Promise<void>
    'onebot-webqq/webqq/messages/cache/load'(query: WebQQMessageCacheQuery): Promise<WebQQMessage[]>
    'onebot-webqq/webqq/messages/cache/save'(payload: WebQQMessageCachePayload): Promise<void>
  }
}

declare module 'koishi' {
  interface Tables {
    onebot_webqq_storage: ChatCapsuleStorageRow
  }
}

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: PluginConfig = {}) {
  registerPluginRuntime(ctx, config)
}
