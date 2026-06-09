<template>
  <aside class="onebot-webqq-webqq__group-info">
    <header class="onebot-webqq-webqq__group-info-header">
      <strong>群信息</strong>
    </header>
    <div class="onebot-webqq-webqq__group-info-body">
      <section class="onebot-webqq-webqq__group-announcements">
        <h3>群公告</h3>
        <div v-if="loading" class="onebot-webqq-webqq__group-empty">加载中</div>
        <div v-else-if="errorText" class="onebot-webqq-webqq__group-empty is-error">{{ errorText }}</div>
        <div v-else-if="!groupInfo.announcements.length" class="onebot-webqq-webqq__group-empty">暂无群公告</div>
        <template v-else>
          <article v-for="announcement in groupInfo.announcements" :key="announcement.id" class="onebot-webqq-webqq__group-announcement">
            <p>{{ announcement.content }}</p>
            <time v-if="announcement.time">{{ formatNoticeTime(announcement.time) }}</time>
          </article>
        </template>
      </section>
      <section class="onebot-webqq-webqq__group-members">
        <h3>群成员</h3>
        <input :value="searchQuery" type="text" placeholder="搜索群昵称或 QQ 号" @input="updateSearchQuery">
        <div v-if="loading" class="onebot-webqq-webqq__group-empty">加载中</div>
        <div v-else-if="errorText" class="onebot-webqq-webqq__group-empty is-error">{{ errorText }}</div>
        <div v-else-if="!visibleMembers.length" class="onebot-webqq-webqq__group-empty">暂无群成员</div>
        <div v-else class="onebot-webqq-webqq__group-member-list">
          <article v-for="member in visibleMembers" :key="member.userId" class="onebot-webqq-webqq__group-member">
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
import type { WebQQGroupInfo, WebQQGroupMember } from '../state'

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
