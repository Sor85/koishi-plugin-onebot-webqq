<template>
  <div class="chat-capsule-host">
    <div class="chat-capsule" aria-live="polite">
      <div class="chat-capsule__avatar">
        <img v-if="capsule?.bot.avatar" :src="withProxy(capsule.bot.avatar)" :alt="capsule.bot.name">
        <k-icon v-else name="robot" />
        <span :class="['chat-capsule__status', statusClass]"></span>
      </div>
      <div class="chat-capsule__body">
        <div class="chat-capsule__title-line">
          <div class="chat-capsule__title" :title="capsule?.bot.name || '空闲'">
            {{ capsule?.bot.name || '空闲' }}
          </div>
          <span v-if="titleStatusText" class="chat-capsule__title-status is-thinking">{{ titleStatusText }}</span>
        </div>
        <div class="chat-capsule__meta" :title="metaTitle">
          <span v-if="displayActivityText" class="chat-capsule__activity">{{ displayActivityText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { Universal, withProxy } from '@koishijs/client'
import { capsule } from './state'

const activityText = computed(() => capsule.value?.conversation.activityText || '')
const isThinking = computed(() => activityText.value === '正在思考')
const titleStatusText = computed(() => isThinking.value ? activityText.value : '')
const userName = computed(() => capsule.value?.conversation.userName || '')
const userActivityText = computed(() => userName.value ? `正在与 ${userName.value} 对话` : '')
const displayActivityText = computed(() => userActivityText.value || '空闲中')

const metaTitle = computed(() => {
  return displayActivityText.value
})

const statusClass = computed(() => {
  switch (capsule.value?.bot.status) {
    case Universal.Status.ONLINE:
      return 'is-online'
    case Universal.Status.CONNECT:
    case Universal.Status.RECONNECT:
      return 'is-pending'
    default:
      return 'is-offline'
  }
})

</script>
