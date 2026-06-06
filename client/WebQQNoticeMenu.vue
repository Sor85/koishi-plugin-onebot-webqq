<template>
  <div class="chat-capsule-webqq__notice-menu">
    <div class="chat-capsule-webqq__notice-tabs">
      <button :class="{ 'is-active': tab === 'friends' }" type="button" @click="emit('update:tab', 'friends')">好友申请</button>
      <button :class="{ 'is-active': tab === 'groups' }" type="button" @click="emit('update:tab', 'groups')">群通知</button>
    </div>
    <div class="chat-capsule-webqq__notice-menu-body">
      <div v-if="loading" class="chat-capsule-webqq__notice-empty">加载中</div>
      <div v-else-if="errorText" class="chat-capsule-webqq__notice-empty is-error">{{ errorText }}</div>
      <div v-else-if="!notices.length" class="chat-capsule-webqq__notice-empty">暂无通知</div>
      <div v-else class="chat-capsule-webqq__notices">
        <article v-for="notice in notices" :key="notice.id" class="chat-capsule-webqq__notice-card">
          <img v-if="notice.avatar" class="chat-capsule-webqq__notice-avatar" :src="withProxy(notice.avatar)" :alt="notice.title">
          <span v-else class="chat-capsule-webqq__notice-avatar"></span>
          <div class="chat-capsule-webqq__notice-main">
            <strong class="chat-capsule-webqq__notice-title">{{ notice.title }}</strong>
            <span>{{ notice.subtitle }}</span>
            <template v-if="notice.comment">
              <small v-for="line in formatNoticeComment(notice.comment)" :key="line" class="chat-capsule-webqq__notice-comment">{{ line }}</small>
            </template>
          </div>
          <div class="chat-capsule-webqq__notice-side">
            <span v-if="canHandleNotice(notice)" class="chat-capsule-webqq__notice-actions">
              <button type="button" :disabled="handlingNoticeId === notice.id" @click="emit('handle', notice, true)">同意</button>
              <button type="button" :disabled="handlingNoticeId === notice.id" @click="emit('handle', notice, false)">拒绝</button>
            </span>
            <span v-else-if="getHandledNoticeStatusText(notice)" :class="['chat-capsule-webqq__notice-result', `is-${notice.status}`]">{{ getHandledNoticeStatusText(notice) }}</span>
            <time v-if="notice.time" class="chat-capsule-webqq__notice-time">{{ formatNoticeTime(notice.time) }}</time>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { WebQQNotice } from './state'
import {
  canHandleNotice,
  formatNoticeComment,
  getHandledNoticeStatusText,
} from './utils/webqq-notice-view'

defineProps<{
  tab: 'friends' | 'groups'
  loading: boolean
  errorText: string
  notices: WebQQNotice[]
  handlingNoticeId: string
  withProxy: (url: string) => string
  formatNoticeTime: (time: number) => string
}>()

const emit = defineEmits<{
  'update:tab': [value: 'friends' | 'groups']
  handle: [notice: WebQQNotice, approve: boolean]
}>()
</script>
