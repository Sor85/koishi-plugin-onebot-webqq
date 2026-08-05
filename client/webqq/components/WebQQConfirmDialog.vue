<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" :disabled="submitting" @click="emit('update:open', false)">取消</Button>
        <Button variant="destructive" :disabled="submitting" @click="confirm">{{ submitting ? '处理中...' : confirmText }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

const props = withDefaults(defineProps<{ open: boolean, title: string, description: string, confirmText?: string }>(), { confirmText: '确认' })
const emit = defineEmits<{
  'update:open': [open: boolean]
  confirm: [resolve: () => void, reject: (error: unknown) => void]
}>()
const submitting = ref(false)
watch(() => props.open, (open) => {
  if (open) submitting.value = false
})
async function confirm() {
  if (submitting.value) return
  submitting.value = true
  try {
    await new Promise<void>((resolve, reject) => emit('confirm', resolve, reject))
    emit('update:open', false)
  } catch {
    // 失败时保留确认框，具体协议错误由宿主统一展示；吞掉拒绝避免 Vue 点击处理器产生未处理 Promise。
  } finally {
    submitting.value = false
  }
}
</script>
