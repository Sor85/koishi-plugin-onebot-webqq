import type { Session } from 'koishi'
import Schema from 'schemastery'
import { resolve } from 'path'
import type { Entry } from '@koishijs/console'
import {
  CapsuleSnapshot,
  clearConversationActivity,
  createCapsuleState,
  recordConversationActivity,
  recordIncomingMessage,
  recordOutgoingMessage,
} from './state'

export const name = 'chat-capsule'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'chatluna', 'chatluna_character'],
}

export interface Config {
  debug?: boolean
}

export const Config: Schema<Config> = Schema.object({
  debug: Schema.boolean().default(false).description('显示前端调试信息'),
})

declare module '@koishijs/console' {
  interface Events {
    'chat-capsule/update'(data: CapsuleSnapshot | undefined): void
  }
}

interface ConsoleService {
  addEntry(files: Entry.Files, data?: () => unknown): unknown
  broadcast(type: string, body: unknown): unknown
}

interface DebugLogger {
  info(format: string, ...param: unknown[]): unknown
}

interface ChatLunaMessage {
  id?: string
  name?: string
}

interface ChatLunaCharacterService {
  acquireResponseLock(session: Session, message: ChatLunaMessage): Promise<boolean>
  releaseResponseLock(session: Session): Promise<void>
}

// 描述插件运行所需的最小 Koishi 上下文能力。
export interface ChatCapsuleContext {
  console?: ConsoleService
  chatluna_character?: ChatLunaCharacterService
  logger?(name: string): DebugLogger
  on(event: string, listener: (...args: any[]) => void): unknown
  before(event: 'send', listener: () => void): unknown
  inject(services: Record<string, { required: boolean }>, callback: (inner: ChatCapsuleContext) => void): unknown
}

function readBotProfile(session: Session) {
  const user = session.bot.toJSON?.().user
  return {
    platform: session.bot.platform || session.platform || 'unknown',
    selfId: session.bot.selfId,
    status: session.bot.status,
    name: user?.name,
    avatar: user?.avatar,
  }
}

function readChannelName(session: Session) {
  return session.event.guild?.name || session.event.channel?.name
}

function readUserName(session: Session) {
  return session.event.user?.name || session.username
}

function createMessageInput(session: Session, message?: ChatLunaMessage) {
  return {
    bot: readBotProfile(session),
    channel: {
      id: session.channelId || session.event.channel?.id || 'unknown',
      name: readChannelName(session),
    },
    user: {
      id: message?.id || session.userId || session.event.user?.id || 'unknown',
      name: message?.name || readUserName(session),
    },
    timestamp: session.timestamp,
  }
}

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: Config = {}) {
  const state = createCapsuleState()
  const debug = !!config.debug
  const logger = debug ? ctx.logger?.('chat-capsule') : undefined
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => ctx.console?.broadcast('chat-capsule/update', state.snapshot())
  const recordGenerating = (session: Session, message?: ChatLunaMessage) => {
    recordConversationActivity(state, createMessageInput(session, message), '正在思考')
    logSnapshot('generating')
    broadcast()
  }
  const clearActivity = (source: string) => {
    clearConversationActivity(state)
    logSnapshot(source)
    broadcast()
  }

  ctx.on('message', (session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
  })

  ctx.on('chatluna/before-chat', (_conversationId, message, _variables, _chatInterface, session) => {
    recordGenerating(session, message)
  })

  ctx.on('chatluna/after-chat', () => {
    clearActivity('after-chat')
  })

  ctx.on('chatluna/after-chat-error', () => {
    clearActivity('after-chat-error')
  })

  ctx.before('send', () => {
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.inject({
    console: { required: true },
  }, (inner) => {
    const console = inner.console
    if (!console) return
    console.addEntry(process.env.KOISHI_BASE ? [
      process.env.KOISHI_BASE + '/dist/index.js',
      process.env.KOISHI_BASE + '/dist/style.css',
    ] : {
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    }, () => {
      logSnapshot('entry')
      return {
        capsule: state.snapshot(),
        debug,
      }
    })
  })

  ctx.inject({
    chatluna_character: { required: true },
  }, (inner) => {
    const service = inner.chatluna_character
    if (!service) return
    const acquireResponseLock = service.acquireResponseLock
    const releaseResponseLock = service.releaseResponseLock

    // 包裹 character 响应锁以同步胶囊状态，dispose 时恢复原方法。
    service.acquireResponseLock = async (session, message) => {
      const acquired = await acquireResponseLock.call(service, session, message)
      if (acquired) {
        const input = createMessageInput(session, message)
        recordConversationActivity(state, input, `正在与 ${input.user.name || input.user.id} 对话`)
        logSnapshot('character-lock')
        broadcast()
      }
      return acquired
    }

    service.releaseResponseLock = async (session) => {
      try {
        await releaseResponseLock.call(service, session)
      } finally {
        clearActivity('character-release')
      }
    }

    ctx.on('dispose', () => {
      service.acquireResponseLock = acquireResponseLock
      service.releaseResponseLock = releaseResponseLock
    })
  })

  ctx.on('chatluna_character/message_collect', (session, messages) => {
    recordGenerating(session, messages?.at(-1))
  })
}
