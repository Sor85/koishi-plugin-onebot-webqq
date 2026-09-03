import type { Entry } from '@koishijs/console'
import type { Session } from 'koishi'
import type { ChatLunaMessage } from './capsule/message-input'
import type { ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload } from './webqq/thinking'
import type { ConsoleBroadcastBody, ConsoleBroadcasts, ConsoleRequests } from './shared/console-contract'
import type { WebQQImageServer } from './webqq/media/image-url-resolver'

// 请求映射就是控制台契约的请求那一组，不再另抄一遍。改契约、漏改这里都不可能：这里没有可漏改的
// 东西。注册侧的类型锚仍然是这个名字，因此二十个 addListener 调用点一处不动。
export type ConsoleEvents = ConsoleRequests

export interface ConsoleService {
  addEntry(files: Entry.Files, data?: () => unknown): unknown
  addListener<Event extends keyof ConsoleEvents>(event: Event, callback: ConsoleEvents[Event], options?: { authority?: number }): unknown
  // 广播名与载荷都按控制台契约检查。这是这条缝上最坏的失效形态：写错名字完全静默——没有报错也没
  // 有失败提示，只是实时消息不再出现、小胶囊计数停在旧值，看起来像机器人掉线了。
  broadcast<Event extends keyof ConsoleBroadcasts>(event: Event, body: ConsoleBroadcastBody<Event>, options?: { authority?: number }): unknown
  // Koishi 的 Console.addListener 只做 `listeners[event] = {...}`，既不返回 disposable
  // 也不随插件 ctx 回收。停用插件后这些回调会继续留在全局 listeners 上并指向已 dispose 的
  // 上下文，因此需要按引用比对后自行摘除。
  listeners?: Record<string, { callback?: unknown } | undefined>
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
  // 真实的 Koishi logger 一定有 warn；测试替身只提供 info，因此保持可选并回退到 info。
  warn?(format: string, ...param: unknown[]): unknown
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
    total_tokens?: number
  }
  timing?: {
    ttftMs?: number
    totalMs?: number
    tps?: number
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
  'login-added': (session: Session) => unknown
  'login-removed': (session: Session) => unknown
  'login-updated': (session: Session) => unknown
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
