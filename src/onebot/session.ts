import type { Session } from 'koishi'

export function isVisibleBotSession(session?: Session) {
  return !session || session.bot.hidden !== true
}
