<template>
  <div
    class="onebot-webqq-webqq__message-search-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="查找聊天记录"
    tabindex="-1"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <section class="onebot-webqq-webqq__message-search" @click.stop>
      <header class="onebot-webqq-webqq__message-search-header">
        <strong>查找聊天记录</strong>
        <button type="button" aria-label="关闭查找聊天记录" @click="emit('close')">
          <IconX :size="19" aria-hidden="true" />
        </button>
      </header>
      <form class="onebot-webqq-webqq__message-search-form" @submit.prevent="emit('search')">
        <span class="onebot-webqq-webqq__message-search-input-wrap">
          <IconSearch :size="17" aria-hidden="true" />
          <input
            ref="searchInput"
            :value="query"
            type="search"
            placeholder="输入关键词"
            autocomplete="off"
            aria-label="聊天记录关键词"
            @input="emit('update:query', ($event.target as HTMLInputElement).value)"
          >
        </span>
        <button type="submit" :disabled="loading || !query.trim()">查找</button>
      </form>
      <div class="onebot-webqq-webqq__message-search-status" aria-live="polite">
        <span v-if="loading">正在查找历史消息…</span>
        <span v-else-if="errorText" class="is-error">{{ errorText }}</span>
        <span v-else-if="searched">找到 {{ results.length }} 条，已扫描 {{ scannedCount }} 条消息</span>
        <span v-else>搜索当前会话的历史聊天记录</span>
      </div>
      <div v-webqq-scrollbar class="onebot-webqq-webqq__message-search-results">
        <button
          v-for="message in results"
          :key="message.id || message.sequence"
          type="button"
          class="onebot-webqq-webqq__message-search-result"
          @click="emit('select', message)"
        >
          <span class="onebot-webqq-webqq__message-search-result-meta">
            <strong>{{ message.senderName }}</strong>
            <time>{{ formatSearchTime(message.time) }}</time>
          </span>
          <span class="onebot-webqq-webqq__message-search-result-summary">{{ message.summary || '[消息]' }}</span>
        </button>
        <div v-if="searched && !loading && !results.length" class="onebot-webqq-webqq__message-search-empty">未找到相关聊天记录</div>
      </div>
      <footer v-if="searched && !exhausted" class="onebot-webqq-webqq__message-search-footer">
        <button type="button" :disabled="loading" @click="emit('more')">继续搜索更早记录</button>
      </footer>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { IconSearch, IconX } from '@tabler/icons-vue'
import { nextTick, ref } from 'vue'
import type { WebQQMessage } from '../types'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'

const props = defineProps<{
  query: string
  results: WebQQMessage[]
  loading: boolean
  errorText: string
  searched: boolean
  scannedCount: number
  exhausted: boolean
}>()

const emit = defineEmits<{
  close: []
  search: []
  more: []
  select: [message: WebQQMessage]
  'update:query': [value: string]
}>()

const searchInput = ref<HTMLInputElement>()

nextTick(() => searchInput.value?.focus())

function formatSearchTime(time: number) {
  return new Date(time).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
