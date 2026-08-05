<script setup lang="ts">
import type { ContextMenuSubTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { IconChevronRight } from '@tabler/icons-vue'
import { reactiveOmit } from '@vueuse/core'
import { ContextMenuSubTrigger, useForwardProps } from 'reka-ui'
import { cn } from '../../../lib/utils'

const props = defineProps<ContextMenuSubTriggerProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ContextMenuSubTrigger
    data-slot="context-menu-sub-trigger"
    v-bind="forwarded"
    :class="cn('webqq-context-menu-item webqq-context-menu-sub-trigger', props.class)"
  >
    <slot />
    <IconChevronRight class="webqq-context-menu-chevron" :size="16" aria-hidden="true" />
  </ContextMenuSubTrigger>
</template>
