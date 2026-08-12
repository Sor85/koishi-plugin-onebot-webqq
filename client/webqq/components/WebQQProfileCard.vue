<template>
  <Teleport to="body">
    <section
      v-if="open && model"
      ref="panelRef"
      :class="['webqq-secondary-page onebot-webqq-webqq__portal-page webqq-profile-card-page', `is-color-${resolvedWebQQColorMode}`]"
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
          <button
            v-if="model.canEditAvatar"
            type="button"
            class="webqq-profile-card-avatar-button"
            :disabled="savingField != null"
            aria-label="点击更换头像"
            @click="openAvatarPicker"
          >
            <span class="webqq-profile-card-avatar-frame">
              <img
                v-if="displayAvatar"
                class="webqq-profile-card-avatar"
                :src="withProxy(displayAvatar)"
                :alt="model.name"
              >
              <span v-else class="webqq-profile-card-avatar is-fallback" aria-hidden="true">
                {{ model.name.slice(0, 1) }}
              </span>
              <span class="webqq-profile-card-avatar-overlay" aria-hidden="true">
                <IconCamera :size="22" />
              </span>
            </span>
            <span class="webqq-profile-card-avatar-hint">{{ savingField === 'avatar' ? '正在更换头像…' : '点击更换头像' }}</span>
          </button>
          <span v-else class="webqq-profile-card-avatar-frame is-static">
            <img
              v-if="model.avatar"
              class="webqq-profile-card-avatar"
              :src="withProxy(model.avatar)"
              :alt="model.name"
            >
            <span v-else class="webqq-profile-card-avatar is-fallback" aria-hidden="true">
              {{ model.name.slice(0, 1) }}
            </span>
          </span>
          <input
            ref="avatarInputRef"
            class="webqq-profile-card-avatar-input"
            type="file"
            accept="image/*"
            tabindex="-1"
            @change="handleAvatarFileSelect"
          >
        </div>
        <section
          v-for="section in sections"
          :key="section.group"
          class="webqq-profile-card-section"
        >
          <h3>{{ section.label }}</h3>
          <dl class="webqq-profile-card-fields">
            <div
              v-for="field in section.fields"
              :key="`${section.group}:${field.label}`"
              :class="{ 'is-editing': editingField === field.editKey }"
            >
              <dt>{{ field.label }}</dt>
              <dd v-if="editingField === field.editKey && field.editKey" class="webqq-profile-card-field-editor">
                <div
                  v-if="field.editKey === 'sex'"
                  ref="sexSelectRef"
                  class="webqq-profile-card-select"
                  :class="{ 'is-open': sexSelectOpen }"
                >
                  <button
                    type="button"
                    class="webqq-profile-card-select-trigger"
                    :disabled="savingField != null"
                    aria-haspopup="listbox"
                    :aria-expanded="sexSelectOpen"
                    aria-label="编辑性别"
                    @click.stop="toggleSexSelect"
                  >
                    <span>{{ getSexOptionLabel(editValue) }}</span>
                    <IconChevronDown :size="16" aria-hidden="true" />
                  </button>
                  <div
                    v-if="sexSelectOpen"
                    class="webqq-profile-card-select-menu"
                    role="listbox"
                    aria-label="性别选项"
                  >
                    <button
                      v-for="option in sexOptions"
                      :key="option.value"
                      type="button"
                      class="webqq-profile-card-select-option"
                      :class="{ 'is-active': editValue === option.value }"
                      role="option"
                      :aria-selected="editValue === option.value"
                      @click.stop="selectSexOption(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
                <Input
                  v-else
                  v-model="editValue"
                  :aria-label="`编辑${field.label}`"
                  :placeholder="field.editKey === 'nickname' ? '输入昵称' : '输入个性签名'"
                  @keydown="handleEditorKeydown($event, field.editKey)"
                />
              </dd>
              <dd v-else :class="{ 'is-empty': !field.value }">{{ field.value || '未设置' }}</dd>
              <span v-if="field.editKey" class="webqq-profile-card-field-actions">
                <template v-if="editingField === field.editKey">
                  <button
                    type="button"
                    class="webqq-profile-card-field-action"
                    :disabled="savingField != null"
                    :aria-label="`取消编辑${field.label}`"
                    @click="cancelFieldEdit"
                  >
                    <IconX :size="16" />
                  </button>
                  <button
                    type="button"
                    class="webqq-profile-card-field-action is-confirm"
                    :disabled="savingField != null || (field.editKey === 'nickname' && !editValue.trim())"
                    :aria-label="`保存${field.label}`"
                    @click="saveFieldEdit(field.editKey)"
                  >
                    <IconCheck :size="16" />
                  </button>
                </template>
                <button
                  v-else
                  type="button"
                  class="webqq-profile-card-field-action"
                  :disabled="savingField != null"
                  :aria-label="`编辑${field.label}`"
                  @click="startFieldEdit(field.editKey)"
                >
                  <IconPencil :size="16" />
                </button>
              </span>
            </div>
          </dl>
        </section>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { withProxy } from '@koishijs/client'
import { IconCamera, IconCheck, IconChevronDown, IconPencil, IconX } from '@tabler/icons-vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Input } from '../../components/ui/input'
import { resolvedWebQQColorMode } from '../settings'
import { groupProfileCardFields, type ProfileCardEditableField, type ProfileCardModel } from '../utils/profile-card'
import { clampFloatingPanelPosition, getFloatingPanelStyle, isFloatingPanelInteractiveTarget } from '../utils/floating-panel'
import type { WebQQSelfProfileUpdate } from '../types'

