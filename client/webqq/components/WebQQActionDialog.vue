<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <Input
        v-model="inputValue"
        :placeholder="placeholder"
        @keydown.enter="submit"
      />
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">取消</Button>
        <Button @click="submit">{{ confirmText }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  placeholder?: string
  value?: string
  confirmText?: string
}>(), {
  description: '',
  placeholder: '',
  value: '',
  confirmText: '保存',
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  confirm: [value: string]
}>()

const inputValue = ref(props.value)

watch(() => props.open, (open) => {
  if (open) inputValue.value = props.value
})

watch(() => props.value, (value) => {
  if (props.open) inputValue.value = value
})

function submit() {
  emit('confirm', String(inputValue.value ?? ''))
}
</script>
