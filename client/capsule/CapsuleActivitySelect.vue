<template>
  <SchemaBase>
    <template #title><slot name="title"></slot></template>
    <template #desc><slot name="desc"></slot></template>
    <template #menu><slot name="menu"></slot></template>
    <template #prefix><slot name="prefix"></slot></template>
    <template #suffix><slot name="suffix"></slot></template>
    <ul class="bottom onebot-webqq-activity-select">
      <li v-for="activity in activities" :key="activity.id">
        <el-checkbox
          :model-value="selectedIds.has(activity.id)"
          :disabled="disabled"
          @update:model-value="toggleActivity(activity.id, Boolean($event))"
        >
          <span>{{ activity.name }}</span>
          <code>{{ activity.id }}</code>
        </el-checkbox>
      </li>
    </ul>
  </SchemaBase>
</template>

<script lang="ts" setup>
import { computed, type PropType } from 'vue'
import { SchemaBase, useContext } from '@koishijs/client'

const props = defineProps({
  modelValue: {} as PropType<string[]>,
  disabled: {} as PropType<boolean>,
})

const emit = defineEmits(['update:modelValue'])

const ctx = useContext()
const selectedIds = computed(() => new Set(props.modelValue ?? ['logs']))
const activities = computed(() => Object.values(ctx.$router.pages)
  .filter((activity) => activity.id && !activity.disabled())
  .sort((a, b) => a.order - b.order))

function toggleActivity(id: string, checked: boolean) {
  const values = new Set(selectedIds.value)
  if (checked) values.add(id)
  else values.delete(id)
  emit('update:modelValue', [...values])
}
</script>

<style scoped>
.onebot-webqq-activity-select code {
  margin-left: 8px;
  color: var(--fg2);
}
</style>
