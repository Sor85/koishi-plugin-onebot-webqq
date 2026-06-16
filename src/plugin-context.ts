import type { Entry } from '@koishijs/console'
import type { Session } from 'koishi'
import type { ChatLunaMessage } from './chatluna/message-input'
import type { ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload } from './chatluna/thinking'
import type {
  WebQQContacts,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQNotice,
  WebQQNoticeAction,
  OneBotRobotState,
  WebQQRecordTranscriptionQuery,
} from './onebot'
import type { WebQQImageServer } from './webqq/image-url-resolver'
import type {
  WebQQMessageCachePayload,
  WebQQMessageCacheQuery,
  WebQQStoredState,
} from './webqq/storage'

export interface ConsoleEvents {
  'onebot-webqq/webqq/contacts': () => Promise<WebQQContacts>
  'onebot-webqq/webqq/messages': (query: WebQQMessageQuery) => Promise<WebQQMessage[]>
  'onebot-webqq/webqq/group-info': (query: WebQQGroupInfoQuery) => Promise<WebQQGroupInfo>
  'onebot-webqq/webqq/record/transcribe': (query: WebQQRecordTranscriptionQuery) => Promise<string>
  'onebot-webqq/webqq/notices': () => Promise<WebQQNotice[]>
  'onebot-webqq/webqq/notice-action': (action: WebQQNoticeAction) => Promise<void>
  'onebot-webqq/webqq/bot/select': (input: { selfId: string }) => Promise<OneBotRobotState>
  'onebot-webqq/webqq/storage/load': () => Promise<WebQQStoredState>
  'onebot-webqq/webqq/storage/save': (state: WebQQStoredState) => Promise<void>
  'onebot-webqq/webqq/messages/cache/load': (query: WebQQMessageCacheQuery) => Promise<WebQQMessage[]>
  'onebot-webqq/webqq/messages/cache/save': (payload: WebQQMessageCachePayload) => Promise<void>
}

export interface ConsoleService {
  addEntry(files: Entry.Files, data?: () => unknown): unknown
  addListener<Event extends keyof ConsoleEvents>(event: Event, callback: ConsoleEvents[Event], options?: { authority?: number }): unknown
  broadcast(type: string, body: unknown, options?: { authority?: number }): unknown
}

export interface ModelService {
  extend(table: string, fields: Record<string, string>, options?: { primary?: string }): unknown
}

export interface DatabaseService {
  get(table: string, query: Record<string, unknown>): Promise<unknown[]>
  upsert(table: string, rows: unknown[]): Promise<unknown>
}

export interface DebugLogger {
  info(format: string, ...param: unknown[]): unknown
}

export interface FfmpegService {
  builder(): {
    input(buf: Buffer): {
      outputOption(...opts: string[]): {
        run(type: 'buffer'): Promise<Buffer>
      }
    }
  }
}

export interface ChatLunaCharacterService {
  acquireResponseLock(session: Session, message: ChatLunaMessage): Promise<boolean>
  releaseResponseLock(session: Session): Promise<void>
}

export interface ChatLunaScheduleService {
  getCurrentActivity?(session?: Session): Promise<string>
  getCurrentSummary?(session?: Session): Promise<string>
}

export interface ChatLunaModelUsage {
  source?: string
  context?: {
    conversationId?: string
  }
  usageMetadata?: {
    input_tokens?: number
    output_tokens?: number
  }
}

export type ChatLunaCharacterAfterChatPayload = BaseChatLunaCharacterAfterChatPayload & { session?: Session }

export interface CapsuleEvents {
  dispose: () => unknown
  message: (session: Session) => unknown
  'message-deleted': (session: Session) => unknown
  'internal/session': (session: Session) => unknown
  'friend-request': (session: Session) => unknown
  'guild-member-removed': (session: Session) => unknown
  'chatluna/before-chat': (
    conversationId: string,
    message: ChatLunaMessage | undefined,
    variables: unknown,
    chatInterface: unknown,
    session: Session | undefined,
  ) => unknown
  'chatluna/after-chat': () => unknown
  'chatluna/after-chat-error': () => unknown
  'chatluna/model-usage': (usage: ChatLunaModelUsage) => unknown
  'chatluna_character/after-chat': (payload: ChatLunaCharacterAfterChatPayload) => unknown
  'chatluna_character/message_collect': (session: Session | undefined, messages: ChatLunaMessage[] | undefined) => unknown
}

type InjectableService = 'console' | 'database' | 'chatluna_character'
type InjectServices = Partial<Record<InjectableService, { required: boolean }>>

// 描述插件运行所需的最小 Koishi 上下文能力。
export interface ChatCapsuleContext {
  console?: ConsoleService
  server?: WebQQImageServer
  database?: DatabaseService
  model?: ModelService
  ffmpeg?: FfmpegService
  chatluna_character?: ChatLunaCharacterService
  chatluna_schedule?: ChatLunaScheduleService
  bots?: unknown[]
  logger?(name: string): DebugLogger
  on<Event extends keyof CapsuleEvents>(event: Event, listener: CapsuleEvents[Event]): unknown
  before(event: 'send', listener: (session?: Session) => unknown): unknown
  setInterval(callback: () => void, delay: number): unknown
  inject(services: InjectServices, callback: (inner: ChatCapsuleContext) => void): unknown
}
