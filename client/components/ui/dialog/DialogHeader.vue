<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../../lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <header data-slot="dialog-header" class="webqq-dialog-header" :class="cn(props.class)">
    <slot />
  </header>
</template>
