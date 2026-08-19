<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { IconX } from '@tabler/icons-vue'
import { inject, nextTick, ref, watch } from 'vue'
import { cn } from '../../../lib/utils'
import { resolvedWebQQColorMode } from '../../../webqq/settings'
import { showWebQQPopover } from '../../../webqq/utils/webqq-popover'
import { vWebqqScrollbar } from '../../../webqq/utils/webqq-scrollbar'
import { webQQDialogContextKey } from './dialog-context'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const dialog = inject(webQQDialogContextKey)
if (!dialog) throw new Error('DialogContent must be used inside Dialog')

const layer = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const isOpen = dialog.open
let previousFocus: HTMLElement | null = null

watch(isOpen, async (open) => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    await showWebQQPopover(layer.value ?? undefined)
    content.value?.focus({ preventScroll: true })
    return
  }
  previousFocus?.focus({ preventScroll: true })
  previousFocus = null
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="layer"
      popover="manual"
      data-state="open"
      data-slot="dialog-overlay"
      class="webqq-dialog-layer webqq-dialog-overlay"
      @click.self="dialog.setOpen(false)"
    >
      <!-- 生产 Koishi 中 Reka Presence 会只挂载 Overlay；显式 v-if 保证内容与受控 open 状态同步。 -->
      <div
        ref="content"
        v-webqq-scrollbar="{ zIndex: 10202 }"
        v-bind="$attrs"
        data-slot="dialog-content"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :class="cn('webqq-dialog-content', `is-color-${resolvedWebQQColorMode}`, props.class)"
        @click.stop
        @keydown.esc.stop.prevent="dialog.setOpen(false)"
      >
        <slot />
        <button type="button" aria-label="关闭" class="webqq-dialog-close" @click="dialog.setOpen(false)">
          <IconX :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
