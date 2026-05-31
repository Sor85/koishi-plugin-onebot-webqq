import { Context, receive } from '@koishijs/client'
import type { Ref } from 'vue'
import Capsule from './Capsule.vue'
import { capsule, debug, type CapsuleData } from './state'
import './style.scss'

interface ClientData {
  capsule?: CapsuleData
  debug?: boolean
}

export default function (ctx: Context, data?: Ref<ClientData>) {
  capsule.value = data?.value?.capsule
  debug.value = !!data?.value?.debug

  if (debug.value) {
    console.debug('[chat-capsule] entry data', data?.value)
  }

  receive('chat-capsule/update', (value) => {
    capsule.value = value as CapsuleData | undefined
    if (debug.value) {
      console.debug('[chat-capsule] update', value)
    }
  })

  ctx.slot({
    type: 'global',
    component: Capsule,
    order: 100,
  })
}
