<script setup lang="ts">
import type { ContextMenuSubContentEmits, ContextMenuSubContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ContextMenuSubContent, useForwardPropsEmits } from 'reka-ui'
import { cn } from '../../../lib/utils'
import { resolvedWebQQColorMode } from '../../../webqq/settings'

defineOptions({ inheritAttrs: false })

const props = defineProps<ContextMenuSubContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<ContextMenuSubContentEmits>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuSubContent
    data-slot="context-menu-sub-content"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn('webqq-context-menu-content webqq-context-menu-sub-content', `is-color-${resolvedWebQQColorMode}`, props.class)"
  >
    <slot />
  </ContextMenuSubContent>
</template>
