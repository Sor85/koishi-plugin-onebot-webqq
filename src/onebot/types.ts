// WebQQ 只读面板支持的 OneBot 实现协议。
export type WebQQProtocol = 'napcat' | 'llbot'

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

export type {
  WebQQChatType,
  WebQQContacts,
  WebQQForwardItem,
  WebQQFriend,
  WebQQFriendCategory,
  WebQQGroup,
  WebQQGroupAnnouncement,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQGroupMember,
  WebQQLiveMessage,
  WebQQMessage,
  WebQQMessageElement,
  WebQQMessageQuery,
  WebQQMessageReaction,
  WebQQMessageReactionUser,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQRecallPayload,
  WebQQRecordTranscriptionQuery,
  WebQQRecentContact,
} from '../webqq/types'
