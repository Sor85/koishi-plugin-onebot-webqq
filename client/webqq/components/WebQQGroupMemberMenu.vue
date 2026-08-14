<template>
  <component :is="sub ? ContextMenuSubContent : ContextMenuContent" style="z-index: 10140">
    <ContextMenuItem v-if="!sub && actions.includes('mention')" @select="emit('mention')">
      <IconAt :size="16" aria-hidden="true" /> @ 用户
    </ContextMenuItem>
    <ContextMenuItem v-if="!sub && actions.includes('poke')" @select="emit('poke')">
      <IconHandClick :size="16" aria-hidden="true" /> 戳一戳
    </ContextMenuItem>
    <ContextMenuItem v-if="actions.includes('set-card')" @select="emit('set-card')">
      <IconTag :size="16" aria-hidden="true" /> 修改群名片
    </ContextMenuItem>
    <ContextMenuItem v-if="actions.includes('set-title')" @select="emit('set-title')">
      <IconAward :size="16" aria-hidden="true" /> 设置专属头衔
    </ContextMenuItem>
    <ContextMenuItem v-if="actions.includes('set-admin')" @select="emit('set-admin', true)">
      <IconUserPlus :size="16" aria-hidden="true" /> 设为管理员
    </ContextMenuItem>
    <ContextMenuItem v-if="actions.includes('unset-admin')" @select="emit('set-admin', false)">
      <IconUserMinus :size="16" aria-hidden="true" /> 取消管理员
    </ContextMenuItem>
    <ContextMenuItem
      v-if="actions.includes('kick')"
      class="is-danger"
      @select="emit('kick')"
    >
      <IconUserMinus :size="16" aria-hidden="true" /> 踢出群组
    </ContextMenuItem>
    <ContextMenuItem v-else-if="kickDisabledReason" disabled>
      <IconUserMinus :size="16" aria-hidden="true" /> {{ kickDisabledReason }}
    </ContextMenuItem>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconAt, IconAward, IconHandClick, IconTag, IconUserMinus, IconUserPlus } from '@tabler/icons-vue'
import { ContextMenuContent, ContextMenuItem, ContextMenuSubContent } from '../../components/ui/context-menu'
import {
  getGroupMemberKickDisabledReason,
  getGroupMemberMenuActions,
  type GroupMemberMenuTarget,
} from '../utils/group-menu'

const props = defineProps<{
  actor?: GroupMemberMenuTarget
  member: GroupMemberMenuTarget
  sub?: boolean
}>()

const emit = defineEmits<{
  mention: []
  poke: []
  'set-card': []
  'set-title': []
  'set-admin': [enabled: boolean]
  kick: []
}>()

const actions = computed(() => getGroupMemberMenuActions(props.actor, props.member))
const kickDisabledReason = computed(() => getGroupMemberKickDisabledReason(props.actor, props.member))
</script>
