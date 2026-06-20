import type { WebQQProtocol } from './protocol'

export type { WebQQProtocol } from './protocol'

export interface OneBotRobotProfile {
  platform: string
  selfId: string
  status?: number
  name: string
  avatar?: string
}

export interface OneBotRobotState {
  bots: OneBotRobotProfile[]
  selectedSelfId?: string
}

export interface OneBotWebQQOptions {
  selfId?: string
  selfIds?: string[]
  mockBotCount?: number
  protocol?: WebQQProtocol
  imageUrlResolver?: (file: string) => string
}
