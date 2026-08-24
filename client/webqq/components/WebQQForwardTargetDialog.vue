<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="onebot-webqq-webqq__forward-target-dialog">
      <DialogHeader>
        <DialogTitle>选择转发目标</DialogTitle>
        <DialogDescription>将已选消息合并转发到一个最近会话、好友或群组。</DialogDescription>
      </DialogHeader>

      <label class="onebot-webqq-webqq__forward-target-search">
        <IconSearch :size="18" aria-hidden="true" />
        <input v-model="searchQuery" type="search" aria-label="搜索目标会话" placeholder="搜索最近、好友或群组..." autocomplete="off">
      </label>

      <div class="onebot-webqq-webqq__forward-target-tabs" role="tablist" aria-label="目标分类">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="onebot-webqq-webqq__forward-target-tab"
          :class="{ 'is-active': activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-webqq-scrollbar="{ tone: 'accent', zIndex: 10202 }" class="onebot-webqq-webqq__forward-target-list" role="listbox" aria-label="目标会话">
        <button
          v-for="target in visibleTargets"
          :key="target.id"
          type="button"
          role="option"
          class="onebot-webqq-webqq__forward-target-item"
          :class="{ 'is-active': selectedTargetId === target.id }"
          :aria-selected="selectedTargetId === target.id"
          @click="selectedTargetId = target.id"
        >
          <img v-if="target.avatar" :src="withProxy(target.avatar)" :alt="target.title">
          <span v-else class="onebot-webqq-webqq__forward-target-avatar-fallback" aria-hidden="true">{{ target.title.slice(0, 1) }}</span>
          <span class="onebot-webqq-webqq__forward-target-copy">
            <strong>{{ target.title }}</strong>
            <small>{{ target.subtitle || target.peerId }}</small>
          </span>
          <span class="onebot-webqq-webqq__forward-target-radio" aria-hidden="true"></span>
        </button>
        <div v-if="!visibleTargets.length" class="onebot-webqq-webqq__forward-target-empty">{{ emptyText }}</div>
      </div>

      <p v-if="errorMessage" class="onebot-webqq-webqq__forward-target-error" role="alert">{{ errorMessage }}</p>
      <DialogFooter>
        <Button variant="outline" :disabled="submitting" @click="emit('update:open', false)">取消</Button>
        <Button :disabled="!selectedTargetId || submitting" @click="confirm">{{ submitting ? '转发中...' : '合并转发' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { withProxy } from '@koishijs/client'
import { IconSearch } from '@tabler/icons-vue'
import { computed, ref, watch } from 'vue'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'
import { readWebQQErrorMessage } from '../utils/webqq-error'

export type WebQQForwardTargetTab = 'recent' | 'friends' | 'groups'
export interface WebQQForwardTargetOption {
  id: string
  type: 'friend' | 'group'
  peerId: string
  title: string
  subtitle?: string
  avatar?: string
}
export interface WebQQForwardTargetModel {
  recent: WebQQForwardTargetOption[]
  friends: WebQQForwardTargetOption[]
  groups: WebQQForwardTargetOption[]
}

const props = defineProps<{ open: boolean, model: WebQQForwardTargetModel }>()
const emit = defineEmits<{
  'update:open': [open: boolean]
  confirm: [target: WebQQForwardTargetOption, resolve: () => void, reject: (error: unknown) => void]
}>()
const tabs: Array<{ id: WebQQForwardTargetTab, label: string }> = [
  { id: 'recent', label: '最近' },
  { id: 'friends', label: '好友' },
  { id: 'groups', label: '群组' },
]
const activeTab = ref<WebQQForwardTargetTab>('recent')
const searchQuery = ref('')
const selectedTargetId = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const visibleTargets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const source = props.model[activeTab.value]
  if (!query) return source
  return source.filter((target) => target.title.toLowerCase().includes(query)
    || target.peerId.toLowerCase().includes(query)
    || (target.subtitle?.toLowerCase().includes(query) ?? false))
})
const emptyText = computed(() => {
  if (searchQuery.value.trim()) return '没有匹配的目标会话'
  if (activeTab.value === 'friends') return '暂无已添加好友会话'
  if (activeTab.value === 'groups') return '暂无已加入群组'
  return '暂无最近会话'
})
function selectFirstVisibleTarget() {
  if (!visibleTargets.value.some(({ id }) => id === selectedTargetId.value)) selectedTargetId.value = visibleTargets.value[0]?.id ?? ''
}
watch(() => props.open, (open) => {
  if (!open) return
  activeTab.value = 'recent'
  searchQuery.value = ''
  selectedTargetId.value = props.model.recent[0]?.id ?? props.model.friends[0]?.id ?? props.model.groups[0]?.id ?? ''
  submitting.value = false
  errorMessage.value = ''
})
watch(activeTab, selectFirstVisibleTarget)
watch(searchQuery, selectFirstVisibleTarget)
async function confirm() {
  const target = Object.values(props.model).flat().find(({ id }) => id === selectedTargetId.value)
  if (!target || submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await new Promise<void>((resolve, reject) => emit('confirm', target, resolve, reject))
    emit('update:open', false)
  } catch (error) {
    // 多选态隐藏输入区，失败信息必须留在当前弹窗，用户才能直接重试而不丢失选择。
    errorMessage.value = readWebQQErrorMessage(error, '合并转发失败')
  } finally {
    submitting.value = false
  }
}
</script>
