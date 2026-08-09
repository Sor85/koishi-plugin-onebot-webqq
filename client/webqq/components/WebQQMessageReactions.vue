<template>
  <div class="onebot-webqq-webqq__message-reactions">
    <component
      :is="readonly ? 'span' : 'button'"
      v-for="reaction in reactions"
      :key="reaction.emojiId"
      class="onebot-webqq-webqq__message-reaction"
      :class="{ 'is-interactive': !readonly }"
      :type="readonly ? undefined : 'button'"
      :disabled="readonly ? undefined : false"
      @click.stop="!readonly && emit('toggle', reaction.emojiId)"
    >
      <img
        v-if="getFace(reaction.emojiId)?.url"
        class="onebot-webqq-webqq__message-reaction-emoji"
        :src="withProxy(getFace(reaction.emojiId)!.url)"
        :alt="getFace(reaction.emojiId)!.label"
      >
      <template v-else>{{ getFace(reaction.emojiId)?.label ?? reaction.label ?? reaction.emojiId }}</template>
      <span v-if="shouldShowReactionUsers(reaction)" class="onebot-webqq-webqq__message-reaction-users">
        <span
          v-for="(user, userIndex) in getVisibleReactionUsers(reaction)"
          :key="user.userId"
          class="onebot-webqq-webqq__message-reaction-avatar"
          :title="user.userName || user.userId"
          :style="{ zIndex: getReactionUserZIndex(reaction, userIndex) }"
        >
          <img
            class="onebot-webqq-webqq__message-reaction-avatar-image"
            :src="withProxy(getReactionUserAvatar(user))"
            :alt="user.userName || user.userId"
          >
        </span>
      </span>
    </component>
  </div>
</template>

<script lang="ts" setup>
import { withProxy } from '@koishijs/client'
import type { WebQQChatStyle } from '../settings'
import type { WebQQMessageReaction, WebQQMessageReactionUser } from '../types'
import { getWebQQEmojiFace } from '../utils/emoji-catalog'

const props = withDefaults(defineProps<{
  reactions: WebQQMessageReaction[]
  chatStyle: WebQQChatStyle
  currentOperatorId?: string
  readonly?: boolean
}>(), {
  currentOperatorId: '',
  readonly: true,
})

const emit = defineEmits<{
  toggle: [emojiId: string]
}>()

const MAX_VISIBLE_REACTION_AVATARS = 3

function getFace(emojiId: string) {
  return getWebQQEmojiFace(emojiId)
}

function getReactionUsers(reaction: WebQQMessageReaction): WebQQMessageReactionUser[] {
  if (reaction.users?.length) return reaction.users
  return reaction.userId
    ? [{ userId: reaction.userId, userAvatar: reaction.userAvatar || '' }]
    : []
}

// 旧缓存和部分 OneBot 通知只保留 userId；这里按 QQ 头像地址补全，避免破图的 alt 文本被裁成数字头像。
function getReactionUserAvatar(user: WebQQMessageReactionUser) {
  return user.userAvatar || `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(user.userId)}&s=640`
}

// 与 sandbox 一致只展示少量叠放头像，避免多人回应把消息气泡撑宽。
function getVisibleReactionUsers(reaction: WebQQMessageReaction) {
  return getReactionUsers(reaction).slice(0, MAX_VISIBLE_REACTION_AVATARS)
}

function shouldShowReactionUsers(reaction: WebQQMessageReaction) {
  return props.chatStyle === 'tim' && getReactionUsers(reaction).length > 0
}

function getReactionUserZIndex(reaction: WebQQMessageReaction, userIndex: number) {
  return getVisibleReactionUsers(reaction).length - userIndex
}
</script>
