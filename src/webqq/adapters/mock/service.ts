import type { OneBotRobotState } from '../../../onebot/types'
import {
  getWebQQGroupAvatar,
  getWebQQGroupSubtitle,
  getWebQQUserAvatar,
} from '../../display'
import type {
  WebQQContacts,
  WebQQForwardSendInput,
  WebQQFriendAction,
  WebQQGroupAction,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageElement,
  WebQQMessageQuery,
  WebQQMessageReaction,
  WebQQMessageReactionInput,
  WebQQMessageReactionUser,
  WebQQMessageRecallInput,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQProfile,
  WebQQProfileField,
  WebQQProfileQuery,
  WebQQRecordTranscriptionQuery,
  WebQQSelfProfileUpdate,
  WebQQSendElement,
  WebQQSendPayload,
} from '../../types'
import {
  MOCK_FRIEND_ALICE_ID,
  MOCK_FRIEND_BOB_ID,
  MOCK_GROUP_MEMBER_ID,
  cloneMockWebQQScene,
  getMockConversationKey,
  type MockWebQQScene,
} from './scene'

function summarizeElements(elements: WebQQMessageElement[]) {
  const parts = elements.map((element) => {
    if (element.type === 'text') return element.text || ''
    if (element.type === 'image') return '[图片]'
    if (element.type === 'quote') return '[引用]'
    if (element.type === 'forward') return '[合并转发]'
    if (element.type === 'card') return '[名片]'
    if (element.type === 'face') return '[表情]'
    if (element.type === 'file') return element.title ? `[文件] ${element.title}` : '[文件]'
    if (element.type === 'record') return element.duration ? `[语音] ${element.duration}"` : '[语音]'
    if (element.type === 'video') return '[视频]'
    return '[未知消息]'
  }).filter(Boolean)
  return parts.join(' ') || '[空消息]'
}

function toMessageElements(
  elements: WebQQSendElement[],
  options: {
    replyToMessageId?: string
    resolveMessage?: (messageId: string) => WebQQMessage | undefined
    resolveMentionName?: (userId: string) => string | undefined
  } = {},
): WebQQMessageElement[] {
  const next: WebQQMessageElement[] = []
  if (options.replyToMessageId) {
    const target = options.resolveMessage?.(options.replyToMessageId)
    next.push({
      type: 'quote',
      targetMessageId: options.replyToMessageId,
      ...(target?.senderName ? { title: target.senderName } : {}),
      text: target?.summary || '[引用消息]',
    })
  }
  for (const element of elements) {
    if (element.type === 'text' && element.text) {
      next.push({ type: 'text', text: element.text })
      continue
    }
    if (element.type === 'image' && element.data) {
      next.push({
        type: 'image',
        imageUrl: element.data,
        url: element.data,
      })
      continue
    }
    if (element.type === 'video' && element.data) {
      next.push({
        type: 'video',
        title: element.name || 'video',
        text: '[视频]',
        url: element.data,
      })
      continue
    }
    if (element.type === 'file' && element.data) {
      next.push({
        type: 'file',
        title: element.name || 'file',
        url: element.data,
      })
      continue
    }
    if (element.type === 'quote' && element.targetMessageId) {
      next.push({
        type: 'quote',
        targetMessageId: element.targetMessageId,
        text: element.text || `引用 ${element.targetMessageId}`,
      })
      continue
    }
    if (element.type === 'at' && element.userId) {
      next.push({
        type: 'text',
        text: `@${options.resolveMentionName?.(element.userId) || element.userId}`,
      })
      continue
    }
    if (element.type === 'face' && element.faceId) {
      next.push({
        type: 'face',
        text: element.faceId,
        emojiUrl: `https://example.com/face-${element.faceId}.png`,
      })
    }
  }
  return next
}

function pushProfileField(fields: WebQQProfileField[], group: string, label: string, value?: string) {
  if (!value) return
  fields.push({ group, label, value })
}

