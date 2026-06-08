import type { Entry } from '@koishijs/console'
import type { Session } from 'koishi'
import type { ChatLunaMessage } from './chatluna/message-input'
import type { WebQQImageServer } from './webqq/image-url-resolver'

export interface ConsoleService {
  addEntry(files: Entry.Files, data?: () => unknown): unknown
  addListener(event: string, callback: (...args: any[]) => unknown, options?: { authority?: number }): unknown
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

// 描述插件运行所需的最小 Koishi 上下文能力。
export interface ChatCapsuleContext {
  console?: ConsoleService
  server?: WebQQImageServer
  database?: DatabaseService
  model?: ModelService
  ffmpeg?: { builder(): { input(buf: Buffer): { outputOption(...opts: string[]): { run(type: 'buffer'): Promise<Buffer> } } } }
  chatluna_character?: ChatLunaCharacterService
  chatluna_schedule?: ChatLunaScheduleService
  bots?: unknown[]
  logger?(name: string): DebugLogger
  on(event: string, listener: (...args: any[]) => void): unknown
  before(event: 'send', listener: (session?: Session) => unknown): unknown
  setInterval(callback: () => void, delay: number): unknown
  inject(services: Record<string, { required: boolean }>, callback: (inner: ChatCapsuleContext) => void): unknown
}
