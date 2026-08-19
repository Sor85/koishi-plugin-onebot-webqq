<template>
  <section
    ref="searchRoot"
    class="onebot-webqq-webqq__message-search"
    role="search"
    aria-label="查找聊天记录"
  >
    <div
      class="onebot-webqq-webqq__message-search-field"
      :class="{ 'is-focused': searchFocused }"
      @focusin="searchFocused = true"
      @focusout="handleSearchFocusOut"
    >
      <IconSearch :size="18" aria-hidden="true" />
      <input
        ref="searchInput"
        :value="query"
        type="search"
        aria-label="搜索消息正文"
        placeholder="查找聊天记录..."
        autocomplete="off"
        @input="handleQueryInput"
        @keydown.esc.prevent="handleEscape"
      >
      <button
        type="button"
        class="onebot-webqq-webqq__message-search-date-trigger"
        :class="{ 'is-active': !!localDate }"
        :aria-label="dateTriggerLabel"
        :aria-pressed="!!localDate"
        @click.stop="datePopoverOpen = !datePopoverOpen"
      >
        <IconCalendar :size="17" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="onebot-webqq-webqq__message-search-clear"
        :aria-label="query ? '清空搜索' : '关闭查找聊天记录'"
        @click="query ? clearQuery() : emit('close')"
      >
        <IconX :size="16" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="datePopoverOpen"
      ref="datePopover"
      popover="manual"
      class="onebot-webqq-webqq__message-search-date-popover"
      :class="enableWebQQFrostedGlass ? 'is-frosted' : 'is-plain'"
      :style="datePopoverStyle"
      data-onebot-webqq-message-search-date
      @pointerdown.stop
    >
      <div class="onebot-webqq-webqq__message-search-calendar-header">
        <button type="button" aria-label="上个月" @click="shiftMonth(-1)">
          <IconChevronLeft :size="16" aria-hidden="true" />
        </button>
        <div class="onebot-webqq-webqq__message-search-calendar-selectors">
          <button type="button" :aria-expanded="monthMenuOpen" @click="toggleMonthMenu">
            {{ displayMonth }}月
            <IconChevronDown :size="16" aria-hidden="true" />
          </button>
          <button type="button" :aria-expanded="yearMenuOpen" @click="toggleYearMenu">
            {{ displayYear }}年
            <IconChevronDown :size="16" aria-hidden="true" />
          </button>
        </div>
        <button type="button" aria-label="下个月" @click="shiftMonth(1)">
          <IconChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>

      <div v-if="monthMenuOpen" v-webqq-scrollbar class="onebot-webqq-webqq__message-search-calendar-menu is-month" role="listbox" aria-label="选择月份">
        <button
          v-for="month in 12"
          :key="month"
          type="button"
          role="option"
          :aria-selected="month === displayMonth"
          :class="{ 'is-selected': month === displayMonth }"
          @click="selectMonth(month)"
        >
          {{ month }}月
        </button>
      </div>
      <div v-if="yearMenuOpen" v-webqq-scrollbar class="onebot-webqq-webqq__message-search-calendar-menu is-year" role="listbox" aria-label="选择年份">
        <button
          v-for="year in yearOptions"
          :key="year"
          type="button"
          role="option"
          :aria-selected="year === displayYear"
          :class="{ 'is-selected': year === displayYear }"
          @click="selectYear(year)"
        >
          {{ year }}年
        </button>
      </div>

      <div class="onebot-webqq-webqq__message-search-calendar-weekdays" aria-hidden="true">
        <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
      </div>
      <div class="onebot-webqq-webqq__message-search-calendar-grid" role="grid" aria-label="选择聊天记录日期">
        <button
          v-for="day in calendarDays"
          :key="day.key"
          type="button"
          role="gridcell"
          :class="{
            'is-outside': !day.inCurrentMonth,
            'is-today': day.localDate === todayLocalDate,
            'is-selected': day.localDate === localDate,
          }"
          :aria-label="day.label"
          :aria-selected="day.localDate === localDate"
          @click="selectDate(day.localDate)"
        >
          {{ day.day }}
        </button>
      </div>
    </div>

    <div
      v-if="hasCriteria"
      v-webqq-scrollbar="{ tone: 'accent' }"
      class="onebot-webqq-webqq__message-search-results"
      role="listbox"
      aria-label="搜索结果"
    >
      <p v-if="statusText" class="onebot-webqq-webqq__message-search-status" role="status" aria-live="polite">
        {{ statusText }}
      </p>
      <button
        v-for="message in results"
        :key="message.id || message.sequence"
        type="button"
        role="option"
        class="onebot-webqq-webqq__message-search-hit"
        :aria-selected="false"
        @click="emit('select', message)"
      >
        <img
          v-if="message.senderAvatar"
          class="onebot-webqq-webqq__message-search-avatar"
          :src="withProxy(message.senderAvatar)"
          alt=""
        >
        <span v-else class="onebot-webqq-webqq__message-search-avatar is-fallback" aria-hidden="true">
          {{ message.senderName.slice(0, 1) }}
        </span>
        <span class="onebot-webqq-webqq__message-search-hit-body">
          <span class="onebot-webqq-webqq__message-search-hit-meta">
            <strong>{{ message.senderName }}</strong>
            <time :datetime="new Date(message.time).toISOString()">{{ formatSearchTime(message.time) }}</time>
          </span>
          <span class="onebot-webqq-webqq__message-search-hit-summary">{{ message.summary || '[消息]' }}</span>
        </span>
      </button>
      <button
        v-if="searched && !exhausted && results.length"
        type="button"
        class="onebot-webqq-webqq__message-search-more"
        :disabled="loading"
        @click="emit('more')"
      >
        {{ loading ? '加载中...' : '加载更多结果' }}
      </button>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { withProxy } from '@koishijs/client'
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight, IconSearch, IconX } from '@tabler/icons-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { enableWebQQFrostedGlass } from '../settings'
import type { WebQQMessage } from '../types'
import { showWebQQPopover } from '../utils/webqq-popover'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'

