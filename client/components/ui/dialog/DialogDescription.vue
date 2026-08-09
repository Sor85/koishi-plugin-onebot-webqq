<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../../lib/utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <p v-bind="$attrs" data-slot="dialog-description" class="webqq-dialog-description" :class="cn(props.class)">
    <slot />
  </p>
</template>
