<template>
  <Teleport to="body">
    <section
      v-if="open && model"
      ref="panelRef"
      class="webqq-secondary-page webqq-profile-card-page"
      :style="panelStyle"
      aria-label="查看资料"
    >
      <header
        class="webqq-secondary-page-header"
        :class="{ 'is-dragging': dragging }"
        @pointerdown="startDrag"
      >
        <strong>查看资料</strong>
      </header>
      <div class="webqq-profile-card">
        <div class="webqq-profile-card-hero">
          <img
            v-if="model.avatar"
            class="webqq-profile-card-avatar"
            :src="withProxy(model.avatar)"
            :alt="model.name"
          >
          <span v-else class="webqq-profile-card-avatar is-fallback" aria-hidden="true">
            {{ model.name.slice(0, 1) }}
          </span>
          <div>
            <h2>{{ model.name }}</h2>
            <p>{{ model.identityLabel }} {{ model.participantId }}</p>
            <p v-if="model.personalNote" class="webqq-profile-card-note">{{ model.personalNote }}</p>
          </div>
        </div>
        <section
          v-for="section in sections"
          :key="section.group"
          class="webqq-profile-card-section"
        >
          <h3>{{ section.label }}</h3>
          <dl class="webqq-profile-card-fields">
            <div v-for="field in section.fields" :key="`${section.group}:${field.label}:${field.value}`">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value }}</dd>
            </div>
          </dl>
        </section>
        <section v-if="model.canEditSelf || model.canEditAvatar" class="webqq-profile-card-section">
          <h3>编辑自己的资料</h3>
          <div class="webqq-profile-card-edit">
            <label v-if="model.canEditAvatar">
              <span>头像地址</span>
              <Input v-model="editAvatar" placeholder="输入图片 URL 或 OneBot 支持的文件地址" />
            </label>
            <label>
              <span>昵称</span>
              <Input v-model="editNickname" placeholder="输入昵称" />
            </label>
            <label>
              <span>个性签名</span>
              <Input v-model="editPersonalNote" placeholder="输入个性签名" />
            </label>
            <label>
              <span>性别</span>
              <select v-model="editSex" class="webqq-ui-input">
                <option value="">不修改</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="unknown">未知</option>
              </select>
            </label>
            <div class="webqq-profile-card-edit-actions">
              <Button variant="outline" :disabled="saving" @click="emit('update:open', false)">取消</Button>
              <Button :disabled="saving" @click="submitSelfEdit">保存</Button>
            </div>
          </div>
        </section>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { withProxy } from '@koishijs/client'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { groupProfileCardFields, type ProfileCardModel } from '../utils/profile-card'
import { clampFloatingPanelPosition, getFloatingPanelStyle, isFloatingPanelInteractiveTarget } from '../utils/floating-panel'
import type { WebQQSelfProfileUpdate } from '../types'

const props = defineProps<{
  open: boolean
  model?: ProfileCardModel
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'save-self-profile': [input: WebQQSelfProfileUpdate, complete: () => void]
}>()

const panelRef = ref<HTMLElement>()
const panelStyle = ref<Record<string, string>>({})
const dragging = ref(false)
const saving = ref(false)
const editAvatar = ref('')
const editNickname = ref('')
const editPersonalNote = ref('')
const editSex = ref('')
let dragState: { pointerId: number, startX: number, startY: number, left: number, top: number } | undefined

const sections = computed(() => props.model ? groupProfileCardFields(props.model.fields) : [])

watch(() => props.open, (open) => {
  if (!open) return
  panelStyle.value = getFloatingPanelStyle({ width: 300, height: 420 })
  editAvatar.value = props.model?.avatar || ''
  editNickname.value = props.model?.nickname || props.model?.name || ''
  editPersonalNote.value = props.model?.personalNote || ''
  editSex.value = props.model?.sex || ''
  saving.value = false
})

watch(() => props.model, (model) => {
  if (!props.open || !model) return
  editAvatar.value = model.avatar || ''
  editNickname.value = model.nickname || model.name || ''
  editPersonalNote.value = model.personalNote || ''
  editSex.value = model.sex || ''
})

function closeOnOutsidePointer(event: PointerEvent) {
  if (!props.open || panelRef.value?.contains(event.target as Node)) return
  emit('update:open', false)
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || isFloatingPanelInteractiveTarget(event.target) || !panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId || !panelRef.value) return
  const position = clampFloatingPanelPosition({
    x: dragState.left + event.clientX - dragState.startX,
    y: dragState.top + event.clientY - dragState.startY,
  }, { width: window.innerWidth, height: window.innerHeight }, {
    width: panelRef.value.offsetWidth,
    height: panelRef.value.offsetHeight,
  })
  panelStyle.value = { left: `${position.x}px`, top: `${position.y}px` }
}

function stopDrag(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  dragState = undefined
  dragging.value = false
}

function submitSelfEdit() {
  if ((!props.model?.canEditSelf && !props.model?.canEditAvatar) || saving.value) return
  const input: WebQQSelfProfileUpdate = {}
  const avatar = editAvatar.value.trim()
  if (props.model.canEditAvatar && avatar && avatar !== (props.model.avatar || '')) input.avatar = avatar
  const nickname = editNickname.value.trim()
  if (nickname && nickname !== (props.model.nickname || props.model.name)) input.nickname = nickname
  if (editPersonalNote.value !== (props.model.personalNote || '')) input.personalNote = editPersonalNote.value
  if (editSex.value && editSex.value !== (props.model.sex || '')) input.sex = editSex.value
  if (!Object.keys(input).length) return
  saving.value = true
  // 保存由父组件执行真实 RPC；无论成功或失败都回调复位，避免一次失败后资料卡永久无法再次提交。
  emit('save-self-profile', input, () => {
    saving.value = false
  })
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointer)
  document.addEventListener('pointermove', moveDrag)
  document.addEventListener('pointerup', stopDrag)
  document.addEventListener('pointercancel', stopDrag)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer)
  document.removeEventListener('pointermove', moveDrag)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)
})
</script>
