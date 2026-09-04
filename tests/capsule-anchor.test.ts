import { describe, expect, it } from 'vitest'
import {
  CAPSULE_ANCHOR_VIEWPORT_MARGIN,
  clampCapsuleAnchor,
  normalizeCapsuleAnchorPosition,
  type CapsuleAnchor,
} from '../client/capsule/capsule-anchor'

const viewport = { width: 1280, height: 800 }

function anchor(input: Partial<CapsuleAnchor> = {}): CapsuleAnchor {
  return { right: 24, bottom: 56, width: 204, height: 50, ...input }
}

describe('入口锚点', () => {
  it('存下来的位置只认两个有限数字', () => {
    expect(normalizeCapsuleAnchorPosition({ right: 120, bottom: 240 })).toEqual({ right: 120, bottom: 240 })
    expect(normalizeCapsuleAnchorPosition({ right: 120 })).toBeUndefined()
    expect(normalizeCapsuleAnchorPosition({ right: '120', bottom: 240 })).toBeUndefined()
    expect(normalizeCapsuleAnchorPosition({ right: Number.NaN, bottom: 240 })).toBeUndefined()
    expect(normalizeCapsuleAnchorPosition({ right: Number.POSITIVE_INFINITY, bottom: 240 })).toBeUndefined()
    expect(normalizeCapsuleAnchorPosition(null)).toBeUndefined()
    expect(normalizeCapsuleAnchorPosition('{}')).toBeUndefined()
  })

  it('视口里放得下的位置原样保留，只取整', () => {
    expect(clampCapsuleAnchor(anchor({ right: 320.4, bottom: 240.6 }), viewport)).toEqual({
      right: 320,
      bottom: 241,
      width: 204,
      height: 50,
    })
  })

  it('贴住右下缘时留下最小间距', () => {
    expect(clampCapsuleAnchor(anchor({ right: -40, bottom: -40 }), viewport)).toMatchObject({
      right: CAPSULE_ANCHOR_VIEWPORT_MARGIN,
      bottom: CAPSULE_ANCHOR_VIEWPORT_MARGIN,
    })
  })

  it('拖过左缘、上缘时按入口自己的宽高留在视口内', () => {
    expect(clampCapsuleAnchor(anchor({ right: 4000, bottom: 4000 }), viewport)).toMatchObject({
      right: 1280 - 204 - CAPSULE_ANCHOR_VIEWPORT_MARGIN,
      bottom: 800 - 50 - CAPSULE_ANCHOR_VIEWPORT_MARGIN,
    })
  })

  it('头像栈展开后入口变宽，左缘上限跟着收紧', () => {
    expect(clampCapsuleAnchor(anchor({ right: 4000, width: 320 }), viewport).right)
      .toBe(1280 - 320 - CAPSULE_ANCHOR_VIEWPORT_MARGIN)
  })

  it('视口比入口还窄还矮时保右缘、保下缘，让左上侧溢出', () => {
    expect(clampCapsuleAnchor(anchor({ right: 4000, bottom: 4000 }), { width: 120, height: 40 })).toMatchObject({
      right: CAPSULE_ANCHOR_VIEWPORT_MARGIN,
      bottom: CAPSULE_ANCHOR_VIEWPORT_MARGIN,
    })
  })
})
