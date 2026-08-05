<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '../../../lib/utils'

interface Props extends PrimitiveProps {
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost'
  size?: 'default' | 'sm'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  variant: 'default',
  size: 'default',
})
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="cn('webqq-ui-button', props.class)"
  >
    <slot />
  </Primitive>
</template>
