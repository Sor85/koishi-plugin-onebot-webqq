<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { IconX } from '@tabler/icons-vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '../../../lib/utils'
import { vWebqqScrollbar } from '../../../webqq/utils/webqq-scrollbar'

defineOptions({ inheritAttrs: false })

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay data-slot="dialog-overlay" class="webqq-dialog-overlay" />
    <DialogContent
      v-webqq-scrollbar="{ zIndex: 160 }"
      data-slot="dialog-content"
      class="webqq-dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="cn(props.class)"
    >
      <slot />
      <DialogClose aria-label="关闭" class="webqq-dialog-close">
        <IconX :size="18" aria-hidden="true" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
