<template>
  <aside class="chat-capsule-webqq__group-info">
    <header class="chat-capsule-webqq__group-info-header">
      <strong>群信息</strong>
    </header>
    <div class="chat-capsule-webqq__group-info-body">
      <section class="chat-capsule-webqq__group-announcements">
        <h3>群公告</h3>
        <div v-if="loading" class="chat-capsule-webqq__group-empty">加载中</div>
        <div v-else-if="errorText" class="chat-capsule-webqq__group-empty is-error">{{ errorText }}</div>
        <div v-else-if="!groupInfo.announcements.length" class="chat-capsule-webqq__group-empty">暂无群公告</div>
        <article v-for="announcement in groupInfo.announcements" v-else :key="announcement.id" class="chat-capsule-webqq__group-announcement">
          <p>{{ announcement.content }}</p>
          <time v-if="announcement.time">{{ formatNoticeTime(announcement.time) }}</time>
        </article>
      </section>
      <section class="chat-capsule-webqq__group-members">
        <h3>群成员</h3>
        <input :value="searchQuery" type="text" placeholder="搜索群昵称或 QQ 号" @input="updateSearchQuery">
        <div v-if="loading" class="chat-capsule-webqq__group-empty">加载中</div>
        <div v-else-if="errorText" class="chat-capsule-webqq__group-empty is-error">{{ errorText }}</div>
        <div v-else-if="!visibleMembers.length" class="chat-capsule-webqq__group-empty">暂无群成员</div>
        <div v-else class="chat-capsule-webqq__group-member-list">
          <article v-for="member in visibleMembers" :key="member.userId" class="chat-capsule-webqq__group-member">
            <img :src="withProxy(member.avatar)" :alt="getGroupMemberName(member)">
            <span>
              <strong>{{ getGroupMemberName(member) }}</strong>
              <small>{{ member.userId }}</small>
            </span>
            <em v-if="member.role">{{ member.role }}</em>
          </article>
        </div>
      </section>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import type { WebQQGroupInfo, WebQQGroupMember } from './state'

defineProps<{
  loading: boolean
  errorText: string
  groupInfo: WebQQGroupInfo
  visibleMembers: WebQQGroupMember[]
  searchQuery: string
  withProxy: (url: string) => string
  formatNoticeTime: (time: number) => string
  getGroupMemberName: (member: WebQQGroupMember) => string
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
}>()

function updateSearchQuery(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:searchQuery', event.target.value)
}
</script>