interface CalendarDay {
  key: string
  day: number
  localDate: string
  label: string
  inCurrentMonth: boolean
}

const props = defineProps<{
  query: string
  localDate: string
  results: WebQQMessage[]
  loading: boolean
  errorText: string
  searched: boolean
  scannedCount: number
  exhausted: boolean
}>()

const emit = defineEmits<{
  close: []
  search: [criteria: { query: string, localDate?: string }]
  more: []
  select: [message: WebQQMessage]
  'update:query': [value: string]
  'update:localDate': [value: string]
}>()

const searchRoot = ref<HTMLElement>()
const searchInput = ref<HTMLInputElement>()
const datePopover = ref<HTMLElement>()
const datePopoverStyle = ref<Record<string, string>>({})
const datePopoverOpen = ref(false)
const monthMenuOpen = ref(false)
const yearMenuOpen = ref(false)
const searchFocused = ref(false)
const now = new Date()
const displayYear = ref(now.getFullYear())
const displayMonth = ref(now.getMonth() + 1)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const todayLocalDate = toLocalDate(now)
const yearOptions = computed(() => Array.from({ length: 10 }, (_, index) => now.getFullYear() - index))
const hasCriteria = computed(() => !!props.query.trim() || !!props.localDate)
const dateTriggerLabel = computed(() => props.localDate
  ? `筛选日期，当前为 ${props.localDate}`
  : '按日期筛选聊天记录')
const statusText = computed(() => {
  if (props.errorText) return props.errorText
  if (props.loading && !props.results.length) return '搜索中...'
  if (props.searched && !props.loading && !props.results.length) return '没有匹配的聊天记录'
  return ''
})
const calendarDays = computed<CalendarDay[]>(() => {
  const firstDay = new Date(displayYear.value, displayMonth.value - 1, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(displayYear.value, displayMonth.value - 1, 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const localDate = toLocalDate(date)
    return {
      key: localDate,
      day: date.getDate(),
      localDate,
      label: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
      inCurrentMonth: date.getFullYear() === displayYear.value && date.getMonth() + 1 === displayMonth.value,
    }
  })
})

