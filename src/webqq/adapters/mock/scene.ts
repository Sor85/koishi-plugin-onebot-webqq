import type { OneBotRobotProfile } from '../../../onebot/types'
import {
  getWebQQGroupAvatar,
  getWebQQGroupSubtitle,
  getWebQQUserAvatar,
} from '../../display'
import type {
  WebQQFriend,
  WebQQFriendCategory,
  WebQQGroup,
  WebQQGroupAnnouncement,
  WebQQGroupMember,
  WebQQMessage,
  WebQQMessageElement,
  WebQQMessageReaction,
  WebQQNotice,
  WebQQProfile,
  WebQQRecentContact,
} from '../../types'

export const MOCK_SELF_ID = '10001'
export const MOCK_SECOND_SELF_ID = '10002'
export const MOCK_FRIEND_ALICE_ID = '20001'
export const MOCK_FRIEND_BOB_ID = '20002'
export const MOCK_GROUP_ID = '30001'
export const MOCK_GROUP_MEMBER_ID = '20003'

const now = 1_700_000_000_000

function clone<T>(value: T): T {
  return structuredClone(value)
}

function createMessage(input: {
  id: string
  sequence: string
  time: number
  senderId: string
  senderName: string
  direction: WebQQMessage['direction']
  elements: WebQQMessageElement[]
  summary: string
  senderRole?: string
  senderLevel?: string
  senderTitle?: string
  reactions?: WebQQMessageReaction[]
  recalled?: boolean
}): WebQQMessage {
  return {
    id: input.id,
    sequence: input.sequence,
    time: input.time,
    senderId: input.senderId,
    senderName: input.senderName,
    senderAvatar: getWebQQUserAvatar(input.senderId),
    ...(input.senderRole ? { senderRole: input.senderRole } : {}),
    ...(input.senderLevel ? { senderLevel: input.senderLevel } : {}),
    ...(input.senderTitle ? { senderTitle: input.senderTitle } : {}),
    direction: input.direction,
    summary: input.summary,
    ...(input.recalled ? { recalled: true } : {}),
    ...(input.reactions?.length ? { reactions: input.reactions } : {}),
    elements: input.elements,
  }
}

export interface MockWebQQScene {
  bots: OneBotRobotProfile[]
  selectedSelfId: string
  friends: WebQQFriend[]
  friendCategories: WebQQFriendCategory[]
  groups: WebQQGroup[]
  recent: WebQQRecentContact[]
  groupMembers: Record<string, WebQQGroupMember[]>
  groupAnnouncements: Record<string, WebQQGroupAnnouncement[]>
  notices: WebQQNotice[]
  messages: Record<string, WebQQMessage[]>
  profiles: Record<string, WebQQProfile>
  forwards: Record<string, WebQQMessageElement>
  quotes: Record<string, WebQQMessageElement>
  records: Record<string, { url: string; duration?: number; transcript?: string }>
  images: Record<string, string>
  nextMessageSeq: number
}

function conversationKey(type: 'friend' | 'group', peerId: string) {
  return `${type}:${peerId}`
}

