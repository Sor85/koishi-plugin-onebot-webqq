import { Context, receive } from '@koishijs/client'
import type { Ref } from 'vue'
import Capsule from './Capsule.vue'
import { capsule, type CapsuleData } from './state'
import './style.scss'

interface ClientData {
  capsule?: CapsuleData
}

export default function (ctx: Context, data?: Ref<ClientData>) {
  capsule.value = data?.value?.capsule

  receive('chat-capsule/update', (value) => {
    capsule.value = value as CapsuleData | undefined
  })

  ctx.slot({
    type: 'global',
    component: Capsule,
    order: 100,
  })
}
