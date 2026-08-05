<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../../lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <footer data-slot="dialog-footer" class="webqq-dialog-footer" :class="cn(props.class)">
    <slot />
  </footer>
</template>