function rebuildProfileFields(profile: WebQQProfile): WebQQProfileField[] {
  const fields: WebQQProfileField[] = []
  pushProfileField(fields, '基础', '昵称', profile.nickname || profile.name)
  pushProfileField(fields, '基础', '备注', profile.remark)
  pushProfileField(fields, '基础', 'QQ', profile.id)
  pushProfileField(fields, '基础', '性别', profile.sex)
  if (profile.age != null) pushProfileField(fields, '基础', '年龄', String(profile.age))
  pushProfileField(fields, '基础', 'QID', profile.qid)
  pushProfileField(fields, '基础', '等级', profile.level)
  pushProfileField(fields, '基础', '签名', profile.personalNote)
  pushProfileField(fields, '群资料', '群名片', profile.groupCard)
  pushProfileField(fields, '群资料', '专属头衔', profile.groupTitle)
  pushProfileField(fields, '群资料', '身份', profile.groupRole)
  return fields
}

function touchRecent(scene: MockWebQQScene, type: 'friend' | 'group', peerId: string, summary: string, time: number) {
  const existing = scene.recent.find((item) => item.type === type && item.peerId === peerId)
  if (existing) {
    existing.summary = summary
    existing.time = time
    scene.recent = [existing, ...scene.recent.filter((item) => item !== existing)]
    return
  }
  if (type === 'friend') {
    const friend = scene.friends.find((item) => item.userId === peerId)
    scene.recent.unshift({
      type,
      peerId,
      name: friend?.name || peerId,
      subtitle: friend?.nickname || peerId,
      avatar: getWebQQUserAvatar(peerId),
      summary,
      time,
    })
    return
  }
  const group = scene.groups.find((item) => item.groupId === peerId)
  scene.recent.unshift({
    type,
    peerId,
    name: group?.name || peerId,
    subtitle: group ? getWebQQGroupSubtitle(group) : peerId,
    avatar: getWebQQGroupAvatar(peerId),
    summary,
    time,
  })
}

function ensureConversation(scene: MockWebQQScene, type: 'friend' | 'group', peerId: string) {
  const key = getMockConversationKey(type, peerId)
  if (!scene.messages[key]) scene.messages[key] = []
  return scene.messages[key]
}

function findMessage(scene: MockWebQQScene, messageId: string) {
  for (const messages of Object.values(scene.messages)) {
    const message = messages.find((item) => item.id === messageId)
    if (message) return message
  }
}

function findMessageChatType(scene: MockWebQQScene, messageId: string): WebQQMessageQuery['type'] | undefined {
  for (const [key, messages] of Object.entries(scene.messages)) {
    if (!messages.some((item) => item.id === messageId)) continue
    return key.startsWith('group:') ? 'group' : 'friend'
  }
}

function getSelectedBot(scene: MockWebQQScene) {
  return scene.bots.find((bot) => bot.selfId === scene.selectedSelfId) || scene.bots[0]
}

const mockAffinityBadges: Record<string, Pick<WebQQMessage, 'senderAffinity' | 'senderRelationship'>> = {
  [MOCK_FRIEND_ALICE_ID]: { senderAffinity: 168, senderRelationship: '友好' },
  [MOCK_FRIEND_BOB_ID]: { senderAffinity: 72, senderRelationship: '熟悉' },
  [MOCK_GROUP_MEMBER_ID]: { senderAffinity: 24, senderRelationship: '陌生' },
}

function cloneMessageForSelectedBot(scene: MockWebQQScene, message: WebQQMessage, type?: WebQQMessageQuery['type']) {
  const cloned = structuredClone(message)
  const selectedBot = getSelectedBot(scene)
  // 模拟环境切换 Bot 后必须重新计算消息方向，否则上一台 Bot 的消息仍被当作“自己发送”，会绕过群角色撤回限制。
  cloned.direction = selectedBot?.selfId === cloned.senderId ? 'outgoing' : 'incoming'

  delete cloned.senderAffinity
  delete cloned.senderRelationship
  // 好感度描述的是 Bot 与外部用户的关系；任何模拟 Bot 自身都不应显示自己的好感度或关系徽标。
  if (!scene.bots.some((bot) => bot.selfId === cloned.senderId)) {
    Object.assign(cloned, mockAffinityBadges[cloned.senderId])
  }

  if (type === 'group') {
    const member = Object.values(scene.groupMembers).flat().find((item) => item.userId === cloned.senderId)
    if (member?.role) cloned.senderRole = member.role
    else delete cloned.senderRole
  }
  return cloned
}

