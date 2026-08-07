<template>
  <aside class="onebot-webqq-webqq__group-info">
    <header class="onebot-webqq-webqq__group-info-header">
      <strong>群信息</strong>
    </header>
    <div class="onebot-webqq-webqq__group-info-body">
      <section v-webqq-scrollbar class="onebot-webqq-webqq__group-announcements">
        <h3>群公告</h3>
        <div v-if="loading && !hasGroupInfo" class="onebot-webqq-webqq__group-empty">加载中</div>
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
        <div v-if="loading && !hasGroupInfo" class="onebot-webqq-webqq__group-empty">加载中</div>
        <div v-else-if="errorText" class="onebot-webqq-webqq__group-empty is-error">{{ errorText }}</div>
        <div v-else-if="!visibleMembers.length" class="onebot-webqq-webqq__group-empty">暂无群成员</div>
        <div v-else v-webqq-scrollbar class="onebot-webqq-webqq__group-member-list">
          <ContextMenu v-for="member in visibleMembers" :key="member.userId">
            <ContextMenuTrigger as-child>
              <article
                class="onebot-webqq-webqq__group-member"
                @click="emit('open-profile', member.userId, $event)"
                @pointerdown="(event) => { if (event.button === 2) rememberFloatingPanelAnchor(event) }"
                @contextmenu.capture="rememberFloatingPanelAnchor($event)"
              >
                <img :src="withProxy(member.avatar)" :alt="getGroupMemberName(member)">
                <span>
                  <strong>{{ getGroupMemberName(member) }}</strong>
                  <small>{{ member.userId }}</small>
                </span>
                <em v-if="member.role">{{ member.role }}</em>
              </article>
            </ContextMenuTrigger>
            <WebQQGroupMemberMenu
              :actor="actor"
              :member="member"
              @open-profile="emit('open-profile', member.userId)"
              @mention="emit('mention-group-member', member.userId)"
              @poke="emit('poke-group-member', member.userId)"
              @set-card="emit('set-group-card', member.userId)"
              @set-title="emit('set-group-title', member.userId)"
              @set-admin="emit('set-group-admin', member.userId, $event)"
              @kick="emit('kick-group-member', member.userId)"
            />
          </ContextMenu>
        </div>
      </section>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ContextMenu, ContextMenuTrigger } from '../../components/ui/context-menu'
import WebQQGroupMemberMenu from './WebQQGroupMemberMenu.vue'
import type { WebQQGroupInfo, WebQQGroupMember } from '../types'
import { rememberFloatingPanelAnchor } from '../utils/floating-panel'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'

const props = withDefaults(defineProps<{
  loading: boolean
  errorText: string
  groupInfo: WebQQGroupInfo
  visibleMembers: WebQQGroupMember[]
  searchQuery: string
  withProxy: (url: string) => string
  formatNoticeTime: (time: number) => string
  getGroupMemberName: (member: WebQQGroupMember) => string
  currentOperatorId?: string
}>(), {
  currentOperatorId: '',
})

const hasGroupInfo = computed(() => props.groupInfo.announcements.length > 0 || props.groupInfo.members.length > 0)
const actor = computed(() => props.groupInfo.members.find((member) => member.userId === props.currentOperatorId))

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'open-profile': [userId: string, event?: MouseEvent]
  'mention-group-member': [userId: string]
  'poke-group-member': [userId: string]
  'set-group-card': [userId: string]
  'set-group-title': [userId: string]
  'set-group-admin': [userId: string, enabled: boolean]
  'kick-group-member': [userId: string]
}>()

function updateSearchQuery(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:searchQuery', event.target.value)
}
</script>
