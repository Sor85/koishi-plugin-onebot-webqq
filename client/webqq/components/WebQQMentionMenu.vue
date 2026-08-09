<template>
  <div class="onebot-webqq-webqq__mention-menu" role="listbox" aria-label="提及成员">
    <button
      v-for="(candidate, index) in candidates"
      :key="candidate.id"
      type="button"
      class="onebot-webqq-webqq__mention-menu-item"
      role="option"
      :class="{ 'is-active': index === activeIndex }"
      :aria-selected="index === activeIndex"
      @mousedown.prevent="emit('select', candidate)"
      @mouseenter="emit('hover', index)"
    >
      <img v-if="candidate.avatar" class="onebot-webqq-webqq__mention-menu-avatar" :src="withProxy(candidate.avatar)" alt="">
      <span v-else class="onebot-webqq-webqq__mention-menu-avatar" aria-hidden="true">{{ candidate.name.slice(0, 1) }}</span>
      <span class="onebot-webqq-webqq__mention-menu-meta">
        <strong>{{ candidate.name }}</strong>
        <small>{{ candidate.id }}</small>
      </span>
    </button>
    <div v-if="!candidates.length" class="onebot-webqq-webqq__mention-menu-empty">无匹配成员</div>
  </div>
</template>

<script lang="ts" setup>
import { withProxy } from '@koishijs/client'
import type { WebQQMentionCandidate } from '../utils/webqq-composer-draft'

defineProps<{
  candidates: WebQQMentionCandidate[]
  activeIndex: number
}>()

const emit = defineEmits<{
  select: [candidate: WebQQMentionCandidate]
  hover: [index: number]
}>()
</script>
