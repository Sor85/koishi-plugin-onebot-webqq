<template>
  <div class="onebot-webqq-webqq__message-reactions">
    <component
      :is="readonly ? 'span' : 'button'"
      v-for="reaction in reactions"
      :key="reaction.emojiId"
      class="onebot-webqq-webqq__message-reaction"
      :class="{
        'is-interactive': !readonly,
        'is-mine': isMine(reaction),
      }"
      :type="readonly ? undefined : 'button'"
      :disabled="readonly ? undefined : false"
      @click.stop="!readonly && emit('toggle', reaction.emojiId)"
    >
      <img v-if="reaction.emojiUrl" class="onebot-webqq-webqq__message-reaction-emoji" :src="withProxy(reaction.emojiUrl)" :alt="reaction.label">
      <template v-else>{{ reaction.label }}</template>
      <span v-if="shouldShowReactionUsers(reaction)" class="onebot-webqq-webqq__message-reaction-users">
        <span v-for="(user, userIndex) in getReactionUsers(reaction)" :key="user.userId" class="onebot-webqq-webqq__message-reaction-avatar" :title="user.userName || user.userId" :style="{ zIndex: getReactionUserZIndex(reaction, userIndex) }">
          <img class="onebot-webqq-webqq__message-reaction-avatar-image" :src="withProxy(user.userAvatar)" :alt="user.userName || user.userId">
        </span>
      </span>
      <span v-if="shouldShowReactionCount(reaction)" class="onebot-webqq-webqq__message-reaction-count">{{ reaction.count }}</span>
    </component>
  </div>
</template>

<script lang="ts" setup>
import { withProxy } from '@koishijs/client'
import type { WebQQChatStyle } from '../settings'
import type { WebQQMessageReaction, WebQQMessageReactionUser } from '../types'

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

function getReactionUsers(reaction: WebQQMessageReaction): WebQQMessageReactionUser[] {
  if (reaction.users?.length) return reaction.users
  return reaction.userId && reaction.userAvatar
    ? [{ userId: reaction.userId, userAvatar: reaction.userAvatar }]
    : []
}

function shouldShowReactionUsers(reaction: WebQQMessageReaction) {
  return props.chatStyle === 'tim' && getReactionUsers(reaction).length > 0
}

function shouldShowReactionCount(reaction: WebQQMessageReaction) {
  if (props.chatStyle !== 'tim') return reaction.count > 1
  return reaction.count > Math.max(getReactionUsers(reaction).length, 1)
}

function getReactionUserZIndex(reaction: WebQQMessageReaction, userIndex: number) {
  return getReactionUsers(reaction).length - userIndex
}

function isMine(reaction: WebQQMessageReaction) {
  if (!props.currentOperatorId) return false
  return getReactionUsers(reaction).some((user) => user.userId === props.currentOperatorId)
    || reaction.userId === props.currentOperatorId
}
</script>
