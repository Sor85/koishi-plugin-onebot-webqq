import { describe, expect, it } from 'vitest'
import { resolveWebQQPokePeer } from '../../src/webqq/message-flow/live-notices'

describe('webqq poke peer', () => {
  it('keeps group poke on the group chat', () => {
    expect(resolveWebQQPokePeer({
      groupId: '20000',
      senderId: '10000',
      targetId: '30000',
      selfId: '10000',
    })).toEqual({ type: 'group', peerId: '20000' })
  })

  it('routes a bot-initiated private poke to the friend instead of the bot itself', () => {
    expect(resolveWebQQPokePeer({
      senderId: '10000',
      targetId: '30000',
      selfId: '10000',
    })).toEqual({ type: 'friend', peerId: '30000' })
  })

  it('routes a friend-initiated private poke to that friend', () => {
    expect(resolveWebQQPokePeer({
      senderId: '30000',
      targetId: '10000',
      selfId: '10000',
    })).toEqual({ type: 'friend', peerId: '30000' })
  })

  it('drops a private self poke so it cannot create a fake self chat', () => {
    expect(resolveWebQQPokePeer({
      senderId: '10000',
      targetId: '10000',
      selfId: '10000',
    })).toBeUndefined()
  })
})
