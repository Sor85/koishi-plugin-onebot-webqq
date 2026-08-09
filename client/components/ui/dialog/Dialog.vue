<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { webQQDialogContextKey } from './dialog-context'

const props = withDefaults(defineProps<{
  open?: boolean
  defaultOpen?: boolean
}>(), {
  defaultOpen: false,
})
const emit = defineEmits<{
  'update:open': [open: boolean]
}>()
const uncontrolledOpen = ref(props.defaultOpen)
const dialogOpen = computed(() => props.open ?? uncontrolledOpen.value)

function setOpen(open: boolean) {
  if (props.open === undefined) uncontrolledOpen.value = open
  emit('update:open', open)
}

provide(webQQDialogContextKey, {
  open: dialogOpen,
  setOpen,
})
</script>

<template>
  <slot :open="dialogOpen" :close="() => setOpen(false)" />
</template>
