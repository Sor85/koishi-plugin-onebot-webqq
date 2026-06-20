<template>
  <Capsule>
    <WebQQObserver v-show="webQQOpen" :visible="webQQOpen" />
  </Capsule>
</template>

<script lang="ts" setup>
import Capsule from './capsule/Capsule.vue'
import { webQQOpen } from './entry-state'
import WebQQObserver from './webqq/WebQQObserver.vue'
</script>