export function createMockWebQQScene(): MockWebQQScene {
  const bots: OneBotRobotProfile[] = [
    {
      platform: 'onebot',
      selfId: MOCK_SELF_ID,
      status: 1,
      name: '模拟机器人',
      avatar: getWebQQUserAvatar(MOCK_SELF_ID),
    },
    {
      platform: 'onebot',
      selfId: MOCK_SECOND_SELF_ID,
      status: 1,
      name: '备用机器人',
      avatar: getWebQQUserAvatar(MOCK_SECOND_SELF_ID),
    },
  ]

  const friends: WebQQFriend[] = [
    {
      userId: MOCK_FRIEND_ALICE_ID,
      name: 'Alice',
      nickname: 'Alice',
      avatar: getWebQQUserAvatar(MOCK_FRIEND_ALICE_ID),
      categoryId: '1',
      categoryName: '好友',
    },
    {
      userId: MOCK_FRIEND_BOB_ID,
      name: 'Bob',
      nickname: 'Bob',
      avatar: getWebQQUserAvatar(MOCK_FRIEND_BOB_ID),
      categoryId: '1',
      categoryName: '好友',
    },
  ]

  const friendCategories: WebQQFriendCategory[] = [
    {
      id: '1',
      name: '好友',
      friends: clone(friends),
    },
  ]

  const groups: WebQQGroup[] = [
    {
      groupId: MOCK_GROUP_ID,
      name: '模拟开发群',
      memberCount: 5,
      avatar: getWebQQGroupAvatar(MOCK_GROUP_ID),
    },
  ]

  const groupMembers: Record<string, WebQQGroupMember[]> = {
    [MOCK_GROUP_ID]: [
      {
        userId: MOCK_SELF_ID,
        nickname: '模拟机器人',
        card: '机器人',
        avatar: getWebQQUserAvatar(MOCK_SELF_ID),
        role: '群主',
        rawRole: 'owner',
      },
      {
        userId: MOCK_SECOND_SELF_ID,
        nickname: '备用机器人',
        card: '管理员机器人',
        avatar: getWebQQUserAvatar(MOCK_SECOND_SELF_ID),
        role: '管理员',
        rawRole: 'admin',
      },
      {
        userId: MOCK_FRIEND_ALICE_ID,
        nickname: 'Alice',
        card: 'Alice',
        avatar: getWebQQUserAvatar(MOCK_FRIEND_ALICE_ID),
        role: '管理员',
        rawRole: 'admin',
      },
      {
        userId: MOCK_FRIEND_BOB_ID,
        nickname: 'Bob',
        card: 'Bob',
        avatar: getWebQQUserAvatar(MOCK_FRIEND_BOB_ID),
        role: '成员',
        rawRole: 'member',
      },
      {
        userId: MOCK_GROUP_MEMBER_ID,
        nickname: 'Carol',
        card: 'Carol',
        avatar: getWebQQUserAvatar(MOCK_GROUP_MEMBER_ID),
        role: '成员',
        rawRole: 'member',
      },
    ],
  }

  const groupAnnouncements: Record<string, WebQQGroupAnnouncement[]> = {
    [MOCK_GROUP_ID]: [
      {
        id: 'notice-1',
        title: '群公告',
        content: '欢迎使用 WebQQ 开发者模拟环境',
        time: now - 86_400_000,
      },
    ],
  }

  const notices: WebQQNotice[] = [
    {
      id: 'friend-request-1',
      type: 'friend-request',
      title: '好友请求',
      subtitle: 'Dave 请求添加你为好友',
      avatar: getWebQQUserAvatar('20004'),
      status: 'pending',
      time: now - 3_600_000,
      flag: 'friend-flag-1',
      requesterId: '20004',
      requesterName: 'Dave',
      comment: '我是 Dave',
    },
    {
      id: 'group-notice-1',
      type: 'group-notice',
      title: '加群申请',
      subtitle: 'Eve 申请加入 模拟开发群',
      avatar: getWebQQUserAvatar('20005'),
      status: 'pending',
      time: now - 1_800_000,
      flag: 'group-flag-1',
      subType: 'add',
      requesterId: '20005',
      requesterName: 'Eve',
      groupId: MOCK_GROUP_ID,
      groupName: '模拟开发群',
      comment: '想一起开发',
    },
  ]

  const quoteElement: WebQQMessageElement = {
    type: 'quote',
    targetMessageId: 'friend-msg-1',
    title: 'Alice',
    text: '你好，这是引用原文',
  }

  const forwardElement: WebQQMessageElement = {
    type: 'forward',
    title: '3 条转发消息',
    items: [
      {
        title: 'Alice',
        senderId: MOCK_FRIEND_ALICE_ID,
        senderAvatar: getWebQQUserAvatar(MOCK_FRIEND_ALICE_ID),
        elements: [{ type: 'text', text: '第一条转发' }],
      },
      {
        title: 'Bob',
        senderId: MOCK_FRIEND_BOB_ID,
        senderAvatar: getWebQQUserAvatar(MOCK_FRIEND_BOB_ID),
        elements: [{ type: 'image', imageUrl: 'https://example.com/forward-image.png', url: 'https://example.com/forward-image.png' }],
      },
      {
        title: '模拟机器人',
        senderId: MOCK_SELF_ID,
        senderAvatar: getWebQQUserAvatar(MOCK_SELF_ID),
        elements: [{ type: 'text', text: '第三条转发' }],
      },
    ],
  }

  const friendMessages: WebQQMessage[] = [
    createMessage({
      id: 'friend-msg-1',
      sequence: '1',
      time: now - 120_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      direction: 'incoming',
      summary: '你好，这是一条文本消息',
      elements: [{ type: 'text', text: '你好，这是一条文本消息' }],
    }),
    createMessage({
      id: 'friend-msg-2',
      sequence: '2',
      time: now - 110_000,
      senderId: MOCK_SELF_ID,
      senderName: '模拟机器人',
      direction: 'outgoing',
      summary: '[图片]',
      elements: [{
        type: 'image',
        imageUrl: 'https://example.com/friend-image.png',
        url: 'https://example.com/friend-image.png',
      }],
    }),
    createMessage({
      id: 'friend-msg-3',
      sequence: '3',
      time: now - 100_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      direction: 'incoming',
      summary: '[引用] 收到',
      elements: [
        clone(quoteElement),
        { type: 'text', text: '收到' },
      ],
    }),
    createMessage({
      id: 'friend-msg-4',
      sequence: '4',
      time: now - 90_000,
      senderId: MOCK_SELF_ID,
      senderName: '模拟机器人',
      direction: 'outgoing',
      summary: '[合并转发]',
      elements: [clone(forwardElement)],
    }),
    createMessage({
      id: 'friend-msg-5',
      sequence: '5',
      time: now - 80_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      direction: 'incoming',
      summary: '[名片]',
      elements: [{
        type: 'card',
        title: 'Alice 的名片',
        text: 'user:20001',
        source: 'friend',
      }],
    }),
    createMessage({
      id: 'friend-msg-6',
      sequence: '6',
      time: now - 70_000,
      senderId: MOCK_SELF_ID,
      senderName: '模拟机器人',
      direction: 'outgoing',
      summary: '[表情]',
      elements: [{
        type: 'face',
        text: '微笑',
        emojiUrl: 'https://example.com/face-76.png',
      }],
    }),
    createMessage({
      id: 'friend-msg-7',
      sequence: '7',
      time: now - 60_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      direction: 'incoming',
      summary: '[文件] notes.txt',
      elements: [{
        type: 'file',
        title: 'notes.txt',
        url: 'https://example.com/notes.txt',
      }],
    }),
    createMessage({
      id: 'friend-msg-8',
      sequence: '8',
      time: now - 50_000,
      senderId: MOCK_SELF_ID,
      senderName: '模拟机器人',
      direction: 'outgoing',
      summary: '[语音] 3"',
      elements: [{
        type: 'record',
        duration: 3,
        url: 'https://example.com/record.silk',
        transcript: '这是一段模拟语音',
      }],
    }),
    createMessage({
      id: 'friend-msg-9',
      sequence: '9',
      time: now - 40_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      direction: 'incoming',
      summary: '[视频]',
      elements: [{
        type: 'video',
        title: 'demo.mp4',
        url: 'https://example.com/demo.mp4',
      }],
    }),
    createMessage({
      id: 'friend-msg-10',
      sequence: '10',
      time: now - 30_000,
      senderId: MOCK_SELF_ID,
      senderName: '模拟机器人',
      direction: 'outgoing',
      summary: '[未知消息]',
      elements: [{
        type: 'unknown',
        text: 'unsupported segment',
      }],
    }),
    createMessage({
      id: 'friend-msg-11',
      sequence: '11',
      time: now - 20_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      direction: 'incoming',
      summary: '这条消息已被撤回',
      recalled: true,
      elements: [{ type: 'text', text: '这条消息已被撤回' }],
    }),
  ]

  const groupMessages: WebQQMessage[] = [
    createMessage({
      id: 'group-msg-1',
      sequence: '101',
      time: now - 200_000,
      senderId: MOCK_FRIEND_ALICE_ID,
      senderName: 'Alice',
      senderRole: '管理员',
      senderLevel: '88',
      senderTitle: '开发者',
      direction: 'incoming',
      summary: '欢迎来到模拟开发群',
      elements: [{ type: 'text', text: '欢迎来到模拟开发群' }],
      reactions: [{
        emojiId: '76',
        label: '微笑',
        emojiUrl: 'https://example.com/face-76.png',
        count: 2,
        userId: MOCK_FRIEND_BOB_ID,
        userAvatar: getWebQQUserAvatar(MOCK_FRIEND_BOB_ID),
        users: [
          {
            userId: MOCK_FRIEND_BOB_ID,
            userName: 'Bob',
            userAvatar: getWebQQUserAvatar(MOCK_FRIEND_BOB_ID),
          },
          {
            userId: MOCK_GROUP_MEMBER_ID,
            userName: 'Carol',
            userAvatar: getWebQQUserAvatar(MOCK_GROUP_MEMBER_ID),
          },
        ],
      }],
    }),
    createMessage({
      id: 'group-msg-2',
      sequence: '102',
      time: now - 180_000,
      senderId: MOCK_SELF_ID,
      senderName: '模拟机器人',
      senderRole: '群主',
      direction: 'outgoing',
      summary: '已收到，准备开始测试',
      elements: [{ type: 'text', text: '已收到，准备开始测试' }],
    }),
    createMessage({
      id: 'group-msg-3',
      sequence: '103',
      time: now - 160_000,
      senderId: MOCK_FRIEND_BOB_ID,
      senderName: 'Bob',
      direction: 'incoming',
      summary: '[图片]',
      elements: [{
        type: 'image',
        imageUrl: 'https://example.com/group-image.png',
        url: 'https://example.com/group-image.png',
      }],
    }),
    createMessage({
      id: 'group-msg-4',
      sequence: '104',
      time: now - 140_000,
      senderId: MOCK_SECOND_SELF_ID,
      senderName: '备用机器人',
      senderRole: '管理员',
      direction: 'incoming',
      summary: '管理员权限测试消息',
      elements: [{ type: 'text', text: '管理员权限测试消息' }],
    }),
  ]

  const recent: WebQQRecentContact[] = [
    {
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      name: 'Alice',
      subtitle: 'Alice',
      avatar: getWebQQUserAvatar(MOCK_FRIEND_ALICE_ID),
      summary: friendMessages[friendMessages.length - 1]?.summary || '',
      time: friendMessages[friendMessages.length - 1]?.time || now,
    },
    {
      type: 'group',
      peerId: MOCK_GROUP_ID,
      name: '模拟开发群',
      subtitle: getWebQQGroupSubtitle(groups[0]),
      avatar: getWebQQGroupAvatar(MOCK_GROUP_ID),
      summary: groupMessages[groupMessages.length - 1]?.summary || '',
      time: groupMessages[groupMessages.length - 1]?.time || now,
    },
    {
      type: 'friend',
      peerId: MOCK_FRIEND_BOB_ID,
      name: 'Bob',
      subtitle: 'Bob',
      avatar: getWebQQUserAvatar(MOCK_FRIEND_BOB_ID),
      summary: '你好 Bob',
      time: now - 300_000,
    },
  ]

  const profiles: Record<string, WebQQProfile> = {
    [MOCK_SELF_ID]: {
      kind: 'bot',
      id: MOCK_SELF_ID,
      name: '模拟机器人',
      avatar: getWebQQUserAvatar(MOCK_SELF_ID),
      nickname: '模拟机器人',
      personalNote: '开发者模拟环境',
      sex: 'unknown',
      age: 1,
      qid: 'mock-bot',
      level: '100',
      fields: [
        { group: '基础', label: '昵称', value: '模拟机器人' },
        { group: '基础', label: 'QQ', value: MOCK_SELF_ID },
        { group: '基础', label: '签名', value: '开发者模拟环境' },
      ],
      canEditSelf: true,
      canEditAvatar: true,
    },
    [MOCK_FRIEND_ALICE_ID]: {
      kind: 'user',
      id: MOCK_FRIEND_ALICE_ID,
      name: 'Alice',
      avatar: getWebQQUserAvatar(MOCK_FRIEND_ALICE_ID),
      nickname: 'Alice',
      remark: '好友 Alice',
      personalNote: 'hello alice',
      sex: 'female',
      age: 18,
      qid: 'alice-qid',
      level: '66',
      groupId: MOCK_GROUP_ID,
      groupCard: 'Alice',
      groupTitle: '开发者',
      groupRole: '管理员',
      rawRole: 'admin',
      fields: [
        { group: '基础', label: '昵称', value: 'Alice' },
        { group: '基础', label: '备注', value: '好友 Alice' },
        { group: '基础', label: 'QQ', value: MOCK_FRIEND_ALICE_ID },
        { group: '群资料', label: '群名片', value: 'Alice' },
        { group: '群资料', label: '身份', value: '群主' },
      ],
    },
  }

  return {
    bots,
    selectedSelfId: MOCK_SELF_ID,
    friends,
    friendCategories,
    groups,
    recent,
    groupMembers,
    groupAnnouncements,
    notices,
    messages: {
      [conversationKey('friend', MOCK_FRIEND_ALICE_ID)]: friendMessages,
      [conversationKey('friend', MOCK_FRIEND_BOB_ID)]: [
        createMessage({
          id: 'bob-msg-1',
          sequence: '1',
          time: now - 300_000,
          senderId: MOCK_SELF_ID,
          senderName: '模拟机器人',
          direction: 'outgoing',
          summary: '你好 Bob',
          elements: [{ type: 'text', text: '你好 Bob' }],
        }),
      ],
      [conversationKey('group', MOCK_GROUP_ID)]: groupMessages,
    },
    profiles,
    forwards: {
      'forward-1': clone(forwardElement),
    },
    quotes: {
      'friend-msg-1': clone(quoteElement),
    },
    records: {
      'record.silk': {
        url: 'https://example.com/record.silk',
        duration: 3,
        transcript: '这是一段模拟语音',
      },
    },
    images: {
      'friend-image.png': 'https://example.com/friend-image.png',
      'group-image.png': 'https://example.com/group-image.png',
    },
    nextMessageSeq: 1000,
  }
}

export function getMockConversationKey(type: 'friend' | 'group', peerId: string) {
  return conversationKey(type, peerId)
}

export function cloneMockWebQQScene(scene = createMockWebQQScene()): MockWebQQScene {
  return clone(scene)
}