type SavingField = ProfileCardEditableField | 'avatar'

const sexOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '未知' },
] as const

const props = defineProps<{
  open: boolean
  model?: ProfileCardModel
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'save-self-profile': [input: WebQQSelfProfileUpdate, complete: (success: boolean) => void]
}>()

const panelRef = ref<HTMLElement>()
const avatarInputRef = ref<HTMLInputElement>()
const sexSelectRef = ref<HTMLElement>()
const panelStyle = ref<Record<string, string>>({})
const dragging = ref(false)
const editingField = ref<ProfileCardEditableField>()
const editValue = ref('')
const savingField = ref<SavingField>()
const avatarPreview = ref('')
const sexSelectOpen = ref(false)
let dragState: { pointerId: number, startX: number, startY: number, left: number, top: number } | undefined

const sections = computed(() => props.model ? groupProfileCardFields(props.model.fields) : [])
const displayAvatar = computed(() => avatarPreview.value || props.model?.avatar || '')

watch(() => props.open, (open) => {
  if (!open) return
  panelStyle.value = getFloatingPanelStyle({ width: 300, height: 420 })
  resetEditorState()
})

watch(() => props.model, (model) => {
  if (!props.open || !model) return
  avatarPreview.value = ''
  if (editingField.value && !model.fields.some((field) => field.editKey === editingField.value)) {
    editingField.value = undefined
    editValue.value = ''
  }
})

function resetEditorState() {
  editingField.value = undefined
  editValue.value = ''
  savingField.value = undefined
  avatarPreview.value = ''
  sexSelectOpen.value = false
  if (avatarInputRef.value) avatarInputRef.value.value = ''
}

function getSexOptionLabel(value: string) {
  return sexOptions.find((option) => option.value === value)?.label || '未知'
}

function toggleSexSelect() {
  if (savingField.value) return
  sexSelectOpen.value = !sexSelectOpen.value
}

function selectSexOption(value: string) {
  editValue.value = value
  sexSelectOpen.value = false
}

function closeOnOutsidePointer(event: PointerEvent) {
  if (!props.open) return
  const target = event.target as Node
  if (sexSelectOpen.value && sexSelectRef.value && !sexSelectRef.value.contains(target)) {
    sexSelectOpen.value = false
  }
  if (panelRef.value?.contains(target)) return
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

function openAvatarPicker() {
  if (!props.model?.canEditAvatar || savingField.value) return
  avatarInputRef.value?.click()
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('头像文件读取失败')))
    reader.addEventListener('error', () => reject(reader.error || new Error('头像文件读取失败')))
    reader.readAsDataURL(file)
  })
}

async function handleAvatarFileSelect(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/') || !props.model?.canEditAvatar || savingField.value) return
  try {
    const dataUrl = await readImageFile(file)
    const separator = dataUrl.indexOf(',')
    if (separator < 0) return
    avatarPreview.value = dataUrl
    savingField.value = 'avatar'
    // OneBot set_qq_avatar 接收 base64://；预览仍使用浏览器可渲染的 data URL，避免把协议格式塞进 img src。
    emit('save-self-profile', { avatar: `base64://${dataUrl.slice(separator + 1)}` }, (success) => {
      savingField.value = undefined
      if (!success) avatarPreview.value = ''
    })
  } catch {
    avatarPreview.value = ''
    savingField.value = undefined
  }
}

function getFieldEditValue(field: ProfileCardEditableField): string {
  if (field === 'nickname') return props.model?.nickname || props.model?.name || ''
  if (field === 'personalNote') return props.model?.personalNote || ''
  return props.model?.sex || 'unknown'
}

function startFieldEdit(field: ProfileCardEditableField) {
  if (!props.model?.canEditSelf || savingField.value) return
  editingField.value = field
  editValue.value = getFieldEditValue(field)
  sexSelectOpen.value = false
}

function cancelFieldEdit() {
  if (savingField.value) return
  editingField.value = undefined
  editValue.value = ''
  sexSelectOpen.value = false
}

function handleEditorKeydown(event: KeyboardEvent, field: ProfileCardEditableField) {
  if (event.key === 'Enter') saveFieldEdit(field)
  if (event.key === 'Escape') cancelFieldEdit()
}

function saveFieldEdit(field: ProfileCardEditableField) {
  if (editingField.value !== field || !props.model?.canEditSelf || savingField.value) return
  const input: WebQQSelfProfileUpdate = {}
  if (field === 'nickname') {
    const nickname = editValue.value.trim()
    if (!nickname) return
    if (nickname === (props.model.nickname || props.model.name)) return cancelFieldEdit()
    input.nickname = nickname
  } else if (field === 'personalNote') {
    if (editValue.value === (props.model.personalNote || '')) return cancelFieldEdit()
    input.personalNote = editValue.value
  } else {
    if (editValue.value === (props.model.sex || '')) return cancelFieldEdit()
    input.sex = editValue.value
  }
  savingField.value = field
  emit('save-self-profile', input, (success) => {
    savingField.value = undefined
    if (!success) return
    editingField.value = undefined
    editValue.value = ''
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