watch(() => props.localDate, (value) => {
  const parsed = parseLocalDate(value)
  if (!parsed) return
  displayYear.value = parsed.getFullYear()
  displayMonth.value = parsed.getMonth() + 1
}, { immediate: true })

watch(datePopoverOpen, async (open) => {
  if (!open) {
    monthMenuOpen.value = false
    yearMenuOpen.value = false
    return
  }
  await nextTick()
  updateDatePopoverPosition()
  await showWebQQPopover(datePopover.value)
})

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointer)
  window.addEventListener('resize', updateDatePopoverPosition)
  // 展开动画期间外壳还是 32px，默认 focus 会 scrollIntoView，把 overflow 窗口整块推走。
  nextTick(() => searchInput.value?.focus({ preventScroll: true }))
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer)
  window.removeEventListener('resize', updateDatePopoverPosition)
  if (debounceTimer) clearTimeout(debounceTimer)
})

function updateDatePopoverPosition() {
  const anchor = searchRoot.value?.getBoundingClientRect()
  if (!anchor) return
  const width = Math.min(250, window.innerWidth - 24)
  const left = Math.min(
    Math.max(12, anchor.right - width),
    window.innerWidth - width - 12,
  )
  datePopoverStyle.value = {
    top: `${anchor.bottom + 10}px`,
    left: `${left}px`,
    right: 'auto',
    width: `${width}px`,
  }
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function toLocalDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function closeOnOutsidePointer(event: PointerEvent) {
  if (searchRoot.value?.contains(event.target as Node)) return
  emit('close')
}

function handleSearchFocusOut(event: FocusEvent) {
  // 新挂载的搜索框会在 nextTick 中立刻聚焦；显式状态类用于触发稳定的样式重算，
  // 避免同页其他插件存在同名 :focus-within 规则时，浏览器沿用未聚焦的初始计算结果。
  const nextTarget = event.relatedTarget
  searchFocused.value = nextTarget instanceof Node
    && (event.currentTarget as HTMLElement).contains(nextTarget)
}

function handleQueryInput(event: Event) {
  const query = (event.target as HTMLInputElement).value
  emit('update:query', query)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => emit('search', {
    query: query.trim(),
    ...(props.localDate ? { localDate: props.localDate } : {}),
  }), query.trim() ? 250 : 0)
}

function clearQuery() {
  emit('update:query', '')
  emit('search', {
    query: '',
    ...(props.localDate ? { localDate: props.localDate } : {}),
  })
  nextTick(() => searchInput.value?.focus({ preventScroll: true }))
}

function handleEscape() {
  if (monthMenuOpen.value || yearMenuOpen.value) {
    monthMenuOpen.value = false
    yearMenuOpen.value = false
    return
  }
  if (datePopoverOpen.value) {
    datePopoverOpen.value = false
    return
  }
  emit('close')
}

function toggleMonthMenu() {
  monthMenuOpen.value = !monthMenuOpen.value
  yearMenuOpen.value = false
}

function toggleYearMenu() {
  yearMenuOpen.value = !yearMenuOpen.value
  monthMenuOpen.value = false
}

function shiftMonth(offset: number) {
  const next = new Date(displayYear.value, displayMonth.value - 1 + offset, 1)
  displayYear.value = next.getFullYear()
  displayMonth.value = next.getMonth() + 1
  monthMenuOpen.value = false
  yearMenuOpen.value = false
}

function selectMonth(month: number) {
  displayMonth.value = month
  monthMenuOpen.value = false
}

function selectYear(year: number) {
  displayYear.value = year
  yearMenuOpen.value = false
}

function selectDate(localDate: string) {
  emit('update:localDate', localDate)
  emit('search', { query: props.query.trim(), localDate })
  datePopoverOpen.value = false
  monthMenuOpen.value = false
  yearMenuOpen.value = false
}

function formatSearchTime(time: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time))
}
</script>