// 创建内存同构 WebQQ service，供开发者模拟环境与无真实 OneBot 时的 UI 验证使用。
function getMockBotCount(value: number | undefined) {
  return Math.max(0, Math.min(20, Math.floor(value ?? 0)))
}

function appendMockBotProfiles(scene: MockWebQQScene, count: number | undefined) {
  const source = scene.bots[0]
  const mockBotCount = getMockBotCount(count)
  if (!source || !mockBotCount) return
  scene.bots.push(...Array.from({ length: mockBotCount }, (_, index) => ({
    ...source,
    selfId: `${source.selfId}:mock:${index + 1}`,
    name: `${source.name} 模拟 ${index + 1}`,
  })))
}

export function createMockWebQQService(initialScene?: MockWebQQScene, options: { mockBotCount?: number } = {}) {
  const scene = cloneMockWebQQScene(initialScene)
  appendMockBotProfiles(scene, options.mockBotCount)

  const listBots = () => scene.bots.map((bot) => ({ ...bot }))

  const reconcileBotState = (): OneBotRobotState => {
    if (!scene.selectedSelfId || !scene.bots.some((bot) => bot.selfId === scene.selectedSelfId)) {
      scene.selectedSelfId = scene.bots[0]?.selfId || ''
    }
    return {
      bots: listBots(),
      ...(scene.selectedSelfId ? { selectedSelfId: scene.selectedSelfId } : {}),
    }
  }

  const appendOutgoingMessage = (payload: WebQQSendPayload, elements: WebQQMessageElement[]) => {
    const bot = getSelectedBot(scene)
    const messages = ensureConversation(scene, payload.type, payload.peerId)
    scene.nextMessageSeq += 1
    const sequence = String(scene.nextMessageSeq)
    const message: WebQQMessage = {
      id: `mock-msg-${sequence}`,
      sequence,
      time: Date.now(),
      senderId: bot?.selfId || scene.selectedSelfId || '0',
      senderName: bot?.name || '模拟机器人',
      senderAvatar: bot?.avatar || getWebQQUserAvatar(bot?.selfId || '0'),
      direction: 'outgoing',
      summary: summarizeElements(elements),
      elements,
    }
    messages.push(message)
    touchRecent(scene, payload.type, payload.peerId, message.summary, message.time)
    return message
  }

  return {
    getBotStatusDiagnostics() {
      return {
        selectedSelfId: scene.selectedSelfId,
        mockEnvironment: true,
        availableBots: scene.bots.map((bot) => ({ selfId: bot.selfId, status: bot.status })),
      }
    },

    noteBotActivity(_selfId?: string) {},

    // 模拟环境的 Bot 恒定可用，无需探测 action 通道。
    async probeBotAvailability() {
      return false
    },

    getSelectedSelfId() {
      return scene.selectedSelfId || undefined
    },

    isSelectedSelfId(selfId?: string) {
      if (!scene.selectedSelfId) return true
      return !!selfId && selfId === scene.selectedSelfId
    },

    isAvailableSelectedSelfId(selfId?: string) {
      const state = reconcileBotState()
      if (!selfId || !state.selectedSelfId) return false
      return selfId === state.selectedSelfId
    },

    reconcileBotState() {
      return reconcileBotState()
    },

    selectSelfId(selfId: string) {
      const selected = scene.bots.find((bot) => bot.selfId === selfId)
      if (!selected) throw new Error(`未找到 selfId 为 ${selfId} 的 OneBot 机器人`)
      scene.selectedSelfId = selected.selfId
      return scene.selectedSelfId
    },

    listBots() {
      return listBots()
    },

    async resolveQuote(id: string) {
      return scene.quotes[id] || findMessage(scene, id)?.elements.find((element) => element.type === 'quote') || {
        type: 'quote' as const,
        targetMessageId: id,
        text: `引用 ${id}`,
      }
    },

    async resolveForward(id: string) {
      return scene.forwards[id] || findMessage(scene, id)?.elements.find((element) => element.type === 'forward') || {
        type: 'forward' as const,
        title: `转发 ${id}`,
        items: [],
      }
    },

    async resolveMessage(id: string, _selfId?: string) {
      const message = findMessage(scene, id)
      if (!message) throw new Error(`未找到消息 ${id}`)
      return cloneMessageForSelectedBot(scene, message, findMessageChatType(scene, id))
    },

    supportsReactionUsers(_selfId?: string) {
      return true
    },

    async loadReactionUsers(messageId: string, emojiId: string, count: number, _selfId?: string): Promise<WebQQMessageReactionUser[]> {
      const message = findMessage(scene, messageId)
      const reaction = message?.reactions?.find((item) => item.emojiId === emojiId)
      return structuredClone((reaction?.users || []).slice(0, count))
    },

    async resolveImage(file: string) {
      const url = scene.images[file] || file
      return {
        url,
        debug: {
          url,
          file,
        },
      }
    },

    async resolveRecord(file: string) {
      const record = scene.records[file]
      const url = record?.url || file
      return {
        url,
        debug: {
          url,
          file,
        },
        ...(record?.duration != null ? { duration: record.duration } : {}),
        ...(record?.transcript ? { transcript: record.transcript } : {}),
      }
    },

    async transcribeRecord(messageId: WebQQRecordTranscriptionQuery['messageId']) {
      const message = findMessage(scene, messageId)
      const record = message?.elements.find((element) => element.type === 'record')
      if (record?.transcript) return record.transcript
      const matched = Object.values(scene.records).find((item) => item.url === record?.url)
      return matched?.transcript || '模拟语音转写结果'
    },

    async loadContacts(): Promise<WebQQContacts> {
      return {
        friends: structuredClone(scene.friends),
        groups: structuredClone(scene.groups),
        mockEnvironment: true,
        friendCategories: structuredClone(scene.friendCategories),
        recent: structuredClone(scene.recent),
      }
    },

    async loadMessages(query: WebQQMessageQuery): Promise<WebQQMessage[]> {
      const messages = ensureConversation(scene, query.type, query.peerId)
      const limit = query.limit ?? 30
      let filtered = messages
      if (query.beforeSequence) {
        const index = messages.findIndex((item) => item.sequence === query.beforeSequence)
        filtered = index >= 0 ? messages.slice(0, index) : messages
      }
      return filtered
        .slice(Math.max(0, filtered.length - limit))
        .map((message) => cloneMessageForSelectedBot(scene, message, query.type))
    },

    async sendMessage(payload: WebQQSendPayload) {
      const elements = toMessageElements(payload.elements, {
        replyToMessageId: payload.replyToMessageId,
        resolveMessage: (messageId) => findMessage(scene, messageId),
        resolveMentionName: (userId) => {
          const member = payload.type === 'group'
            ? scene.groupMembers[payload.peerId]?.find((item) => item.userId === userId)
            : undefined
          return member?.card || member?.nickname || scene.profiles[userId]?.name || userId
        },
      })
      if (!elements.length) return
      appendOutgoingMessage(payload, elements)
    },

    async recallMessage(input: WebQQMessageRecallInput) {
      if (!input.messageId) throw new Error('messageId 不能为空')
      const messages = ensureConversation(scene, input.type, input.peerId)
      const message = messages.find((item) => item.id === input.messageId)
      if (!message) throw new Error(`未找到消息 ${input.messageId}`)
      message.recalled = true
    },

    async setMessageReaction(input: WebQQMessageReactionInput) {
      if (!input.messageId) throw new Error('messageId 不能为空')
      if (!input.emojiId) throw new Error('emojiId 不能为空')
      const messages = ensureConversation(scene, input.type, input.peerId)
      const message = messages.find((item) => item.id === input.messageId)
      if (!message) throw new Error(`未找到消息 ${input.messageId}`)
      const bot = getSelectedBot(scene)
      const reactions = message.reactions ? [...message.reactions] : []
      const existingIndex = reactions.findIndex((item) => item.emojiId === input.emojiId)
      const existing = existingIndex >= 0 ? reactions[existingIndex] : undefined
      const selfUser: WebQQMessageReactionUser = {
        userId: bot?.selfId || scene.selectedSelfId || '0',
        userName: bot?.name || '模拟机器人',
        userAvatar: bot?.avatar || getWebQQUserAvatar(bot?.selfId || '0'),
      }

      if (input.enabled) {
        if (existing) {
          const users = existing.users ? [...existing.users] : []
          if (!users.some((user) => user.userId === selfUser.userId)) users.push(selfUser)
          reactions[existingIndex] = {
            ...existing,
            count: Math.max(existing.count, users.length),
            users,
            userId: existing.userId || selfUser.userId,
            userAvatar: existing.userAvatar || selfUser.userAvatar,
          }
        } else {
          const reaction: WebQQMessageReaction = {
            emojiId: input.emojiId,
            label: input.emojiId,
            emojiUrl: `https://example.com/face-${input.emojiId}.png`,
            count: 1,
            userId: selfUser.userId,
            userAvatar: selfUser.userAvatar,
            users: [selfUser],
          }
          reactions.push(reaction)
        }
      } else if (existing) {
        const users = (existing.users || []).filter((user) => user.userId !== selfUser.userId)
        if (!users.length) {
          reactions.splice(existingIndex, 1)
        } else {
          reactions[existingIndex] = {
            ...existing,
            count: users.length,
            users,
            userId: users[0]?.userId,
            userAvatar: users[0]?.userAvatar,
          }
        }
      }
      message.reactions = reactions.length ? reactions : undefined
    },

    async loadProfile(query: WebQQProfileQuery): Promise<WebQQProfile> {
      if (!query.userId) throw new Error('userId 不能为空')
      const bot = getSelectedBot(scene)
      const isSelf = !!bot?.selfId && query.userId === bot.selfId
      const base = scene.profiles[query.userId]
      const friend = scene.friends.find((item) => item.userId === query.userId)
      const member = query.groupId
        ? scene.groupMembers[query.groupId]?.find((item) => item.userId === query.userId)
        : undefined

      const profile: WebQQProfile = {
        kind: isSelf ? 'bot' : 'user',
        id: query.userId,
        name: base?.name || friend?.name || member?.nickname || query.userId,
        avatar: base?.avatar || getWebQQUserAvatar(query.userId),
        nickname: base?.nickname || friend?.nickname || member?.nickname || query.userId,
        ...(base?.remark || friend?.name ? { remark: base?.remark || friend?.name } : {}),
        ...(base?.personalNote ? { personalNote: base.personalNote } : {}),
        ...(base?.sex ? { sex: base.sex } : {}),
        ...(base?.age != null ? { age: base.age } : {}),
        ...(base?.qid ? { qid: base.qid } : {}),
        ...(base?.level ? { level: base.level } : {}),
        ...(query.groupId ? { groupId: query.groupId } : {}),
        ...(member?.card || base?.groupCard ? { groupCard: member?.card || base?.groupCard } : {}),
        ...(base?.groupTitle || member?.role === '群主' ? { groupTitle: base?.groupTitle || (member?.role === '群主' ? '群主' : undefined) } : {}),
        ...(member?.role || base?.groupRole ? { groupRole: member?.role || base?.groupRole } : {}),
        ...(member?.rawRole || base?.rawRole ? { rawRole: member?.rawRole || base?.rawRole } : {}),
        fields: [],
        ...(isSelf ? { canEditSelf: true, canEditAvatar: true } : {}),
      }
      profile.fields = rebuildProfileFields(profile)
      scene.profiles[query.userId] = profile
      return structuredClone(profile)
    },

    async updateSelfProfile(input: WebQQSelfProfileUpdate) {
      const bot = getSelectedBot(scene)
      if (!bot) throw new Error('当前没有可用的模拟机器人')
      const profile = scene.profiles[bot.selfId] || {
        kind: 'bot' as const,
        id: bot.selfId,
        name: bot.name,
        avatar: bot.avatar || getWebQQUserAvatar(bot.selfId),
        nickname: bot.name,
        fields: [],
        canEditSelf: true,
        canEditAvatar: true,
      }

      const avatar = input.avatar?.trim()
      const nickname = input.nickname?.trim()
      const personalNote = input.personalNote
      const sex = input.sex
      if (!avatar && !nickname && personalNote == null && sex == null) {
        throw new Error('至少提供 nickname、personalNote、sex 或 avatar 之一')
      }

      if (avatar) {
        profile.avatar = avatar
        bot.avatar = avatar
      }
      if (nickname) {
        profile.nickname = nickname
        profile.name = nickname
        bot.name = nickname
      }
      if (personalNote != null) profile.personalNote = personalNote
      if (sex != null) profile.sex = sex
      profile.fields = rebuildProfileFields(profile)
      scene.profiles[bot.selfId] = profile
    },

    async performFriendAction(input: WebQQFriendAction) {
      if (!input.targetId) throw new Error('targetId 不能为空')
      if (input.action === 'delete') {
        scene.friends = scene.friends.filter((friend) => friend.userId !== input.targetId)
        scene.friendCategories = scene.friendCategories.map((category) => ({
          ...category,
          friends: category.friends.filter((friend) => friend.userId !== input.targetId),
        }))
        scene.recent = scene.recent.filter((item) => !(item.type === 'friend' && item.peerId === input.targetId))
        delete scene.messages[getMockConversationKey('friend', input.targetId)]
        return
      }
      if (input.action === 'set-remark') {
        const remark = input.remark ?? ''
        scene.friends = scene.friends.map((friend) => (
          friend.userId === input.targetId
            ? { ...friend, name: remark || friend.nickname || friend.userId }
            : friend
        ))
        scene.friendCategories = scene.friendCategories.map((category) => ({
          ...category,
          friends: category.friends.map((friend) => (
            friend.userId === input.targetId
              ? { ...friend, name: remark || friend.nickname || friend.userId }
              : friend
          )),
        }))
        const profile = scene.profiles[input.targetId]
        if (profile) {
          profile.remark = remark
          profile.name = remark || profile.nickname || profile.id
          profile.fields = rebuildProfileFields(profile)
        }
        const recent = scene.recent.find((item) => item.type === 'friend' && item.peerId === input.targetId)
        if (recent) recent.name = remark || recent.name
        return
      }
      if (input.action === 'poke') {
        // 戳一戳只是瞬时动作，模拟环境无需持久化。
        return
      }
      throw new Error(`不支持的好友动作：${(input as WebQQFriendAction).action}`)
    },

    async performGroupAction(input: WebQQGroupAction) {
      if (!input.groupId) throw new Error('groupId 不能为空')
      const group = scene.groups.find((item) => item.groupId === input.groupId)
      const members = scene.groupMembers[input.groupId] || []

      if (input.action === 'kick') {
        if (!input.targetId) throw new Error('targetId 不能为空')
        scene.groupMembers[input.groupId] = members.filter((member) => member.userId !== input.targetId)
        if (group) group.memberCount = Math.max(0, scene.groupMembers[input.groupId].length)
        return
      }
      if (input.action === 'set-admin') {
        if (!input.targetId) throw new Error('targetId 不能为空')
        scene.groupMembers[input.groupId] = members.map((member) => (
          member.userId === input.targetId
            ? { ...member, role: input.enabled ? '管理员' : '成员' }
            : member
        ))
        return
      }
      if (input.action === 'set-card') {
        if (!input.targetId) throw new Error('targetId 不能为空')
        scene.groupMembers[input.groupId] = members.map((member) => (
          member.userId === input.targetId
            ? { ...member, card: input.card ?? '' }
            : member
        ))
        const profile = scene.profiles[input.targetId]
        if (profile && profile.groupId === input.groupId) {
          profile.groupCard = input.card ?? ''
          profile.fields = rebuildProfileFields(profile)
        }
        return
      }
      if (input.action === 'set-title') {
        if (!input.targetId) throw new Error('targetId 不能为空')
        scene.groupMembers[input.groupId] = members.map((member) => (
          member.userId === input.targetId
            ? { ...member, title: input.title ?? '' }
            : member
        ))
        const profile = scene.profiles[input.targetId]
        if (profile) {
          profile.groupTitle = input.title ?? ''
          profile.fields = rebuildProfileFields(profile)
        }
        return
      }
      if (input.action === 'set-name') {
        if (group) group.name = input.name ?? ''
        const recent = scene.recent.find((item) => item.type === 'group' && item.peerId === input.groupId)
        if (recent) recent.name = input.name ?? recent.name
        return
      }
      if (input.action === 'leave') {
        scene.groups = scene.groups.filter((item) => item.groupId !== input.groupId)
        scene.recent = scene.recent.filter((item) => !(item.type === 'group' && item.peerId === input.groupId))
        delete scene.groupMembers[input.groupId]
        delete scene.groupAnnouncements[input.groupId]
        delete scene.messages[getMockConversationKey('group', input.groupId)]
        return
      }
      if (input.action === 'poke') {
        if (!input.targetId) throw new Error('targetId 不能为空')
        return
      }
      throw new Error(`不支持的群动作：${(input as WebQQGroupAction).action}`)
    },

    async sendForward(input: WebQQForwardSendInput) {
      if (!input.peerId) throw new Error('peerId 不能为空')
      if (!input.messageIds?.length) throw new Error('messageIds 不能为空')
      const items = input.messageIds.map((messageId) => {
        const message = findMessage(scene, messageId)
        return {
          title: message?.senderName || messageId,
          senderId: message?.senderId,
          senderAvatar: message?.senderAvatar,
          elements: message ? structuredClone(message.elements) : [{ type: 'text' as const, text: `消息 ${messageId}` }],
        }
      })
      appendOutgoingMessage({
        type: input.type,
        peerId: input.peerId,
        elements: [],
      }, [{
        type: 'forward',
        title: `${items.length} 条转发消息`,
        items,
      }])
    },

    async loadGroupInfo(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo> {
      return {
        announcements: structuredClone(scene.groupAnnouncements[query.groupId] || []),
        members: structuredClone(scene.groupMembers[query.groupId] || []),
      }
    },

    async loadNotices(friendRequests: WebQQNotice[] = []): Promise<WebQQNotice[]> {
      const pending = scene.notices.filter((notice) => notice.status === 'pending')
      const external = friendRequests.filter((notice) => !pending.some((item) => item.id === notice.id))
      return structuredClone([...external, ...pending])
    },

    async handleNotice(action: WebQQNoticeAction) {
      const notice = scene.notices.find((item) => item.id === action.id || item.flag === action.flag)
      if (!notice) return
      notice.status = action.approve ? 'approved' : 'rejected'
      if (action.approve && notice.type === 'friend-request' && notice.requesterId) {
        if (!scene.friends.some((friend) => friend.userId === notice.requesterId)) {
          const friend = {
            userId: notice.requesterId,
            name: notice.requesterName || notice.requesterId,
            nickname: notice.requesterName || notice.requesterId,
            avatar: getWebQQUserAvatar(notice.requesterId),
            categoryId: '1',
            categoryName: '好友',
          }
          scene.friends.push(friend)
          const category = scene.friendCategories[0]
          if (category) category.friends.push(structuredClone(friend))
        }
      }
    },

    /** 测试与调试可读取当前内存场景快照。 */
    getSceneSnapshot() {
      return structuredClone(scene)
    },
  }
}

export type MockWebQQService = ReturnType<typeof createMockWebQQService>
