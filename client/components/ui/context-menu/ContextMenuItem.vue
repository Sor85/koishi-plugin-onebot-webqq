<script setup lang="ts">
import type { ContextMenuItemEmits, ContextMenuItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ContextMenuItem, useForwardPropsEmits } from 'reka-ui'
import { cn } from '../../../lib/utils'

const props = defineProps<ContextMenuItemProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<ContextMenuItemEmits>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuItem
    data-slot="onebot-webqq-context-menu-item"
    v-bind="forwarded"
    :class="cn('webqq-context-menu-item', props.class)"
  >
    <slot />
  </ContextMenuItem>
</template>
