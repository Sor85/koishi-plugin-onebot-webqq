import type { Session } from 'koishi'
import Schema from 'schemastery'
import { resolve } from 'path'
import type { Entry } from '@koishijs/console'
import {
  CapsuleSnapshot,
  createCapsuleState,
  recordIncomingMessage,
  recordOutgoingMessage,
} from './state'

export const name = 'chat-capsule'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console'],
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

// 描述插件运行所需的最小 Koishi 上下文能力。
export interface ChatCapsuleContext {
  console?: ConsoleService
  logger?(name: string): DebugLogger
  on(event: 'message', listener: (session: Session) => void): unknown
  before(event: 'send', listener: () => void): unknown
  inject(services: { console: { required: true } }, callback: (inner: ChatCapsuleContext & { console: ConsoleService }) => void): unknown
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

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: Config = {}) {
  const state = createCapsuleState()
  const debug = !!config.debug
  const logger = debug ? ctx.logger?.('chat-capsule') : undefined
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => ctx.console?.broadcast('chat-capsule/update', state.snapshot())

  ctx.on('message', (session) => {
    recordIncomingMessage(state, {
      bot: readBotProfile(session),
      channel: {
        id: session.channelId || session.event.channel?.id || 'unknown',
        name: readChannelName(session),
      },
      user: {
        id: session.userId || session.event.user?.id || 'unknown',
        name: readUserName(session),
      },
      timestamp: session.timestamp,
    })
    logSnapshot('message')
    broadcast()
  })

  ctx.before('send', () => {
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.inject({
    console: { required: true },
  }, (inner) => {
    inner.console.addEntry(process.env.KOISHI_BASE ? [
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
}
